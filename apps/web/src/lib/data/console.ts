import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { dakarLocalToIso } from '@/lib/format';
import {
  fetchRepresentants,
  type RepresentantScriptPatch,
  type ScriptedRepresentant,
  type WhatsappStatus,
} from '@/lib/data/representants';
import { EMPTY_REPRESENTANT_FILTERS, type RepresentantRelation } from '@/lib/representant-filters';
import type {
  CallOutcome,
  EnrollmentMethod,
  PaymentMode,
  Projet,
  ProspectRow,
  ProspectType,
} from '@/lib/types';

export const callbackKeys = {
  root: ['callbacks'] as const,
  list: (scope: CallbackScope, assignedToId: string | null) =>
    ['callbacks', scope, assignedToId] as const,
  teleconseillers: ['callbacks', 'teleconseillers'] as const,
};

export type Callback = components['schemas']['CallbackDto'];
export type CallbackScope = components['schemas']['CallbackScope'];

export interface CallbackList {
  readonly items: Callback[];
  readonly serverTime: string;
}

/** L'heure promise croissante : le retard étant une heure dépassée, il vient en tête. */
export function sortCallbacks(items: readonly Callback[]): Callback[] {
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
  return { items: sortCallbacks(list.items), serverTime: list.serverTime };
}

export async function cancelCallback(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<Callback> {
  return unwrap(
    await client.POST('/api/v1/phase2/callbacks/{id}/cancel', { params: { path: { id } } }),
  );
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

export const COMMENT_MAX_LENGTH = 2_000;
export const EMAIL_MAX_LENGTH = 160;
export const NAME_MAX_LENGTH = 120;
export const DUREE_ETABLISSEMENT_MAX_MOIS = 600;
export const DUREE_SYSTEME_MAX_MOIS = 300;

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
  readonly method: EnrollmentMethod | null;
  readonly rendezVousAt: string;
}

export type ConversionField = Exclude<keyof ConversionDraft, 'projet'>;
export type ConversionErrors = Partial<Record<ConversionField, string>>;

/** Le formulaire s'ouvre déjà rempli de ce que la fiche sait : on ne redemande rien. */
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
    method,
    rendezVousAt: '',
  };
}

/** Miroir de `normalizeAttempt` pour les renseignements de conversion. */
export function validateConversion(
  draft: ConversionDraft,
  now: number = Date.now(),
): ConversionErrors {
  const errors: ConversionErrors = {};
  const complet = draft.projet === 'CHUES';

  const nom = draft.nom.trim();
  if (nom === '') errors.nom = 'Le nom est obligatoire.';
  else if (nom.length > NAME_MAX_LENGTH) errors.nom = 'Nom trop long (120 caractères maximum).';

  const prenom = draft.prenom.trim();
  if (complet && prenom === '') errors.prenom = 'Le prénom est obligatoire.';
  else if (prenom.length > NAME_MAX_LENGTH) {
    errors.prenom = 'Prénom trop long (120 caractères maximum).';
  }

  const profession = draft.profession.trim();
  if (complet && profession === '') errors.profession = 'La profession est obligatoire.';
  else if (profession.length > NAME_MAX_LENGTH) {
    errors.profession = 'Profession trop longue (120 caractères maximum).';
  }

  const email = draft.email.trim();
  if (email !== '' && (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email))) {
    errors.email = 'Cette adresse électronique n’en est pas une.';
  }

  const mois = draft.dureeEtablissementMois.trim();
  if (complet && mois === '') {
    errors.dureeEtablissementMois = 'La durée dans l’établissement est obligatoire.';
  } else if (mois !== '' && (!/^\d+$/u.test(mois) || Number(mois) > DUREE_ETABLISSEMENT_MAX_MOIS)) {
    errors.dureeEtablissementMois = `La durée s’exprime en mois entiers, de 0 à ${String(DUREE_ETABLISSEMENT_MAX_MOIS)}.`;
  }

  if (complet && draft.fonctionnaire === null)
    errors.fonctionnaire = 'Dites s’il est fonctionnaire.';
  if (complet && draft.syndicatId === '') errors.syndicatId = 'Choisissez le syndicat.';
  if (complet && draft.banqueId === '') errors.banqueId = 'Choisissez la banque.';
  if (complet && draft.engagementEnCours === null) {
    errors.engagementEnCours = 'Dites s’il a un engagement en cours à la banque.';
  }
  if (complet && draft.incomeBandId === '')
    errors.incomeBandId = 'Choisissez la tranche de revenu.';

  const systeme = draft.dureeSystemeMois.trim();
  if (complet && systeme === '') {
    errors.dureeSystemeMois = 'Choisissez la durée du système de paiement.';
  } else if (
    systeme !== '' &&
    (!/^\d+$/u.test(systeme) || Number(systeme) < 1 || Number(systeme) > DUREE_SYSTEME_MAX_MOIS)
  ) {
    errors.dureeSystemeMois = `La durée du système s’exprime en mois entiers, de 1 à ${String(DUREE_SYSTEME_MAX_MOIS)}.`;
  }

  if (draft.method === null) errors.method = 'Choisissez la méthode d’enrôlement.';

  const rendezVous = draft.rendezVousAt.trim();
  if (draft.method === 'APPOINTMENT') {
    const iso = dakarLocalToIso(rendezVous);
    if (rendezVous === '') {
      errors.rendezVousAt = 'La prise de rendez-vous exige la date du rendez-vous.';
    } else if (iso === null) {
      errors.rendezVousAt = 'La date du rendez-vous est illisible.';
    } else if (Date.parse(iso) < now - RENDEZ_VOUS_SKEW_MS) {
      errors.rendezVousAt = 'Le rendez-vous ne peut pas précéder l’appel.';
    }
  } else if (rendezVous !== '') {
    errors.rendezVousAt = 'Une date de rendez-vous n’est admise que sur « Prise de rendez-vous ».';
  }

  return errors;
}

/**
 * Le serveur répond en 200 avec un code par opération : le refus doit revenir
 * SOUS le champ fautif, sinon la téléconseillère relit tout le formulaire.
 */
export const CONVERSION_ERRORS: Readonly<
  Record<string, { readonly field: ConversionField; readonly message: string }>
> = {
  PHASE2_RENDEZ_VOUS_REQUIRED: {
    field: 'rendezVousAt',
    message: 'La prise de rendez-vous exige la date du rendez-vous.',
  },
  PHASE2_RENDEZ_VOUS_NOT_ALLOWED: {
    field: 'rendezVousAt',
    message: 'Une date de rendez-vous n’est admise que sur « Prise de rendez-vous ».',
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
  readonly method: EnrollmentMethod | null;
  readonly comment: string;
  readonly callbackAt?: string | null;
  readonly conversion?: ConversionDraft;
}

/** Miroir de `apps/api/src/modules/phase2/attempt-rules.ts` : un écart sort en 400 sec. */
export function validateAttempt(draft: AttemptDraft, now: number = Date.now()): string | null {
  const comment = draft.comment.trim();
  const callbackAt = draft.callbackAt ?? null;

  if (draft.outcome === 'METHOD_OBTAINED' && draft.method === null) {
    return 'Choisissez la méthode obtenue.';
  }
  if (draft.outcome !== 'METHOD_OBTAINED' && draft.method !== null) {
    return 'Une méthode ne s’enregistre que sur « Méthode obtenue ».';
  }
  if (callbackAt !== null && draft.outcome !== 'CALLBACK') {
    return 'Une échéance ne s’enregistre que sur « À rappeler ».';
  }
  if (callbackAt !== null && !(Date.parse(callbackAt) > now)) {
    return 'Choisissez une échéance à venir.';
  }
  if (draft.outcome === 'OTHER' && comment === '') {
    return 'L’issue « Autre » exige un commentaire.';
  }
  if (comment.length > COMMENT_MAX_LENGTH) {
    return `Le commentaire dépasse ${String(COMMENT_MAX_LENGTH)} caractères.`;
  }
  if (draft.conversion !== undefined) {
    return Object.values(validateConversion(draft.conversion, now))[0] ?? null;
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

type SyncPushBody = components['schemas']['SyncPushDto'];
type SyncEntityData = components['schemas']['SyncEntityDataDto'];

/**
 * Un champ laissé vide n'est PAS envoyé : le serveur écrirait la chaîne vide
 * sur le prospect, et un formulaire dont la profession n'a pas été demandée
 * effacerait celle que le représentant avait relevée.
 */
function conversionData(draft: ConversionDraft): SyncEntityData {
  const nom = draft.nom.trim();
  const prenom = draft.prenom.trim();
  const email = draft.email.trim();
  const profession = draft.profession.trim();
  const mois = draft.dureeEtablissementMois.trim();
  const systeme = draft.dureeSystemeMois.trim();
  const rendezVousAt =
    draft.method === 'APPOINTMENT' ? dakarLocalToIso(draft.rendezVousAt.trim()) : null;

  return {
    ...(nom === '' ? {} : { nom }),
    ...(prenom === '' ? {} : { prenom }),
    ...(email === '' ? {} : { email }),
    ...(profession === '' ? {} : { profession }),
    ...(draft.type === null ? {} : { type: draft.type }),
    ...(draft.syndicatId === '' ? {} : { syndicatId: draft.syndicatId }),
    ...(draft.banqueId === '' ? {} : { banqueId: draft.banqueId }),
    ...(draft.incomeBandId === '' ? {} : { incomeBandId: draft.incomeBandId }),
    ...(draft.paymentMode === null ? {} : { paymentMode: draft.paymentMode }),
    ...(systeme === '' ? {} : { dureeSystemeMois: Number(systeme) }),
    ...(mois === '' ? {} : { dureeEtablissementMois: Number(mois) }),
    ...(draft.fonctionnaire === null ? {} : { fonctionnaire: draft.fonctionnaire }),
    ...(draft.engagementEnCours === null ? {} : { engagementEnCours: draft.engagementEnCours }),
    ...(rendezVousAt === null ? {} : { rendezVousAt }),
  };
}

export interface AttemptInput {
  readonly prospectId: string;
  readonly draft: AttemptDraft;
  readonly attemptId: string;
  readonly batchId: string;
  readonly at: string;
}

export function buildAttemptBatch(input: AttemptInput): SyncPushBody {
  const comment = input.draft.comment.trim();
  const callbackAt = input.draft.callbackAt ?? null;

  return {
    clientBatchId: input.batchId,
    payloadVersion: 1,
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
          ...(input.draft.method === null ? {} : { method: input.draft.method }),
          ...(comment === '' ? {} : { comment }),
          ...(callbackAt === null ? {} : { callbackAt }),
          ...(input.draft.conversion === undefined ? {} : conversionData(input.draft.conversion)),
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

export const ALREADY_COMPLETED = 'PHASE2_ALREADY_COMPLETED';

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
    await client.POST('/api/v1/sync/push', {
      params: { header: { 'Idempotency-Key': input.batchId } },
      body: buildAttemptBatch(input),
    }),
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

export const REP_QUEUE_SIZE = 200;

export const repScriptKeys = {
  root: ['console', 'representants'] as const,
  queue: ['console', 'representants', 'queue'] as const,
};

export interface RepScriptPage {
  readonly items: ScriptedRepresentant[];
  readonly total: number;
}

export async function fetchRepScriptQueue(
  client: ApiClient = getApiClient(),
): Promise<RepScriptPage> {
  const page = await fetchRepresentants(
    { ...EMPTY_REPRESENTANT_FILTERS, pageSize: REP_QUEUE_SIZE, sortDir: 'asc' },
    client,
  );
  return { items: page.items, total: page.total };
}

/** Une relation tranchée n'a plus rien à donner au script : elle passe en queue de file. */
const REP_RELATION_RANK: Record<RepresentantRelation, number> = {
  INCONNU: 0,
  CONTACTE: 1,
  AMBASSADEUR: 2,
  REFUS: 2,
};

export function repRelationSettled(representant: ScriptedRepresentant): boolean {
  return REP_RELATION_RANK[representant.relationStatus] === 2;
}

export function buildRepQueue(items: readonly ScriptedRepresentant[]): ScriptedRepresentant[] {
  return [...items].sort((left, right) => {
    const gap = REP_RELATION_RANK[left.relationStatus] - REP_RELATION_RANK[right.relationStatus];
    if (gap !== 0) return gap;
    if (left.clientCreatedAt !== right.clientCreatedAt) {
      return left.clientCreatedAt < right.clientCreatedAt ? -1 : 1;
    }
    return left.id < right.id ? -1 : 1;
  });
}

export type RepCallOutcome = components['schemas']['RepCallOutcome'];

type RepAttemptBody = components['schemas']['CreateRepCallAttemptDto'];

export type RepCallAttemptResult = components['schemas']['RepCallAttemptResultDto'];

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
