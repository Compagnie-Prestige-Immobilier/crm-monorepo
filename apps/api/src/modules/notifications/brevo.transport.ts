import { Injectable, Logger } from '@nestjs/common';

import { readNotificationsEnv } from './notifications.env.js';

/**
 * Transport e-mail Brevo (API transactionnelle v3).
 *
 * SEUL CANAL SORTANT depuis le retrait de Firebase du mobile. La boîte de
 * réception reste le canal qui fait foi (tout le monde y voit le message en
 * ouvrant l'application) ; l'e-mail sert les téléconseillers, qui travaillent
 * devant un poste. Conséquence assumée dans tout ce fichier : rien ici ne doit
 * lever, ni au démarrage, ni pendant un envoi. L'appelant traduit les issues en
 * lignes de livraison, il ne rattrape pas d'exception.
 *
 * AUCUNE dépendance ajoutée. Le SDK `@getbrevo/brevo` ferait exactement ce que
 * font les quelques dizaines de lignes ci-dessous (un POST JSON avec un
 * en-tête), au prix d'un arbre transitif que ce dépôt n'aurait aucune raison
 * d'auditer.
 */

/**
 * Plafond de destinataires par appel. Au-delà, Brevo refuse la requête EN BLOC :
 * une adresse de trop et les 99 autres ne partent pas non plus.
 */
export const BREVO_MAX_RECIPIENTS_PER_CALL = 99;

/**
 * Appels HTTP simultanés vers Brevo, tous lots confondus.
 *
 * POURQUOI UN PLAFOND, ET POURQUOI SI BAS. Une campagne générale produit des
 * centaines de lots de 99 adresses. Les lancer tous ensemble (ce que fait un
 * `map` suivi d'un `allSettled` non bridé) ouvre autant de connexions d'un
 * coup, et Brevo répond 429 sur la queue de la vague : ce ne sont pas les
 * premiers lots qui échouent, ce sont les derniers, c'est-à-dire ceux dont
 * personne ne remarque l'absence. Huit est un compromis : assez pour que
 * l'envoi ne traîne pas, assez peu pour rester sous les limites de débit du
 * compte sans avoir à les connaître.
 */
export const BREVO_MAX_CONCURRENT_CALLS = 8;

/**
 * Délai maximal d'UN appel Brevo.
 *
 * Sans lui, `fetch` hérite du défaut d'undici, cinq minutes, pendant lesquelles
 * le tick de rappels reste bloqué sur une socket muette. Un e-mail de rappel
 * qui n'est pas parti en quinze secondes ne sert plus à rien ; la ligne de
 * livraison reste en file et le passage suivant réessaiera.
 */
export const BREVO_REQUEST_TIMEOUT_MS = 15_000;

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

/** Nom d'expéditeur par défaut, quand `BREVO_SENDER_NAME` n'est pas renseigné. */
const DEFAULT_SENDER_NAME = 'CPI GO';

export interface BrevoRecipient {
  readonly email: string;
  readonly name?: string;
}

/** Un message : UN contenu, N destinataires. Le découpage est fait par le transport. */
export interface BrevoMessage {
  readonly recipients: readonly BrevoRecipient[];
  readonly subject: string;
  readonly htmlContent: string;
  readonly textContent: string;
}

/**
 * Nature d'un échec, et c'est la seule chose qui décide du sort de la ligne de
 * livraison.
 *
 * `transient` : le message aurait pu passer, il repassera. Débit dépassé,
 * service indisponible, socket coupée, délai dépassé. La livraison RESTE EN
 * FILE et le passage suivant la reprendra.
 *
 * `permanent` : rien ne changera au prochain essai. Adresse refusée, corps
 * invalide. La livraison est marquée en échec, une bonne fois.
 *
 * Classer un `transient` en `permanent` est la faute coûteuse : elle enterre
 * définitivement un envoi que la simple attente aurait fait passer.
 */
export type BrevoFailureKind = 'transient' | 'permanent';

export interface BrevoSendOutcome {
  readonly email: string;
  readonly ok: boolean;
  readonly errorCode?: string;
  readonly kind?: BrevoFailureKind;
}

/**
 * État du transport pour UN envoi.
 *
 * `NOT_CONFIGURED` n'est pas une erreur : c'est l'état nominal tant qu'aucun
 * compte Brevo n'est branché. Il remonte dans le journal et dans le résumé
 * d'éventail, jamais dans une ligne de livraison.
 */
export type BrevoTransportStatus = 'SENT' | 'NOT_CONFIGURED' | 'TRANSPORT_ERROR';

export interface BrevoDispatchResult {
  readonly status: BrevoTransportStatus;
  readonly outcomes: readonly BrevoSendOutcome[];
  readonly detail?: string;
}

/** Contrat injectable. Les tests fournissent une doublure, pas un vrai réseau. */
export interface BrevoTransport {
  isConfigured(): boolean;
  /** Raison lisible de l'indisponibilité, ou `null` si le transport est prêt. */
  unavailableReason(): string | null;
  send(messages: readonly BrevoMessage[]): Promise<BrevoDispatchResult>;
}

export const BREVO_TRANSPORT = Symbol('BREVO_TRANSPORT');

/** Découpe une liste de destinataires en appels de 99 au plus. */
export const chunkRecipients = <T>(
  items: readonly T[],
  size = BREVO_MAX_RECIPIENTS_PER_CALL,
): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

/**
 * `Promise.allSettled` avec un plafond de travaux simultanés.
 *
 * Écrit ici plutôt qu'emprunté à `p-limit` : quinze lignes contre une
 * dépendance de plus dans l'arbre d'une API qui n'en a pas besoin.
 *
 * Le contrat imite `allSettled` sur deux points qui comptent : les résultats
 * sortent DANS L'ORDRE D'ENTRÉE (l'appelant les réapparie avec ses lots), et un
 * travail qui lève ne fait pas tomber les autres. Un `all` ferait exactement
 * l'inverse, et une seule adresse fautive empêcherait tout le reste de partir.
 */
export const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> => {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let cursor = 0;

  const drain = async (): Promise<void> => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index] as T) };
      } catch (error) {
        results[index] = { status: 'rejected', reason: error };
      }
    }
  };

  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workers }, () => drain()));
  return results;
};

/**
 * Classe un refus de Brevo.
 *
 * 429 et 5xx sont les deux formes du « revenez plus tard » : débit dépassé ou
 * service en peine. Tout le reste (400 sur une adresse refusée, 401 sur une
 * clé, 403 sur un expéditeur non vérifié) décrit un état qui ne bougera pas
 * tout seul entre deux passages.
 */
export const classifyBrevoFailure = (httpStatus: number): BrevoFailureKind =>
  httpStatus === 429 || httpStatus >= 500 ? 'transient' : 'permanent';

@Injectable()
export class BrevoHttpTransport implements BrevoTransport {
  private readonly logger = new Logger(BrevoHttpTransport.name);
  private readonly apiKey: string | null;
  private readonly senderEmail: string | null;
  private readonly senderName: string;
  private readonly reason: string | null;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const config = readNotificationsEnv(env);
    this.apiKey = config.BREVO_API_KEY?.trim() ? config.BREVO_API_KEY.trim() : null;
    this.senderEmail = config.BREVO_SENDER_EMAIL?.trim() ? config.BREVO_SENDER_EMAIL.trim() : null;
    this.senderName = config.BREVO_SENDER_NAME?.trim()
      ? config.BREVO_SENDER_NAME.trim()
      : DEFAULT_SENDER_NAME;

    if (!this.apiKey) {
      this.reason = 'BREVO_API_KEY est absent : aucun transport e-mail configuré.';
    } else if (!this.senderEmail) {
      // Brevo refuse tout message sans expéditeur. Sans cette vérification, la
      // clé présente ferait croire le transport prêt et chaque envoi partirait
      // pour revenir en 400.
      this.reason =
        "BREVO_SENDER_EMAIL est absent : Brevo refuse un envoi sans adresse d'expédition.";
    } else {
      this.reason = null;
    }

    if (this.reason) {
      // `warn` et non `error` : c'est l'état nominal tant que le compte Brevo
      // n'existe pas. Le message nomme la variable, sinon la personne qui
      // déploie cherche pendant une heure.
      this.logger.warn(`${this.reason} Les notifications partent en push uniquement.`);
    } else {
      this.logger.log(`Transport e-mail Brevo actif (expéditeur ${this.senderEmail ?? '?'}).`);
    }
  }

  isConfigured(): boolean {
    return this.apiKey !== null && this.senderEmail !== null;
  }

  unavailableReason(): string | null {
    if (this.isConfigured()) return null;
    return this.reason ?? 'Transport e-mail indisponible.';
  }

  async send(messages: readonly BrevoMessage[]): Promise<BrevoDispatchResult> {
    if (!messages.length) return { status: 'SENT', outcomes: [] };

    const apiKey = this.apiKey;
    const senderEmail = this.senderEmail;
    if (!apiKey || !senderEmail) {
      const detail = this.unavailableReason();
      return {
        status: 'NOT_CONFIGURED',
        outcomes: [],
        ...(detail === null ? {} : { detail }),
      };
    }

    const outcomes: BrevoSendOutcome[] = [];
    let delivered = 0;
    let attempted = 0;
    let firstError: string | undefined;

    for (const message of messages) {
      // Les appels d'un même message sont concurrents, INDÉPENDANTS et BRIDÉS.
      // Indépendants : une adresse invalide dans un lot n'empêche pas les
      // autres lots de partir, d'où `allSettled` et jamais `all`. Bridés :
      // Brevo refuse un appel en bloc, et une vague de plusieurs centaines de
      // requêtes simultanées se fait écrêter en 429 sur sa queue. Le grain de
      // l'échec est le lot de 99, pas l'adresse.
      const chunks = chunkRecipients(message.recipients);
      const settled = await mapWithConcurrency(chunks, BREVO_MAX_CONCURRENT_CALLS, (chunk) =>
        this.sendOne(apiKey, senderEmail, message, chunk),
      );

      settled.forEach((result, index) => {
        attempted += 1;
        const chunk = chunks[index] ?? [];
        if (result.status === 'fulfilled') {
          if (result.value.ok) delivered += 1;
          else firstError ??= result.value.errorCode;
          for (const recipient of chunk) {
            outcomes.push({
              email: recipient.email,
              ok: result.value.ok,
              ...(result.value.errorCode === undefined
                ? {}
                : { errorCode: result.value.errorCode }),
              ...(result.value.kind === undefined ? {} : { kind: result.value.kind }),
            });
          }
          return;
        }

        // Socket coupée ou délai dépassé : rien ne dit que l'adresse est en
        // cause, donc rien ne justifie d'enterrer la livraison. `transient`.
        const reason =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        firstError ??= reason;
        for (const recipient of chunk) {
          outcomes.push({
            email: recipient.email,
            ok: false,
            errorCode: 'NETWORK_ERROR',
            kind: 'transient',
          });
        }
        this.logger.warn(`Envoi Brevo échoué (réseau) : ${reason}`);
      });
    }

    // Aucun lot n'est passé alors qu'au moins un a été tenté : ce n'est pas
    // une adresse fautive, c'est le service ou la clé. L'appelant le journalise,
    // il ne marque AUCUNE livraison en échec pour autant.
    if (attempted > 0 && delivered === 0) {
      return {
        status: 'TRANSPORT_ERROR',
        outcomes,
        ...(firstError === undefined ? {} : { detail: firstError }),
      };
    }

    return { status: 'SENT', outcomes };
  }

  private async sendOne(
    apiKey: string,
    senderEmail: string,
    message: BrevoMessage,
    chunk: readonly BrevoRecipient[],
  ): Promise<{ ok: boolean; errorCode?: string; kind?: BrevoFailureKind }> {
    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      // Sans signal explicite, `fetch` attend le défaut d'undici (cinq
      // minutes) : de quoi immobiliser le tick de rappels sur une seule
      // socket muette. L'abandon lève, la boucle appelante le classe en
      // `transient`, et la livraison repart au passage suivant.
      signal: AbortSignal.timeout(BREVO_REQUEST_TIMEOUT_MS),
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: this.senderName },
        to: chunk.map((recipient) => ({
          email: recipient.email,
          ...(recipient.name === undefined ? {} : { name: recipient.name }),
        })),
        subject: message.subject,
        htmlContent: message.htmlContent,
        textContent: message.textContent,
      }),
    });

    if (response.ok) return { ok: true };

    const payload: unknown = await response.json().catch(() => null);
    return {
      ok: false,
      errorCode: readBrevoErrorCode(payload) ?? `HTTP_${String(response.status)}`,
      kind: classifyBrevoFailure(response.status),
    };
  }
}

/** Extrait le champ `code` du corps d'erreur Brevo, quand il y en a un. */
export const readBrevoErrorCode = (payload: unknown): string | undefined => {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' && code ? code : undefined;
};

/**
 * Transport inerte. Utilisé quand aucune clé n'est fournie : il répond
 * `NOT_CONFIGURED` sans jamais toucher au réseau, ce qui rend toute la chaîne
 * exerçable sans compte Brevo. C'est l'état par défaut du dépôt, et non un
 * mode d'exception.
 */
export class NullBrevoTransport implements BrevoTransport {
  constructor(private readonly reason = 'Aucun transport e-mail configuré.') {}

  isConfigured(): boolean {
    return false;
  }

  unavailableReason(): string | null {
    return this.reason;
  }

  send(): Promise<BrevoDispatchResult> {
    return Promise.resolve({ status: 'NOT_CONFIGURED', outcomes: [], detail: this.reason });
  }
}
