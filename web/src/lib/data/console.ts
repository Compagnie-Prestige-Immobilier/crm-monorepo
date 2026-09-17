import type { ApiClient, components, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';
import { z } from 'zod';

import { getApiClient } from '@/lib/api/browser';
import type { ChampLibre, ReglageChamp } from '@/lib/data/champs-conversion';
import { PANEL_PAYLOAD_VERSION } from '@/lib/data/statuts-qualification';
import { dakarLocalToIso } from '@/lib/format';
import type {
  RepresentantScriptPatch,
  ScriptedRepresentant,
  WhatsappStatus,
} from '@/lib/data/representants';
import type { RepresentantRelation } from '@/lib/representant-filters';
import { DUREE_ETABLISSEMENT_MAX_MOIS, ENROLLMENT_METHODS } from '@/lib/types';
import type {
  CallOutcome,
  EnrollmentMethod,
  PaymentMode,
  Projet,
  ProspectRow,
  ProspectType,
  RepCallOutcome,
} from '@/lib/types';

export const callbackKeys = {
  root: ['callbacks'] as const,
  list: (scope: CallbackScope, assignedToId: string | null) =>
    ['callbacks', scope, assignedToId] as const,
  teleconseillers: ['callbacks', 'teleconseillers'] as const,
};

export type Callback = components['schemas']['QualificationRappelDTO'];
export type CallbackScope = Exclude<
  NonNullable<operations['listScheduledCallbacks']['parameters']['query']>['scope'],
  undefined
>;

export interface CallbackList {
  readonly items: Callback[];
  readonly serverTime: string;
  /** La liste s'arrête à 500 rappels : le total dit ce qu'elle ne montre pas. */
  readonly total?: number | undefined;
}

/** L'heure promise croissante : le retard étant une heure dépassée, il vient en tête. */
function sortCallbacks(items: readonly Callback[]): Callback[] {
  return [...items].sort((left, right) => {
    if (left.scheduledAt !== right.scheduledAt)
      return left.scheduledAt < right.scheduledAt ? -1 : 1;
    return left.id < right.id ? -1 : 1;
  });
}

export async function fetchCallbacks(
  scope: CallbackScope,
  assignedToId: string | null = null,
  client: ApiClient = getApiClient(),
  projet?: 'CHUES' | 'GRAND_PUBLIC',
): Promise<CallbackList> {
  const list = unwrap(
    await client.GET('/api/v1/phase2/callbacks', {
      params: {
        query: {
          scope,
          ...(assignedToId === null ? {} : { assignedToId }),
          ...(projet ? { projet } : {}),
        },
      },
    }),
  );
  return { items: sortCallbacks(list.items), serverTime: list.serverTime, total: list.total };
}

export async function cancelCallback(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<Callback> {
  return unwrap(
    await client.POST('/api/v1/phase2/callbacks/{id}/cancel', { params: { path: { id } } }),
  );
}

export async function snoozeCallback(id: string): Promise<Callback> {
  const response = await fetch(`/api/v1/phase2/callbacks/${encodeURIComponent(id)}/snooze`, {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error('Le rappel n’a pas pu être reporté.');
  return (await response.json()) as Callback;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Dakar est à UTC+0 toute l'année : les accesseurs UTC SONT l'horloge métier. */
function dakarAt(now: number, plusDays: number, hour: number): number {
  const day = new Date(now);
  day.setUTCDate(day.getUTCDate() + plusDays);
  day.setUTCHours(hour, 0, 0, 0);
  return day.getTime();
}

function daysToMonday(now: number): number {
  const weekday = new Date(now).getUTCDay();
  return weekday === 1 ? 7 : (8 - weekday) % 7;
}

const pad = (value: number): string => String(value).padStart(2, '0');

export function formatCallbackAt(iso: string, now: number): string {
  const at = new Date(iso);
  const clock = `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
  const days = Math.floor((at.getTime() - dakarAt(now, 0, 0)) / DAY_MS);

  if (days === 0) return `aujourd’hui à ${clock}`;
  if (days === 1) return `demain à ${clock}`;
  return `le ${pad(at.getUTCDate())}/${pad(at.getUTCMonth() + 1)} à ${clock}`;
}

export function formatDelay(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)} h`;
  return `${String(Math.floor(hours / 24))} j`;
}

export interface CallbackSlot {
  readonly key: string;
  readonly label: string;
  readonly at: string;
}

/**
 * Zéro saisie : l'échéance se prend au chiffre. Une proposition déjà passée, ou
 * qui tombe à la même heure qu'une précédente, ne s'affiche pas.
 */
export function callbackSlots(now: number): CallbackSlot[] {
  const proposals: readonly (readonly [string, number])[] = [
    ['Dans 1 h', now + HOUR_MS],
    ['Cet après-midi (15 h)', dakarAt(now, 0, 15)],
    ['Demain 9 h', dakarAt(now, 1, 9)],
    ['Demain 15 h', dakarAt(now, 1, 15)],
    ['Lundi 9 h', dakarAt(now, daysToMonday(now), 9)],
    ['Dans 3 jours', dakarAt(now, 3, 9)],
  ];

  const slots: CallbackSlot[] = [];
  for (const [label, at] of proposals) {
    if (at <= now) continue;
    if (slots.some((slot) => Date.parse(slot.at) === at)) continue;
    slots.push({ key: String(slots.length + 1), label, at: new Date(at).toISOString() });
  }
  return slots;
}

/**
 * Les demi-heures ouvrées d'un jour, de 08 h 00 à 19 h 00, celles déjà passées
 * retirées. Même règle et mêmes libellés que `callbackHalfHours` du mobile : un
 * rappel se prend à la demi-heure, jamais à la minute.
 */
export function callbackHalfHours(now: number, day: string): CallbackSlot[] {
  const slots: CallbackSlot[] = [];
  for (let half = 16; half <= 38; half++) {
    const at = Date.parse(
      `${day}T${pad(Math.floor(half / 2))}:${half % 2 === 0 ? '00' : '30'}:00Z`,
    );
    if (Number.isNaN(at) || at <= now) continue;
    const stamp = new Date(at);
    slots.push({
      key: String(slots.length + 1),
      label: `${pad(stamp.getUTCHours())} h ${pad(stamp.getUTCMinutes())}`,
      at: stamp.toISOString(),
    });
  }
  return slots;
}

const COMMENT_MAX_LENGTH = 2_000;
const EMAIL_MAX_LENGTH = 160;
const NAME_MAX_LENGTH = 120;
const DUREE_SYSTEME_MAX_MOIS = 300;

/** Même tolérance que le serveur : le rendez-vous se juge sur l'horodatage terrain. */
const RENDEZ_VOUS_SKEW_MS = 5 * 60_000;

/** Aussi grossier que `EMAIL_PATTERN` côté serveur : refuser ce qui n'est pas une adresse. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

/**
 * Les renseignements recueillis pendant l'appel de conversion (phase 3) : le
 * dossier entier du prospect, corrigeable, plus ce que l'appel apprend. Tout
 * est saisi en texte : les durées et le rendez-vous ne prennent leur type qu'au
 * moment de l'envoi, sinon un champ vidé n'aurait plus de représentation.
 *
 * Sur CHUES le prospect est enseignant : ni situation ni mode de paiement, et
 * l'adhésion exige le dossier complet. Le Grand Public garde ces deux champs.
 */
export interface ConversionDraft {
  readonly projet: Projet;
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

export type ConversionField = Exclude<keyof ConversionDraft, 'projet' | 'champsLibres'>;

export type ConversionErrors = Partial<Record<ConversionField, string>> & {
  readonly libres?: Record<string, string>;
};

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
  method: z.enum(ENROLLMENT_METHODS).nullable(),
  rendezVousAt: z.string(),
  // `.catch` et non `.optional` : un brouillon écrit avant EB-28 n'a pas la clé,
  // et le refuser reviendrait à jeter la saisie que le rappel devait retrouver.
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
 * EB-10 : ce que le rappel retrouve. Un brouillon d'une version antérieure ou
 * abîmé rend un formulaire vide, jamais une erreur : perdre une saisie est
 * fâcheux, ne plus pouvoir rouvrir la fiche l'est davantage.
 */
export function lireBrouillon(draft: unknown): BrouillonRepris {
  const lu = brouillonSchema.safeParse(draft);
  if (!lu.success) return RIEN;
  return { comment: lu.data.comment, conversion: lu.data.conversion ?? null };
}

const texte = z.string().catch('');
const oui = z.boolean().nullable().catch(null);

/** Le script de qualification d'un représentant, réponse par réponse. */
const brouillonRepSchema = z.object({
  resultat: z.enum(['JOIGNABLE', 'INJOIGNABLE']).nullable().catch(null),
  statutId: z.string().nullable().catch(null),
  etablissementConfirme: oui,
  nouvelEtablissement: texte,
  contacte: oui,
  connaitUES: oui,
  syndicatId: z.string().nullable().catch(null),
  ambassadeur: oui,
  memeWhatsapp: oui,
  whatsapp: texte,
  rappelAt: z.string().nullable().catch(null),
  sugPhone: texte,
  sugName: texte,
  sugNote: texte,
  commentaire: texte,
});

export type BrouillonRep = z.infer<typeof brouillonRepSchema>;

const RIEN_REP: BrouillonRep = {
  resultat: null,
  statutId: null,
  etablissementConfirme: null,
  nouvelEtablissement: '',
  contacte: null,
  connaitUES: null,
  syndicatId: null,
  ambassadeur: null,
  memeWhatsapp: null,
  whatsapp: '',
  rappelAt: null,
  sugPhone: '',
  sugName: '',
  sugNote: '',
  commentaire: '',
};

/** Même règle que `lireBrouillon` : un brouillon abîmé rend un script vierge. */
export function lireBrouillonRep(draft: unknown): BrouillonRep {
  const lu = brouillonRepSchema.safeParse(draft);
  return lu.success ? lu.data : RIEN_REP;
}

/** Le formulaire s'ouvre déjà rempli de ce que la fiche sait : on ne redemande rien. */
/** Le dossier d'une fiche qui n'existe pas encore : tout reste à demander. */
export function dossierVide(projet: Projet): ConversionDraft {
  return {
    projet,
    nom: '',
    prenom: '',
    email: '',
    profession: '',
    type: null,
    dureeEtablissementMois: '',
    fonctionnaire: null,
    syndicatId: '',
    banqueId: '',
    engagementEnCours: null,
    incomeBandId: '',
    paymentMode: null,
    dureeSystemeMois: '',
    memeWhatsapp: null,
    whatsapp: '',
    method: null,
    rendezVousAt: '',
    champsLibres: {},
  };
}

export function conversionFrom(
  prospect: ProspectRow,
  method: EnrollmentMethod | null = null,
): ConversionDraft {
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
    method,
    rendezVousAt: '',
    champsLibres: { ...prospect.champsLibres },
  };
}

/**
 * Les identifiants du catalogue serveur : `phoneE164` s'affiche en lecture
 * seule, et le couple WhatsApp y est nommé autrement que dans le brouillon.
 */
export type ChampReglable =
  | Exclude<ConversionField, 'memeWhatsapp' | 'whatsapp'>
  | 'phoneE164'
  | 'whatsappStatus'
  | 'whatsappE164';

/**
 * Les réglages de l'administrateur, appliqués champ par champ : masqué, un
 * champ n'est plus exigé ; sans réglage, la règle du projet reste celle du
 * serveur.
 */
export interface ReglesChamps {
  readonly visible: (champ: ChampReglable, defaut: boolean) => boolean;
  readonly requis: (champ: ChampReglable, defaut: boolean) => boolean;
}

export function reglesChamps(reglages: readonly ReglageChamp[]): ReglesChamps {
  const parChamp = new Map(reglages.map((regle) => [regle.champ, regle]));
  return {
    visible: (champ, defaut) => parChamp.get(champ)?.visible ?? defaut,
    requis: (champ, defaut) => {
      const regle = parChamp.get(champ);
      if (regle === undefined) return defaut;
      return regle.visible && regle.obligatoire;
    },
  };
}

/** Miroir de `normalizeAttempt` pour les renseignements de conversion. */
export function validateConversion(
  draft: ConversionDraft,
  now: number = Date.now(),
  reglages: readonly ReglageChamp[] = [],
  libres: readonly ChampLibre[] = [],
  champsFacultatifs = false,
): ConversionErrors {
  const complet = draft.projet === 'CHUES';
  const configurees = reglesChamps(reglages);
  const regles: ReglesChamps = champsFacultatifs
    ? { visible: configurees.visible, requis: () => false }
    : configurees;
  const manquantes = champsFacultatifs ? {} : libresManquants(draft, libres);
  return {
    ...identiteErreurs(draft, complet, regles),
    ...dossierErreurs(draft, complet, regles),
    ...methodeErreurs(draft, now, regles),
    ...(Object.keys(manquantes).length === 0 ? {} : { libres: manquantes }),
  };
}

function libresManquants(
  draft: ConversionDraft,
  libres: readonly ChampLibre[],
): Record<string, string> {
  const manquants: Record<string, string> = {};
  for (const champ of libres) {
    if (!champ.obligatoire) continue;
    if ((draft.champsLibres[champ.id] ?? '').trim() === '') {
      manquants[champ.id] = `« ${champ.libelle} » est obligatoire.`;
    }
  }
  return manquants;
}

function texteErreur(
  value: string,
  requis: boolean,
  obligatoire: string,
  tropLong: string,
): string | undefined {
  const texteTrim = value.trim();
  if (requis && texteTrim === '') return obligatoire;
  if (texteTrim.length > NAME_MAX_LENGTH) return tropLong;
  return undefined;
}

function emailErreur(value: string, requis: boolean): string | undefined {
  const email = value.trim();
  if (requis && email === '') return 'L’adresse électronique est obligatoire.';
  if (email !== '' && (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email))) {
    return 'Cette adresse électronique n’en est pas une.';
  }
  return undefined;
}

function identiteErreurs(
  draft: ConversionDraft,
  complet: boolean,
  regles: ReglesChamps,
): ConversionErrors {
  const errors: ConversionErrors = {};

  const nomErr = texteErreur(
    draft.nom,
    regles.requis('nom', true),
    'Le nom est obligatoire.',
    'Nom trop long (120 caractères maximum).',
  );
  if (nomErr !== undefined) errors.nom = nomErr;

  const prenomErr = texteErreur(
    draft.prenom,
    regles.requis('prenom', complet),
    'Le prénom est obligatoire.',
    'Prénom trop long (120 caractères maximum).',
  );
  if (prenomErr !== undefined) errors.prenom = prenomErr;

  const professionErr = texteErreur(
    draft.profession,
    regles.requis('profession', complet),
    'La profession est obligatoire.',
    'Profession trop longue (120 caractères maximum).',
  );
  if (professionErr !== undefined) errors.profession = professionErr;

  const emailErr = emailErreur(draft.email, regles.requis('email', false));
  if (emailErr !== undefined) errors.email = emailErr;

  return errors;
}

/** Le dernier membre dit si le champ est obligatoire sur CHUES sans réglage. */
const CHAMPS_DOSSIER: readonly [
  Extract<ConversionField, ChampReglable>,
  (draft: ConversionDraft) => boolean,
  string,
  boolean,
][] = [
  ['fonctionnaire', (draft) => draft.fonctionnaire === null, 'Dites s’il est fonctionnaire.', true],
  ['syndicatId', (draft) => draft.syndicatId === '', 'Choisissez le syndicat.', true],
  ['banqueId', (draft) => draft.banqueId === '', 'Choisissez la banque.', true],
  [
    'engagementEnCours',
    (draft) => draft.engagementEnCours === null,
    'Dites s’il a un engagement en cours à la banque.',
    true,
  ],
  ['incomeBandId', (draft) => draft.incomeBandId === '', 'Choisissez la tranche de revenu.', true],
  ['type', (draft) => draft.type === null, 'Choisissez la situation.', false],
  ['paymentMode', (draft) => draft.paymentMode === null, 'Choisissez le mode de paiement.', false],
];

function dossierObligatoires(
  draft: ConversionDraft,
  complet: boolean,
  regles: ReglesChamps,
): ConversionErrors {
  const errors: ConversionErrors = {};
  for (const [field, manquant, message, surChues] of CHAMPS_DOSSIER) {
    if (regles.requis(field, surChues && complet) && manquant(draft)) errors[field] = message;
  }
  return errors;
}

const chiffres = (value: string): number => value.replace(/\D/gu, '').length;

function dureeErreur(
  value: string,
  requis: boolean,
  min: number,
  max: number,
  obligatoire: string,
  invalide: string,
): string | undefined {
  const duree = value.trim();
  if (requis && duree === '') return obligatoire;
  if (duree === '') return undefined;
  if (!/^\d+$/u.test(duree) || Number(duree) < min || Number(duree) > max) return invalide;
  return undefined;
}

function whatsappDossierErreur(draft: ConversionDraft): string | undefined {
  if (draft.memeWhatsapp !== false) return undefined;
  if (draft.whatsapp.trim() === '') return undefined;
  if (chiffres(draft.whatsapp) >= 9) return undefined;
  return 'Le numéro WhatsApp est incomplet.';
}

function dossierErreurs(
  draft: ConversionDraft,
  complet: boolean,
  regles: ReglesChamps,
): ConversionErrors {
  const errors: ConversionErrors = dossierObligatoires(draft, complet, regles);

  const etablissementErr = dureeErreur(
    draft.dureeEtablissementMois,
    regles.requis('dureeEtablissementMois', complet),
    0,
    DUREE_ETABLISSEMENT_MAX_MOIS,
    'La durée dans la fonction est obligatoire.',
    `La durée s’exprime en mois entiers, de 0 à ${String(DUREE_ETABLISSEMENT_MAX_MOIS)}.`,
  );
  if (etablissementErr !== undefined) errors.dureeEtablissementMois = etablissementErr;

  const systemeErr = dureeErreur(
    draft.dureeSystemeMois,
    regles.requis('dureeSystemeMois', false),
    1,
    DUREE_SYSTEME_MAX_MOIS,
    'Choisissez la durée du système de paiement.',
    `La durée du système s’exprime en mois entiers, de 1 à ${String(DUREE_SYSTEME_MAX_MOIS)}.`,
  );
  if (systemeErr !== undefined) errors.dureeSystemeMois = systemeErr;

  const whatsappErr = whatsappDossierErreur(draft);
  if (whatsappErr !== undefined) errors.whatsapp = whatsappErr;

  return errors;
}

function methodeErreurs(
  draft: ConversionDraft,
  now: number,
  regles: ReglesChamps,
): ConversionErrors {
  const errors: ConversionErrors = {};

  const rendezVous = draft.rendezVousAt.trim();
  if (!regles.visible('rendezVousAt', true)) return errors;
  if (draft.method === 'APPOINTMENT') {
    const iso = dakarLocalToIso(rendezVous);
    if (rendezVous === '') {
      errors.rendezVousAt = 'Le RDV CPI exige la date et l’heure du rendez-vous.';
    } else if (iso === null) {
      errors.rendezVousAt = 'La date du rendez-vous est illisible.';
    } else if (Date.parse(iso) < now - RENDEZ_VOUS_SKEW_MS) {
      errors.rendezVousAt = 'Le rendez-vous ne peut pas précéder l’appel.';
    }
  } else if (rendezVous !== '') {
    errors.rendezVousAt = 'Une date de rendez-vous n’est admise que sur « RDV CPI ».';
  }

  return errors;
}

/**
 * Le serveur répond en 200 avec un code par opération : le refus doit revenir
 * SOUS le champ fautif, sinon la téléconseillère relit tout le formulaire.
 */
const CONVERSION_ERRORS: Readonly<
  Record<string, { readonly field: ConversionField; readonly message: string }>
> = {
  PHASE2_RENDEZ_VOUS_REQUIRED: {
    field: 'rendezVousAt',
    message: 'Le RDV CPI exige la date et l’heure du rendez-vous.',
  },
  PHASE2_RENDEZ_VOUS_NOT_ALLOWED: {
    field: 'rendezVousAt',
    message: 'Une date de rendez-vous n’est admise que sur « RDV CPI ».',
  },
  PHASE2_METHOD_RETIREE: {
    field: 'method',
    message: 'Cette méthode n’existe plus. Choisissez « RDV CPI ».',
  },
  PHASE2_REVENU_REQUIRED: {
    field: 'incomeBandId',
    message: 'Choisissez la tranche de revenu.',
  },
  PHASE2_DUREE_FONCTION_REQUIRED: {
    field: 'dureeEtablissementMois',
    message: 'La durée dans la fonction est obligatoire.',
  },
  PHASE2_RENDEZ_VOUS_INVALID: {
    field: 'rendezVousAt',
    message: 'La date du rendez-vous est illisible.',
  },
  PHASE2_RENDEZ_VOUS_PAST: {
    field: 'rendezVousAt',
    message: 'Le rendez-vous ne peut pas précéder l’appel.',
  },
  PHASE2_EMAIL_INVALID: {
    field: 'email',
    message: 'Cette adresse électronique n’en est pas une.',
  },
  PHASE2_DUREE_ETABLISSEMENT_INVALID: {
    field: 'dureeEtablissementMois',
    message: `La durée s’exprime en mois entiers, de 0 à ${String(DUREE_ETABLISSEMENT_MAX_MOIS)}.`,
  },
};

export function conversionErrorFor(
  code: string,
): { readonly field: ConversionField; readonly message: string } | null {
  return CONVERSION_ERRORS[code] ?? null;
}

export interface AttemptDraft {
  readonly outcome: CallOutcome;
  /** Le motif choisi au référentiel. C'est lui qui commande `outcome`, jamais l'inverse. */
  readonly reasonCode: string;
  readonly method: EnrollmentMethod | null;
  readonly comment: string;
  readonly callbackAt?: string | null;
  readonly conversion?: ConversionDraft;
  /** L'ouverture que cette tentative referme, et dont elle arrête le chronomètre. */
  readonly ouvertureId?: string;
}

function methodeAttemptErreur(draft: AttemptDraft): string | null {
  if (draft.outcome !== 'METHOD_OBTAINED' && draft.method !== null) {
    return 'Une méthode ne s’enregistre que sur « Méthode obtenue ».';
  }
  return null;
}

function callbackAttemptErreur(draft: AttemptDraft, now: number): string | null {
  const callbackAt = draft.callbackAt ?? null;
  if (callbackAt === null) return null;
  if (draft.outcome !== 'CALLBACK') return 'Une échéance ne s’enregistre que sur « À rappeler ».';
  if (!(Date.parse(callbackAt) > now)) return 'Choisissez une échéance à venir.';
  return null;
}

function commentAttemptErreur(draft: AttemptDraft, exigeCommentaire: boolean): string | null {
  const comment = draft.comment.trim();
  if (exigeCommentaire && comment === '') return 'Ce motif exige un commentaire.';
  if (comment.length > COMMENT_MAX_LENGTH) {
    return `Le commentaire dépasse ${String(COMMENT_MAX_LENGTH)} caractères.`;
  }
  return null;
}

/** Miroir de `apps/api/src/modules/phase2/attempt-rules.ts` : un écart sort en 400 sec. */
export function validateAttempt(
  draft: AttemptDraft,
  now: number = Date.now(),
  exigeCommentaire = false,
): string | null {
  const methodeErr = methodeAttemptErreur(draft);
  if (methodeErr !== null) return methodeErr;
  const callbackErr = callbackAttemptErreur(draft, now);
  if (callbackErr !== null) return callbackErr;
  const commentErr = commentAttemptErreur(draft, exigeCommentaire);
  if (commentErr !== null) return commentErr;
  if (draft.conversion !== undefined) {
    const problems = validateConversion(draft.conversion, now, [], [], true);
    return Object.values(problems).find((message) => typeof message === 'string') ?? null;
  }
  return null;
}

/**
 * UUID v7 : les 48 bits de tête portent l'horodatage, ce qui garde les clés
 * ordonnées en base. `crypto.randomUUID` produirait un v4, non ordonné.
 */
export function uuidV7(now: number = Date.now(), random: () => number = Math.random): string {
  const timestamp = Math.floor(now).toString(16).padStart(12, '0').slice(-12);
  const hex = (bits: number): string =>
    Math.floor(random() * 2 ** bits)
      .toString(16)
      .padStart(bits / 4, '0');
  const variant = (8 + Math.floor(random() * 4)).toString(16);

  return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-7${hex(12)}-${variant}${hex(12)}-${hex(48)}`;
}

type SyncPushBody = components['schemas']['SyncPushInputBody'];
type SyncEntityData = Partial<components['schemas']['QualificationCallAttemptBody']>;

function identiteData(draft: ConversionDraft): SyncEntityData {
  const nom = draft.nom.trim();
  const prenom = draft.prenom.trim();
  const email = draft.email.trim();
  const profession = draft.profession.trim();
  return {
    ...(nom === '' ? {} : { nom }),
    ...(prenom === '' ? {} : { prenom }),
    ...(email === '' ? {} : { email }),
    ...(profession === '' ? {} : { profession }),
  };
}

function dossierChoixData(draft: ConversionDraft): SyncEntityData {
  return {
    ...(draft.type === null ? {} : { type: draft.type }),
    ...(draft.syndicatId === '' ? {} : { syndicatId: draft.syndicatId }),
    ...(draft.banqueId === '' ? {} : { banqueId: draft.banqueId }),
    ...(draft.incomeBandId === '' ? {} : { incomeBandId: draft.incomeBandId }),
    ...(draft.paymentMode === null ? {} : { paymentMode: draft.paymentMode }),
  };
}

function dossierDureesData(draft: ConversionDraft): SyncEntityData {
  const mois = draft.dureeEtablissementMois.trim();
  const systeme = draft.dureeSystemeMois.trim();
  return {
    ...(systeme === '' ? {} : { dureeSystemeMois: Number(systeme) }),
    ...(mois === '' ? {} : { dureeEtablissementMois: Number(mois) }),
    ...(draft.fonctionnaire === null ? {} : { fonctionnaire: draft.fonctionnaire }),
    ...(draft.engagementEnCours === null ? {} : { engagementEnCours: draft.engagementEnCours }),
  };
}

function rendezVousData(draft: ConversionDraft): SyncEntityData {
  if (draft.method !== 'APPOINTMENT') return {};
  const rendezVousAt = dakarLocalToIso(draft.rendezVousAt.trim());
  return rendezVousAt === null ? {} : { rendezVousAt };
}

/**
 * Un champ laissé vide n'est PAS envoyé : le serveur écrirait la chaîne vide
 * sur le prospect, et un formulaire dont la profession n'a pas été demandée
 * effacerait celle que le représentant avait relevée.
 */
function conversionData(draft: ConversionDraft): SyncEntityData {
  return {
    ...identiteData(draft),
    ...dossierChoixData(draft),
    ...dossierDureesData(draft),
    ...whatsappData(draft),
    ...rendezVousData(draft),
    ...siRenseignes(draft.champsLibres),
  };
}

/**
 * EB-23. Sur « oui » la colonne `whatsappE164` reste nulle : le serveur la
 * recompose depuis le numéro appelé. Sur « non » sans numéro, il retient AUCUN.
 */
function whatsappData(draft: ConversionDraft): SyncEntityData {
  if (draft.memeWhatsapp === null) return {};
  if (draft.memeWhatsapp) return { whatsappStatus: 'MEME_NUMERO' };

  const numero = draft.whatsapp.trim();
  return {
    whatsappStatus: 'AUTRE_NUMERO',
    ...(numero === '' ? {} : { whatsappE164: numero }),
  };
}

const siRenseignes = (
  champsLibres: Record<string, string>,
): { champsLibres?: Record<string, string> } =>
  Object.keys(champsLibres).length === 0 ? {} : { champsLibres };

export interface AttemptInput {
  readonly prospectId: string;
  readonly draft: AttemptDraft;
  readonly attemptId: string;
  readonly batchId: string;
  readonly at: string;
}

function buildAttemptBatch(input: AttemptInput): SyncPushBody {
  const comment = input.draft.comment.trim();
  const callbackAt = input.draft.callbackAt ?? null;

  return {
    clientBatchId: input.batchId,
    payloadVersion: PANEL_PAYLOAD_VERSION,
    operations: [
      {
        opId: input.attemptId,
        seq: 0,
        entity: 'call_attempt',
        op: 'create',
        entityId: input.attemptId,
        clientUpdatedAt: input.at,
        data: {
          prospectId: input.prospectId,
          outcome: input.draft.outcome,
          reasonCode: input.draft.reasonCode,
          ...(input.draft.method === null ? {} : { method: input.draft.method }),
          ...(comment === '' ? {} : { comment }),
          ...(callbackAt === null ? {} : { callbackAt }),
          ...(input.draft.conversion === undefined ? {} : conversionData(input.draft.conversion)),
          ...(input.draft.ouvertureId === undefined
            ? {}
            : { ouvertureId: input.draft.ouvertureId }),
          clientCreatedAt: input.at,
        },
      },
    ],
  };
}

export function newAttemptInput(
  prospectId: string,
  draft: AttemptDraft,
  now: number = Date.now(),
): AttemptInput {
  return {
    prospectId,
    draft,
    attemptId: uuidV7(now),
    batchId: uuidV7(now),
    at: new Date(now).toISOString(),
  };
}

export class AttemptRefused extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AttemptRefused';
    this.code = code;
  }
}

/**
 * Aucune route HTTP ne consigne un appel de phase 2 : le lot de synchronisation
 * est le seul chemin d'écriture, et il répond 200 même quand l'opération est
 * refusée, le verdict étant dans le corps.
 */
export async function pushCallAttempt(
  input: AttemptInput,
  client: ApiClient = getApiClient(),
): Promise<void> {
  const response = unwrap(
    await client.POST('/api/v1/sync/push', { body: buildAttemptBatch(input) }),
  );

  const result = response.results[0];
  if (result === undefined) {
    throw new AttemptRefused('NO_RESULT', 'Le serveur n’a rien répondu sur cet appel. Réessayez.');
  }
  if (result.status === 'applied' || result.status === 'duplicate') return;

  throw new AttemptRefused(
    result.errorCode ?? 'CALL_ATTEMPT_INVALID',
    result.error ?? 'L’appel n’a pas été enregistré.',
  );
}

/** Une relation tranchée n'a plus rien à donner au script : elle est en queue de file. */
const REP_RELATION_RANK: Record<RepresentantRelation, number> = {
  INCONNU: 0,
  CONTACTE: 1,
  AMBASSADEUR: 2,
  REFUS: 2,
};

export function repRelationSettled(representant: ScriptedRepresentant): boolean {
  return REP_RELATION_RANK[representant.relationStatus] === 2;
}

type RepAttemptBody = components['schemas']['QualificationRepAttemptBody'];

export type RepCallAttemptResult = components['schemas']['QualificationRepAttemptOutputBody'];

/**
 * Une réponse, et une seule. Chaque champ voyage seul pour qu'un appel coupé
 * après « non » laisse quand même le refus en base.
 */
export interface RepAnswer {
  readonly outcome: RepCallOutcome;
  readonly relationStatus?: RepresentantRelation;
  readonly whatsappStatus?: WhatsappStatus;
  readonly whatsappE164?: string;
  readonly profession?: string;
  readonly suggestedName?: string;
  readonly suggestedPhone?: string;
  readonly suggestedNote?: string;
  readonly comment?: string;
  /** Exigée par le serveur pour l'issue CALLBACK, et par elle seule. */
  readonly callbackAt?: string;
  readonly etablissementConfirme?: boolean;
  /** Nouvel établissement, quand `etablissementConfirme` vaut faux. */
  readonly etablissement?: string;
  readonly contacte?: boolean;
  readonly connaitUES?: boolean;
  readonly syndicat?: string;
  /** Statut choisi au script. C'est lui qui commande `outcome`, jamais l'inverse. */
  readonly statutQualificationId?: string;
  /** L'ouverture que cette tentative ferme : c'est elle qui arrête le chronomètre. */
  readonly ouvertureId?: string;
}

export function buildRepAttempt(
  representantId: string,
  answer: RepAnswer,
  now: number = Date.now(),
): RepAttemptBody & RepresentantScriptPatch {
  return {
    ...answer,
    id: uuidV7(now),
    representantId,
    clientCreatedAt: new Date(now).toISOString(),
  };
}

export async function pushRepCallAttempt(
  body: RepAttemptBody & RepresentantScriptPatch,
  client: ApiClient = getApiClient(),
): Promise<RepCallAttemptResult> {
  return unwrap(await client.POST('/api/v1/rep-campaigns/attempts', { body }));
}
