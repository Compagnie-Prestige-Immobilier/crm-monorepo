import { Logger } from '@nestjs/common';
import { createChuesClient } from '@crm/api-client-chues';
import { createGrandPublicClient } from '@crm/api-client-grand-public';
import { Projet } from '@crm/database';
import { z } from 'zod';

import { tryNormalizePhone } from '../../common/phone.js';

const logger = new Logger('Plateformes');

/** Une ligne de plateforme, ramenée au vocabulaire de `inscriptions_plateforme`. */
export interface InscriptionDistante {
  readonly identifiantDistant: string;
  readonly nom: string;
  readonly prenom: string;
  readonly phoneE164: string | null;
  readonly email: string | null;
  readonly statutDistant: string;
  readonly etapeDistante: number | null;
  readonly inscriteLe: Date | null;
  readonly soumiseLe: Date | null;
  readonly decideeLe: Date | null;
  readonly chargeUtile: unknown;
}

export interface ConfigPlateforme {
  readonly url: string;
  readonly token: string;
  /** Injecté par les tests ; sinon le `fetch` du runtime. */
  readonly fetch?: typeof globalThis.fetch;
  /** Attente entre deux pages Grand Public. 120 requêtes par minute par compte. */
  readonly pauseMs?: number;
}

/** Le jeton machine a été révoqué : le tirage s'arrête et le dit. */
export class JetonPlateformeRevoque extends Error {
  constructor(projet: Projet) {
    super(`Jeton refusé par la plateforme ${projet} (401).`);
    this.name = 'JetonPlateformeRevoque';
  }
}

export class PlateformeNonConfiguree extends Error {
  constructor(projet: Projet) {
    super(`Aucune URL ni jeton pour la plateforme ${projet}.`);
    this.name = 'PlateformeNonConfiguree';
  }
}

/**
 * Laravel sérialise ses horodatages tantôt en secondes, tantôt en
 * millisecondes selon le sérialiseur. Un compteur de secondes d'aujourd'hui
 * vaut ~1,8e9 ; le même instant en millisecondes vaut ~1,8e12. Le seuil sépare
 * les deux sans ambiguïté sur toute date utile.
 */
const SEUIL_SECONDES = 1e11;

export function dateDeHorodatage(valeur: number | null | undefined): Date | null {
  if (valeur === null || valeur === undefined || valeur === 0) return null;
  const ms = valeur < SEUIL_SECONDES ? valeur * 1000 : valeur;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Grand Public rend « 2026-09-03 13:43:05 », sans fuseau. `new Date` lirait cette
 * forme dans le fuseau de la MACHINE : la même inscription changerait de jour
 * selon l'endroit d'où l'API tourne. Le serveur métier est à Dakar, donc UTC.
 */
const SANS_FUSEAU = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/;

export function dateDeTexte(valeur: string | null | undefined): Date | null {
  const propre = valeur?.trim() ?? '';
  if (propre === '') return null;
  const normalisee = SANS_FUSEAU.test(propre) ? `${propre.replace(' ', 'T')}Z` : propre;
  const date = new Date(normalisee);
  return Number.isNaN(date.getTime()) ? null : date;
}

const texte = (valeur: string | null | undefined): string | null => {
  const propre = valeur?.trim() ?? '';
  return propre === '' ? null : propre;
};

/**
 * Grand Public ne stocke qu'un `name`. L'ordre d'affichage du produit est
 * « Prénom Nom » : le premier mot est le prénom, le reste le nom. Le
 * rapprochement ne lit ni l'un ni l'autre, cette coupe ne sert qu'à afficher.
 */
export function separerNom(complet: string | null): { nom: string; prenom: string } {
  const mots = (complet ?? '').trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return { nom: '', prenom: '' };
  if (mots.length === 1) return { nom: mots[0] ?? '', prenom: '' };
  return { prenom: mots[0] ?? '', nom: mots.slice(1).join(' ') };
}

const configuree = (config: ConfigPlateforme): boolean =>
  config.url.trim() !== '' && config.token.trim() !== '';

const optionsClient = (config: ConfigPlateforme) => ({
  getAccessToken: () => config.token,
  ...(config.fetch ? { fetch: config.fetch } : {}),
});

// ── CHUES ───────────────────────────────────────────────────────────────────

async function lireChues(config: ConfigPlateforme): Promise<InscriptionDistante[]> {
  const client = createChuesClient(config.url, optionsClient(config));

  const clients = await client.GET('/clients', {});
  if (clients.response.status === 401) throw new JetonPlateformeRevoque(Projet.CHUES);
  if (clients.data === undefined) {
    throw new Error(
      `Lecture /clients refusée par la plateforme CHUES (${String(clients.response.status)}).`,
    );
  }

  // Le dossier porte la soumission, jamais la décision. Elle vit sur la demande
  // d'adhésion, que seul l'e-mail relie au compte. Une plateforme déployée avant
  // la permission `view-adhesions` rend 403 : le tirage continue, mais il le DIT,
  // sinon un délai médian vide passerait pour une absence de données.
  const adhesions = await client.GET('/chues/adhesions', {});
  if (adhesions.response.status === 401) throw new JetonPlateformeRevoque(Projet.CHUES);
  if (adhesions.data === undefined) {
    logger.warn(
      `Adhésions CHUES illisibles (${String(adhesions.response.status)}) : aucune date de décision ne sera enregistrée.`,
    );
  }
  const decisions = new Map<string, Date | null>();
  for (const demande of adhesions.data?.requests ?? []) {
    const cle = texte(demande.email)?.toLowerCase();
    if (cle !== undefined) decisions.set(cle, dateDeHorodatage(demande.decidedAt));
  }

  return clients.data.clients.map((ligne) => {
    const email = texte(ligne.email);
    return {
      identifiantDistant: String(ligne.id),
      nom: texte(ligne.lastName) ?? '',
      prenom: texte(ligne.firstName) ?? '',
      phoneE164: tryNormalizePhone(ligne.phone) ?? null,
      email,
      statutDistant:
        ligne.dossier?.status ?? (ligne.approved ? 'compte-valide' : 'compte-en-attente'),
      etapeDistante: null,
      inscriteLe: dateDeHorodatage(ligne.createdAt),
      soumiseLe: dateDeHorodatage(ligne.dossier?.submittedAt),
      decideeLe: email === null ? null : (decisions.get(email.toLowerCase()) ?? null),
      chargeUtile: ligne,
    };
  });
}

// ── Grand Public ────────────────────────────────────────────────────────────

/**
 * Les corps de réponse Grand Public ne sont pas décrits par la spec : Scramble
 * rend `ClientData` opaque. Le contrat est donc posé ici, à la frontière, et
 * une ligne qui ne s'y conforme pas est ignorée plutôt que déposée à moitié.
 *
 * Les noms sont en CAMEL CASE et non en snake_case : `spatie/laravel-data`
 * sérialise ainsi, quel que soit le nom de la colonne en base. Relevé sur la
 * réponse réelle du 2026-09-05.
 */
const clientGrandPublic = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  dossierEtape: z.coerce.number().int().nullish(),
  dateInscription: z.string().nullish(),
  demande: z.object({ submittedAt: z.string().nullish() }).nullish(),
});

const pageGrandPublic = z.object({
  data: z.array(z.unknown()),
  meta: z.object({ last_page: z.number().int().nullish() }).nullish(),
  last_page: z.number().int().nullish(),
});

const PAGES_MAX = 400;
const PAUSE_PAGE_MS = 600;

const pause = (ms: number): Promise<void> =>
  ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));

type ClientGrandPublic = ReturnType<typeof createGrandPublicClient>;

interface PageLue {
  readonly inscriptions: InscriptionDistante[];
  readonly dernierePage: number;
  readonly vide: boolean;
}

async function lirePageGrandPublic(client: ClientGrandPublic, page: number): Promise<PageLue> {
  // Laravel lit `?page` sur la requête, mais Scramble ne le documente pas : la
  // spec type l'opération sans paramètre, et le paquet client ne se modifie pas.
  const reponse = await client.GET('/staff/clients', {
    params: { query: { page } },
  } as unknown as Record<string, never>);

  if (reponse.response.status === 401) throw new JetonPlateformeRevoque(Projet.GRAND_PUBLIC);
  if (reponse.data === undefined) {
    throw new Error(
      `Lecture /staff/clients refusée par la plateforme Grand Public (${String(reponse.response.status)}).`,
    );
  }

  const lue = pageGrandPublic.safeParse(reponse.data);
  if (!lue.success) return { inscriptions: [], dernierePage: page, vide: true };

  const inscriptions = lue.data.data.flatMap((brute) => {
    const ligne = clientGrandPublic.safeParse(brute);
    return ligne.success ? [versInscriptionGrandPublic(ligne.data, brute)] : [];
  });

  return {
    inscriptions,
    dernierePage: lue.data.meta?.last_page ?? lue.data.last_page ?? page,
    vide: lue.data.data.length === 0,
  };
}

async function lireGrandPublic(config: ConfigPlateforme): Promise<InscriptionDistante[]> {
  const client = createGrandPublicClient(config.url, optionsClient(config));
  const attente = config.pauseMs ?? PAUSE_PAGE_MS;

  const lignes: InscriptionDistante[] = [];
  let page = 1;
  let dernierePage = 1;

  while (page <= dernierePage && page <= PAGES_MAX) {
    const lue = await lirePageGrandPublic(client, page);
    lignes.push(...lue.inscriptions);
    if (lue.vide) break;

    dernierePage = lue.dernierePage;
    page += 1;
    if (page <= dernierePage) await pause(attente);
  }

  return lignes;
}

function versInscriptionGrandPublic(
  ligne: z.infer<typeof clientGrandPublic>,
  brute: unknown,
): InscriptionDistante {
  const { nom, prenom } = separerNom(texte(ligne.name));
  return {
    identifiantDistant: String(ligne.id),
    nom,
    prenom,
    phoneE164: tryNormalizePhone(ligne.phone) ?? null,
    email: texte(ligne.email),
    // `statut` de la plateforme est un texte libre décoratif : les neuf fiches
    // relevées portaient toutes « Dossier en préparation » alors que leur étape
    // allait de 0 à 5. L'état qui se mesure est l'ÉTAPE, et le statut en dérive.
    statutDistant: ligne.dossierEtape === null || ligne.dossierEtape === undefined
      ? 'etape-inconnue'
      : `etape-${String(ligne.dossierEtape)}`,
    etapeDistante: ligne.dossierEtape ?? null,
    inscriteLe: dateDeTexte(ligne.dateInscription),
    soumiseLe: dateDeTexte(ligne.demande?.submittedAt),
    decideeLe: null,
    chargeUtile: brute,
  };
}

export function lirePlateforme(
  projet: Projet,
  config: ConfigPlateforme,
): Promise<InscriptionDistante[]> {
  if (!configuree(config)) throw new PlateformeNonConfiguree(projet);
  return projet === Projet.CHUES ? lireChues(config) : lireGrandPublic(config);
}
