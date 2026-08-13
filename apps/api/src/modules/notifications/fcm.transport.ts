import { createSign } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

import { parseServiceAccount, readNotificationsEnv, type FcmServiceAccount } from './notifications.env.js';

/**
 * Transport FCM — API HTTP v1.
 *
 * L'API « legacy » (`https://fcm.googleapis.com/fcm/send`, clé serveur dans un
 * en-tête `Authorization: key=…`) est RETIRÉE. Tout passe désormais par
 * `/v1/projects/{id}/messages:send`, authentifié par un jeton OAuth2 obtenu en
 * échange d'un JWT signé avec la clé privée du compte de service.
 *
 * AUCUNE dépendance ajoutée pour cela. `google-auth-library` ferait exactement
 * ce que font les quarante lignes ci-dessous — signer un JWT RS256 et
 * l'échanger — au prix d'un arbre de dépendances transitif que ce dépôt
 * n'aurait aucune raison d'auditer.
 */

/** Plafond FCM par lot. Au-delà, la requête est refusée en bloc. */
export const FCM_MAX_TOKENS_PER_BATCH = 500;

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

/** Marge de sécurité sur l'expiration du jeton OAuth. */
const TOKEN_EXPIRY_SKEW_MS = 60_000;

/**
 * Nature d'un échec, du point de vue de ce qu'il faut EN FAIRE.
 *
 * `unregistered` est la seule qui déclenche l'élagage du jeton : l'application
 * a été désinstallée, ou le jeton renouvelé. Un jeton mort le reste, et le
 * réessayer chaque nuit gonfle indéfiniment le compteur d'échecs jusqu'à rendre
 * la métrique inutilisable.
 */
export type FcmFailureKind = 'unregistered' | 'invalid' | 'transient' | 'unknown';

export interface FcmMessage {
  readonly token: string;
  readonly title: string;
  readonly body: string;
  /** FCM n'accepte QUE des chaînes en valeur de `data`. */
  readonly data: Record<string, string>;
}

export interface FcmSendOutcome {
  readonly token: string;
  readonly ok: boolean;
  readonly errorCode?: string;
  readonly kind?: FcmFailureKind;
}

/**
 * État du transport pour UN envoi.
 *
 * `NOT_CONFIGURED` n'est pas une erreur : c'est l'état nominal tant qu'aucun
 * projet Firebase n'existe. Il remonte jusqu'au compositeur admin, qui l'affiche
 * — la pire issue serait une interface annonçant « envoyé » alors que rien
 * n'est parti.
 */
export type FcmTransportStatus = 'SENT' | 'NOT_CONFIGURED' | 'TRANSPORT_ERROR';

export interface FcmDispatchResult {
  readonly status: FcmTransportStatus;
  readonly outcomes: readonly FcmSendOutcome[];
  readonly detail?: string;
}

/** Contrat injectable. Les tests fournissent une doublure, pas un vrai réseau. */
export interface FcmTransport {
  isConfigured(): boolean;
  /** Raison lisible de l'indisponibilité, ou `null` si le transport est prêt. */
  unavailableReason(): string | null;
  send(messages: readonly FcmMessage[]): Promise<FcmDispatchResult>;
}

export const FCM_TRANSPORT = Symbol('FCM_TRANSPORT');

/** Découpe en lots de 500 au plus. */
export const chunkTokens = <T>(items: readonly T[], size = FCM_MAX_TOKENS_PER_BATCH): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const base64Url = (input: Buffer | string): string =>
  (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/**
 * Classe le code d'erreur renvoyé par FCM.
 *
 * `UNREGISTERED` et `NOT_FOUND` désignent tous deux un jeton qui n'existe plus.
 * `INVALID_ARGUMENT` est ambigu — il couvre aussi bien un jeton malformé qu'un
 * corps de message invalide — donc il n'élague PAS : détruire les jetons d'une
 * campagne entière à cause d'une charge utile mal formée serait irréversible.
 */
export const classifyFcmError = (errorCode: string | undefined, httpStatus: number): FcmFailureKind => {
  switch (errorCode) {
    case 'UNREGISTERED':
    case 'NOT_FOUND':
      return 'unregistered';
    case 'INVALID_ARGUMENT':
    case 'SENDER_ID_MISMATCH':
    case 'THIRD_PARTY_AUTH_ERROR':
      return 'invalid';
    case 'UNAVAILABLE':
    case 'INTERNAL':
    case 'QUOTA_EXCEEDED':
      return 'transient';
    default:
      if (httpStatus === 404) return 'unregistered';
      if (httpStatus === 429 || httpStatus >= 500) return 'transient';
      if (httpStatus >= 400) return 'invalid';
      return 'unknown';
  }
};

/** Extrait `error.details[].errorCode`, puis `error.status` en repli. */
export const readFcmErrorCode = (payload: unknown): string | undefined => {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const error = (payload as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return undefined;

  const details = (error as { details?: unknown }).details;
  if (Array.isArray(details)) {
    for (const detail of details) {
      if (typeof detail === 'object' && detail !== null) {
        const code = (detail as { errorCode?: unknown }).errorCode;
        if (typeof code === 'string' && code) return code;
      }
    }
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === 'string' && status ? status : undefined;
};

@Injectable()
export class FcmHttpTransport implements FcmTransport {
  private readonly logger = new Logger(FcmHttpTransport.name);
  private readonly account: FcmServiceAccount | null;
  private readonly projectId: string | null;
  private readonly reason: string | null;

  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  /** Un échange en cours est partagé : cent envois ne demandent pas cent jetons. */
  private pendingToken: Promise<string> | null = null;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const config = readNotificationsEnv(env);
    const raw = config.FCM_SERVICE_ACCOUNT_JSON;
    this.account = parseServiceAccount(raw);

    if (!raw?.trim()) {
      this.reason = 'FCM_SERVICE_ACCOUNT_JSON est absent — aucun transport push configuré.';
    } else if (!this.account) {
      this.reason =
        'FCM_SERVICE_ACCOUNT_JSON est illisible (JSON invalide ou champs project_id/client_email/private_key manquants).';
    } else {
      this.reason = null;
    }

    this.projectId = config.FCM_PROJECT_ID ?? this.account?.projectId ?? null;

    if (this.reason) {
      // `warn` et non `error` : c'est l'état nominal tant que le projet
      // Firebase n'existe pas. Le message doit nommer la variable, sinon la
      // personne qui déploie cherche pendant une heure.
      this.logger.warn(`${this.reason} Les notifications sont stockées et mises en file, pas remises.`);
    } else {
      this.logger.log(`Transport FCM HTTP v1 actif sur le projet ${this.projectId ?? '?'}.`);
    }
  }

  isConfigured(): boolean {
    return this.account !== null && this.projectId !== null;
  }

  unavailableReason(): string | null {
    if (this.isConfigured()) return null;
    return this.reason ?? 'Transport push indisponible.';
  }

  async send(messages: readonly FcmMessage[]): Promise<FcmDispatchResult> {
    if (!messages.length) return { status: 'SENT', outcomes: [] };

    const account = this.account;
    const projectId = this.projectId;
    if (!account || !projectId) {
      const detail = this.unavailableReason();
      return {
        status: 'NOT_CONFIGURED',
        outcomes: [],
        ...(detail === null ? {} : { detail }),
      };
    }

    let token: string;
    try {
      token = await this.authorize(account);
    } catch (error) {
      // L'échange OAuth a échoué : ce n'est ni « non configuré », ni la faute
      // d'un jeton d'appareil. Aucun jeton ne doit être élagué sur ce chemin.
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`Échange OAuth FCM refusé : ${detail}`);
      return { status: 'TRANSPORT_ERROR', outcomes: [], detail };
    }

    const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
    const outcomes: FcmSendOutcome[] = [];

    // Les lots respectent le plafond de 500. À l'intérieur d'un lot, les envois
    // sont concurrents ET indépendants : `allSettled`, jamais `all`, pour qu'un
    // jeton mort n'emporte pas les 499 autres.
    for (const batch of chunkTokens(messages)) {
      const settled = await Promise.allSettled(
        batch.map((message) => this.sendOne(endpoint, token, message)),
      );
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          outcomes.push(result.value);
          return;
        }
        const reason =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        const failed = batch[index];
        if (failed) {
          outcomes.push({
            token: failed.token,
            ok: false,
            errorCode: 'NETWORK_ERROR',
            kind: 'transient',
          });
        }
        this.logger.warn(`Envoi FCM échoué (réseau) : ${reason}`);
      });
    }

    return { status: 'SENT', outcomes };
  }

  private async sendOne(
    endpoint: string,
    accessToken: string,
    message: FcmMessage,
  ): Promise<FcmSendOutcome> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: message.token,
          notification: { title: message.title, body: message.body },
          data: message.data,
          android: {
            priority: 'HIGH',
            notification: {
              // Doit correspondre au canal créé côté Android, sinon la
              // notification retombe sur le canal par défaut et perd son
              // importance — donc son son et son affichage en tête.
              channel_id: 'cpi_go_default',
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
            },
          },
        },
      }),
    });

    if (response.ok) return { token: message.token, ok: true };

    const payload: unknown = await response.json().catch(() => null);
    const errorCode = readFcmErrorCode(payload);
    return {
      token: message.token,
      ok: false,
      errorCode: errorCode ?? `HTTP_${String(response.status)}`,
      kind: classifyFcmError(errorCode, response.status),
    };
  }

  /** Jeton OAuth mémorisé jusqu'à une minute avant son expiration. */
  private async authorize(account: FcmServiceAccount): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt - TOKEN_EXPIRY_SKEW_MS) {
      return this.accessToken;
    }
    this.pendingToken ??= this.exchange(account).finally(() => {
      this.pendingToken = null;
    });
    return this.pendingToken;
  }

  private async exchange(account: FcmServiceAccount): Promise<string> {
    const issuedAt = Math.floor(Date.now() / 1000);
    const assertion = this.signAssertion(account, issuedAt);

    const response = await fetch(account.tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`token endpoint HTTP ${String(response.status)}`);
    }

    const payload = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!payload.access_token) throw new Error('token endpoint returned no access_token');

    this.accessToken = payload.access_token;
    this.accessTokenExpiresAt = Date.now() + (payload.expires_in ?? 3600) * 1000;
    return this.accessToken;
  }

  private signAssertion(account: FcmServiceAccount, issuedAt: number): string {
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64Url(
      JSON.stringify({
        iss: account.clientEmail,
        scope: FCM_SCOPE,
        aud: account.tokenUri,
        iat: issuedAt,
        exp: issuedAt + 3600,
      }),
    );
    const signature = createSign('RSA-SHA256')
      .update(`${header}.${claims}`)
      .sign(account.privateKey);
    return `${header}.${claims}.${base64Url(signature)}`;
  }
}

/**
 * Transport inerte. Utilisé quand aucun compte de service n'est fourni : il
 * répond `NOT_CONFIGURED` sans jamais toucher au réseau, ce qui rend TOUTE la
 * chaîne — composition, public, éventail, lignes de livraison, boîte de
 * réception — exerçable sans projet Firebase.
 */
export class NullFcmTransport implements FcmTransport {
  constructor(private readonly reason = 'Aucun transport push configuré.') {}

  isConfigured(): boolean {
    return false;
  }

  unavailableReason(): string | null {
    return this.reason;
  }

  send(): Promise<FcmDispatchResult> {
    return Promise.resolve({ status: 'NOT_CONFIGURED', outcomes: [], detail: this.reason });
  }
}
