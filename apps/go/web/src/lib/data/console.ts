import { z } from '@/lib/zod';

import { apiClient, unwrap } from '@/api/client';
import type { components, operations } from '@/api/schema';

type Schemas = components['schemas'];

export type Prospect = Schemas['Prospect'];
export type AttemptBody = Schemas['QualificationCallAttemptBody'];
export type CallOutcome = AttemptBody['outcome'];
export type EnrollmentMethod = NonNullable<AttemptBody['method']>;
export type ProspectType = NonNullable<AttemptBody['type']>;
export type PaymentMode = NonNullable<AttemptBody['paymentMode']>;
export type Phase2Status = Prospect['phase2Status'];
export type ProjetApi = Prospect['projet'];
export type ProspectQuery = NonNullable<operations['listProspects']['parameters']['query']>;

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  METHOD_OBTAINED: 'Méthode obtenue',
  UNREACHABLE: 'Injoignable',
  CALLBACK: 'À rappeler',
  REFUSED: 'Refus',
  WRONG_NUMBER: 'Mauvais numéro',
  OTHER: 'Autre',
};

export const PHASE2_STATUS_LABELS: Record<Phase2Status, string> = {
  PENDING: 'En attente',
  METHOD_OBTAINED: 'Méthode obtenue',
  REFUSED: 'Refus',
  WRONG_NUMBER: 'Mauvais numéro',
};

export const ALREADY_COMPLETED = 'PHASE2_ALREADY_COMPLETED';

/**
 * UUID v7 : les 48 bits de tête portent l'horodatage, ce qui garde les clés
 * ordonnées en base. `crypto.randomUUID` produirait un v4, non ordonné.
 */
export function uuidV7(now: number = Date.now()): string {
  const timestamp = Math.floor(now).toString(16).padStart(12, '0').slice(-12);
  const alea = Array.from(crypto.getRandomValues(new Uint8Array(10)), (octet) =>
    octet.toString(16).padStart(2, '0'),
  ).join('');
  const variante = ((Number.parseInt(alea.slice(3, 4), 16) & 0x3) | 0x8).toString(16);
  return [
    timestamp.slice(0, 8),
    timestamp.slice(8, 12),
    `7${alea.slice(0, 3)}`,
    `${variante}${alea.slice(4, 7)}`,
    alea.slice(7, 19),
  ].join('-');
}

export async function fetchProspect(id: string): Promise<Prospect> {
  return unwrap(await apiClient.GET('/api/v1/prospects/{id}', { params: { path: { id } } }));
}

/** Les prospects dont ce téléconseiller a passé le DERNIER appel, du plus récent au plus ancien. */
export function prospectsAppelesQuery(lastCallById: string, projet: ProjetApi): ProspectQuery {
  return { lastCallById, projet, sortBy: 'lastCallAt', sortOrder: 'desc', page: 1, pageSize: 100 };
}

/**
 * Les renseignements recueillis pendant l'appel de conversion : le dossier
 * entier du prospect, corrigeable, plus ce que l'appel apprend. Tout est saisi
 * en texte, sinon un champ vidé n'aurait plus de représentation.
 */
export interface ConversionDraft {
  readonly projet: ProjetApi;
  readonly nom: string;
  readonly prenom: string;
  readonly email: string;
  readonly profession: string;
  readonly type: ProspectType | null;
  readonly dureeEtablissementMois: string;
  readonly fonctionnaire: boolean | null;
  readonly syndicatId: string;
  readonly banqueId: string;
  readonly engagementEnCours: boolean | null;
  readonly incomeBandId: string;
  readonly paymentMode: PaymentMode | null;
  readonly dureeSystemeMois: string;
  readonly memeWhatsapp: boolean | null;
  readonly whatsapp: string;
  readonly method: EnrollmentMethod | null;
  readonly rendezVousAt: string;
  /** Réponses aux champs que l'administrateur a ajoutés, par identifiant de champ. */
  readonly champsLibres: Record<string, string>;
}

const conversionSchema: z.ZodType<ConversionDraft> = z.object({
  projet: z.enum(['CHUES', 'GRAND_PUBLIC']),
  nom: z.string(),
  prenom: z.string(),
  email: z.string(),
  profession: z.string(),
  type: z.enum(['FONCTIONNAIRE', 'SECTEUR_PRIVE', 'INFORMEL', 'DIASPORA']).nullable(),
  dureeEtablissementMois: z.string(),
  fonctionnaire: z.boolean().nullable(),
  syndicatId: z.string(),
  banqueId: z.string(),
  engagementEnCours: z.boolean().nullable(),
  incomeBandId: z.string(),
  paymentMode: z.enum(['COMPTANT', 'ECHELONNE']).nullable(),
  dureeSystemeMois: z.string(),
  memeWhatsapp: z.boolean().nullable().catch(null),
  whatsapp: z.string().catch(''),
  method: z
    .enum(['PLATFORM', 'PHYSICAL', 'VOICE_OR_ELECTRONIC_MESSAGING', 'APPOINTMENT', 'WHATSAPP'])
    .nullable(),
  rendezVousAt: z.string(),
  champsLibres: z.record(z.string(), z.string()).catch({}),
});

const brouillonSchema = z.object({
  comment: z.string().catch(''),
  conversion: conversionSchema.nullish().catch(null),
});

export interface BrouillonRepris {
  readonly comment: string;
  readonly conversion: ConversionDraft | null;
}

const RIEN: BrouillonRepris = { comment: '', conversion: null };

/**
 * Ce que le rappel retrouve. Un brouillon abîmé rend un formulaire vide, jamais
 * une erreur : perdre une saisie est fâcheux, ne plus pouvoir rouvrir la fiche
 * l'est davantage.
 */
export function lireBrouillon(draft: unknown): BrouillonRepris {
  const lu = brouillonSchema.safeParse(draft);
  if (!lu.success) return RIEN;
  return { comment: lu.data.comment, conversion: lu.data.conversion ?? null };
}

/** Le formulaire s'ouvre déjà rempli de ce que la fiche sait : on ne redemande rien. */
export function conversionFrom(prospect: Prospect): ConversionDraft {
  return {
    projet: prospect.projet,
    nom: prospect.nom,
    prenom: prospect.prenom,
    email: '',
    profession: prospect.profession ?? '',
    type: prospect.type,
    dureeEtablissementMois: '',
    fonctionnaire: null,
    syndicatId: prospect.syndicatId ?? '',
    banqueId: prospect.banqueId ?? '',
    engagementEnCours: null,
    incomeBandId: prospect.incomeBandId ?? '',
    paymentMode: prospect.paymentMode,
    dureeSystemeMois: prospect.dureeSystemeMois === null ? '' : String(prospect.dureeSystemeMois),
    memeWhatsapp: null,
    whatsapp: '',
    method: null,
    rendezVousAt: '',
    champsLibres: { ...prospect.champsLibres },
  };
}

/** La clé disparaît quand la valeur est vide : `exactOptionalPropertyTypes` l'exige. */
const siRempli = <K extends string>(cle: K, valeur: string): Partial<Record<K, string>> =>
  valeur.trim() === '' ? {} : ({ [cle]: valeur.trim() } as Record<K, string>);

function identiteData(draft: ConversionDraft): Partial<AttemptBody> {
  return {
    ...siRempli('nom', draft.nom),
    ...siRempli('prenom', draft.prenom),
    ...siRempli('email', draft.email),
    ...siRempli('profession', draft.profession),
  };
}

function choixData(draft: ConversionDraft): Partial<AttemptBody> {
  return {
    ...(draft.type === null ? {} : { type: draft.type }),
    ...(draft.syndicatId === '' ? {} : { syndicatId: draft.syndicatId }),
    ...(draft.banqueId === '' ? {} : { banqueId: draft.banqueId }),
    ...(draft.incomeBandId === '' ? {} : { incomeBandId: draft.incomeBandId }),
    ...(draft.paymentMode === null ? {} : { paymentMode: draft.paymentMode }),
  };
}

function dureesData(draft: ConversionDraft): Partial<AttemptBody> {
  const mois = draft.dureeEtablissementMois.trim();
  const systeme = draft.dureeSystemeMois.trim();
  return {
    ...(systeme === '' ? {} : { dureeSystemeMois: Number(systeme) }),
    ...(mois === '' ? {} : { dureeEtablissementMois: Number(mois) }),
    ...(draft.fonctionnaire === null ? {} : { fonctionnaire: draft.fonctionnaire }),
    ...(draft.engagementEnCours === null ? {} : { engagementEnCours: draft.engagementEnCours }),
  };
}

/**
 * Un champ laissé vide n'est PAS envoyé : le serveur écrirait la chaîne vide
 * sur le prospect, et un formulaire dont la profession n'a pas été demandée
 * effacerait celle que le représentant avait relevée.
 */
function conversionData(draft: ConversionDraft, rendezVousAt: string | null): Partial<AttemptBody> {
  return {
    ...identiteData(draft),
    ...choixData(draft),
    ...dureesData(draft),
    ...whatsappData(draft),
    ...(rendezVousAt === null ? {} : { rendezVousAt }),
    ...(Object.keys(draft.champsLibres).length === 0 ? {} : { champsLibres: draft.champsLibres }),
  };
}

/**
 * Sur « oui » la colonne `whatsappE164` reste nulle : le serveur la recompose
 * depuis le numéro appelé. Sur « non » sans numéro, il retient AUCUN.
 */
function whatsappData(draft: ConversionDraft): Partial<AttemptBody> {
  if (draft.memeWhatsapp === null) return {};
  if (draft.memeWhatsapp) return { whatsappStatus: 'MEME_NUMERO' };
  return { whatsappStatus: 'AUTRE_NUMERO', ...siRempli('whatsappE164', draft.whatsapp) };
}

export interface AttemptDraft {
  readonly outcome: CallOutcome;
  readonly method: EnrollmentMethod | null;
  readonly comment: string;
  readonly callbackAt?: string | null;
  readonly conversion?: ConversionDraft | undefined;
  /** Le rendez-vous déjà converti en instant : la conversion locale reste à l'écran. */
  readonly rendezVousAt?: string | null;
  /** L'ouverture que cette tentative referme, et dont elle arrête le chronomètre. */
  readonly ouvertureId?: string | undefined;
  /** La révision lue : le serveur refuse la tentative si la fiche a bougé depuis. */
  readonly expectedRev?: number | undefined;
}

export function buildAttemptBody(
  prospectId: string,
  draft: AttemptDraft,
  now: number = Date.now(),
): AttemptBody {
  const at = new Date(now).toISOString();
  const comment = draft.comment.trim();
  return {
    id: uuidV7(now),
    prospectId,
    outcome: draft.outcome,
    clientCreatedAt: at,
    ...(draft.method === null ? {} : { method: draft.method }),
    ...(comment === '' ? {} : { comment }),
    ...(draft.callbackAt == null ? {} : { callbackAt: draft.callbackAt }),
    ...(draft.ouvertureId === undefined ? {} : { ouvertureId: draft.ouvertureId }),
    ...(draft.expectedRev === undefined ? {} : { expectedRev: draft.expectedRev }),
    ...(draft.conversion === undefined
      ? {}
      : conversionData(draft.conversion, draft.rendezVousAt ?? null)),
  };
}

export type AttemptResult = Schemas['QualificationCallAttemptOutputBody'];

/** Rejouer le même `id` rend 200 `duplicate` : une reprise après coupure ne double rien. */
export async function pushCallAttempt(body: AttemptBody): Promise<AttemptResult> {
  return unwrap(await apiClient.POST('/api/v1/phase2/call-attempts', { body }));
}
