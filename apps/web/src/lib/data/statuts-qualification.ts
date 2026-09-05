import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

type Schemas = components['schemas'];

export type StatutQualificationEffect = Schemas['StatutQualificationEffect'];
export type PrioriteTraitement = Schemas['PrioriteTraitement'];
export type StatutQualification = Schemas['StatutQualificationDto'];
export type CreateStatutQualificationInput = Schemas['CreateStatutQualificationDto'];
export type UpdateStatutQualificationInput = Schemas['UpdateStatutQualificationDto'];

/**
 * Version de charge utile du PANEL. Le serveur ne sert que les statuts qu'un
 * appelant de cette version sait renvoyer ; le panel les sait tous, mais il
 * déclare quand même la sienne, comme le fera le terrain.
 */
export const PANEL_PAYLOAD_VERSION = 7;

export const STATUT_QUALIFICATION_EFFECTS = [
  'REACHED',
  'REFUSED',
  'SCHEDULE_CALLBACK',
  'UNREACHABLE',
  'WRONG_NUMBER',
] as const satisfies readonly StatutQualificationEffect[];

export const STATUT_QUALIFICATION_EFFECT_LABELS: Record<StatutQualificationEffect, string> = {
  REACHED: 'Appel abouti',
  REFUSED: 'Appel abouti, refus',
  SCHEDULE_CALLBACK: 'Appel abouti, rappel daté',
  UNREACHABLE: 'Appel non abouti',
  WRONG_NUMBER: 'Appel abouti, mauvais numéro',
};

/** Du plus urgent au moins urgent : le serveur trie l'annuaire dans cet ordre. */
export const PRIORITES_TRAITEMENT = [
  'HAUTE',
  'NORMALE',
  'BASSE',
] as const satisfies readonly PrioriteTraitement[];

export const PRIORITE_TRAITEMENT_LABELS: Record<PrioriteTraitement, string> = {
  HAUTE: 'Haute',
  NORMALE: 'Normale',
  BASSE: 'Basse',
};

/**
 * La relation que le statut pose sur la fiche, nulle quand il ne tranche rien.
 * Le serveur ne l'applique que si le client ne répond pas lui-même à la
 * question.
 */
export type StatutRelationPosee = StatutQualification['relationStatus'];

/**
 * La branche du script où le statut se propose, DÉDUITE de l'effet. Le serveur
 * fait la même déduction : une colonne « joignable » divergerait de l'effet à
 * la première correction.
 */
const ABOUTI: readonly StatutQualificationEffect[] = [
  'REACHED',
  'REFUSED',
  'SCHEDULE_CALLBACK',
  'WRONG_NUMBER',
];

export const estAbouti = (effect: StatutQualificationEffect): boolean => ABOUTI.includes(effect);

export const statutsDeLaBranche = (
  statuts: readonly StatutQualification[],
  abouti: boolean,
): StatutQualification[] => statuts.filter((statut) => estAbouti(statut.effect) === abouti);

/**
 * En base, le libellé porte sa famille parce qu'il y est unique. À l'écran,
 * l'en-tête de branche la dit déjà.
 */
const LIBELLES_ABREGES: Record<string, string> = {
  AUTRE_JOINT: 'Autre',
  AUTRE_NON_JOINT: 'Autre',
};

export const libelleStatut = (statut: Pick<StatutQualification, 'code' | 'label'>): string =>
  LIBELLES_ABREGES[statut.code] ?? statut.label;

/**
 * Le statut réclame un motif écrit. Le client généré est encore en retard sur
 * la colonne : sans elle, aucun statut n'en exige.
 */
export const exigeMotif = (statut: StatutQualification): boolean =>
  (statut as { requiresComment?: boolean }).requiresComment === true;

/** Les deux statuts que la question du script pose seule : ils ne se choisissent plus. */
export const STATUTS_DE_LA_QUESTION = { oui: 'ACCEPTE', non: 'REFUSE' } as const;

export const statutDuSouhait = (
  statuts: readonly StatutQualification[],
  souhaite: boolean | null,
): StatutQualification | null => {
  if (souhaite === null) return null;
  const code = souhaite ? STATUTS_DE_LA_QUESTION.oui : STATUTS_DE_LA_QUESTION.non;
  return statuts.find((statut) => statut.code === code) ?? null;
};

/**
 * La réponse que ce statut vaut, nulle quand il ne répond pas à la question.
 * Le serveur refuse une relation qui contredit le statut pose
 * (`REP_RELATION_STATUT_MISMATCH`) : choisir le statut doit donc poser la
 * réponse, jamais la laisser diverger.
 */
export const souhaitDuStatut = (
  statut: Pick<StatutQualification, 'code'> | null,
): boolean | null => {
  if (statut === null) return null;
  if (statut.code === STATUTS_DE_LA_QUESTION.oui) return true;
  if (statut.code === STATUTS_DE_LA_QUESTION.non) return false;
  return null;
};

/** Vocabulaire de SAISIE : actifs seulement, servis dans l'ordre dicté. */
export async function fetchStatutsQualification(
  client: ApiClient = getApiClient(),
): Promise<StatutQualification[]> {
  return unwrap(
    await client.GET('/api/v1/statuts-qualification', {
      params: { query: { payloadVersion: PANEL_PAYLOAD_VERSION } },
    }),
  ).items;
}

/** Vocabulaire d'ADMINISTRATION : tout, désactivés compris. */
export async function fetchAllStatutsQualification(
  client: ApiClient = getApiClient(),
): Promise<StatutQualification[]> {
  return unwrap(await client.GET('/api/v1/statuts-qualification/administration')).items;
}

export async function createStatutQualification(
  input: CreateStatutQualificationInput,
  client: ApiClient = getApiClient(),
): Promise<StatutQualification> {
  return unwrap(await client.POST('/api/v1/statuts-qualification', { body: input }));
}

export async function updateStatutQualification(
  id: string,
  patch: UpdateStatutQualificationInput,
  client: ApiClient = getApiClient(),
): Promise<StatutQualification> {
  return unwrap(
    await client.PATCH('/api/v1/statuts-qualification/{id}', {
      params: { path: { id } },
      body: patch,
    }),
  );
}

export async function setStatutQualificationActive(
  id: string,
  isActive: boolean,
  client: ApiClient = getApiClient(),
): Promise<StatutQualification> {
  return unwrap(
    await client.POST('/api/v1/statuts-qualification/{id}/active', {
      params: { path: { id } },
      body: { isActive },
    }),
  );
}
