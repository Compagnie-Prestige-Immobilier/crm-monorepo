import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

type Schemas = components['schemas'];

export type CallOutcomeReason = Schemas['ReferentielsMotif'];
export type CallOutcomeEffect = CallOutcomeReason['effect'];
export type CreateCallOutcomeReasonInput = Schemas['ReferentielsCreerMotifInputBody'];
export type UpdateCallOutcomeReasonInput = Schemas['ReferentielsModifierMotifInputBody'];

export const CALL_OUTCOME_EFFECTS = [
  'CLOSE_METHOD',
  'CLOSE_REFUSED',
  'CLOSE_WRONG_NUMBER',
  'CLOSE_LOST',
  'CLOSE_UNREACHABLE',
  'CLOSE_INTERESTED',
  'CLOSE_HESITANT',
  'CLOSE_APPOINTMENT',
  'CLOSE_REACHED',
  'KEEP_OPEN',
  'SCHEDULE_CALLBACK',
] as const satisfies readonly CallOutcomeEffect[];

export const CALL_OUTCOME_EFFECT_LABELS: Record<CallOutcomeEffect, string> = {
  CLOSE_METHOD: 'Clôt, méthode obtenue',
  CLOSE_REFUSED: 'Clôt, refus',
  CLOSE_WRONG_NUMBER: 'Clôt, faux numéro',
  CLOSE_LOST: 'Clôt, fiche perdue',
  CLOSE_UNREACHABLE: 'Clôt, injoignable',
  CLOSE_INTERESTED: 'Clôt, intéressé',
  CLOSE_HESITANT: 'Clôt, hésitant',
  CLOSE_APPOINTMENT: 'Clôt, rendez-vous daté',
  CLOSE_REACHED: 'Clôt, joint sans suite',
  KEEP_OPEN: 'Laisse le prospect à rappeler',
  SCHEDULE_CALLBACK: 'Planifie un rappel daté',
};

/**
 * Les rôles du design system que l'application de terrain sait peindre. Le
 * serveur accepte n'importe quelle chaîne de 2 à 40 caractères, mais un rôle
 * qu'aucun client ne connaît se rend en gris.
 */
export const CALL_OUTCOME_COLORS = ['success', 'info', 'warning', 'danger', 'neutral'] as const;

export type CallOutcomeColor = (typeof CALL_OUTCOME_COLORS)[number];

export const CALL_OUTCOME_COLOR_LABELS: Record<CallOutcomeColor, string> = {
  success: 'Vert · réussite',
  info: 'Bleu · information',
  warning: 'Orange · vigilance',
  danger: 'Rouge · échec',
  neutral: 'Gris · neutre',
};

export async function fetchCallOutcomeReasons(
  client: ApiClient = getApiClient(),
): Promise<CallOutcomeReason[]> {
  return unwrap(await client.GET('/api/v1/call-outcome-reasons/administration')).items;
}

/** Ce que l'écran d'appel lit d'un motif ; le reste ne sert qu'à l'administration. */
export interface MotifAppel {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly effect: CallOutcomeEffect;
  readonly requiresComment: boolean;
  readonly requiresCallback: boolean;
  readonly countsAsReached: boolean;
  /** Le motif de premier niveau que celui-ci précise. */
  readonly parentId: string | null;
}

/** Les motifs que l'écran d'appel propose : les actifs, dans l'ordre de l'ADMIN. */
export async function fetchMotifsAppel(client: ApiClient = getApiClient()): Promise<MotifAppel[]> {
  const items = unwrap(await client.GET('/api/v1/call-outcome-reasons')).items;
  return items.map((motif) => ({
    id: motif.id,
    code: motif.code,
    label: motif.label,
    effect: motif.effect,
    requiresComment: motif.requiresComment,
    requiresCallback: motif.requiresCallback,
    countsAsReached: motif.countsAsReached,
    parentId: motif.parentId ?? null,
  }));
}

export const motifsRacine = (motifs: readonly MotifAppel[]): MotifAppel[] =>
  motifs.filter((motif) => motif.parentId === null);

export const sousMotifsDe = (motifs: readonly MotifAppel[], parentId: string): MotifAppel[] =>
  motifs.filter((motif) => motif.parentId === parentId);

export const planifieUneDate = (effect: CallOutcomeEffect): boolean =>
  effect === 'SCHEDULE_CALLBACK' || effect === 'CLOSE_APPOINTMENT';

/** Le libellé du statut qui réclame un commentaire, nul quand aucun ne le réclame. */
export const commentaireExigePar = (motif: MotifAppel | null): string | null =>
  motif?.requiresComment === true ? motif.label : null;

export const estJoignable = (motif: MotifAppel): boolean => motif.countsAsReached;

export async function createCallOutcomeReason(
  input: CreateCallOutcomeReasonInput,
  client: ApiClient = getApiClient(),
): Promise<CallOutcomeReason> {
  return unwrap(await client.POST('/api/v1/call-outcome-reasons', { body: input }));
}

export async function updateCallOutcomeReason(
  id: string,
  patch: UpdateCallOutcomeReasonInput,
  client: ApiClient = getApiClient(),
): Promise<CallOutcomeReason> {
  return unwrap(
    await client.PATCH('/api/v1/call-outcome-reasons/{id}', {
      params: { path: { id } },
      body: patch,
    }),
  );
}

export async function setCallOutcomeReasonActive(
  id: string,
  isActive: boolean,
  client: ApiClient = getApiClient(),
): Promise<CallOutcomeReason> {
  return unwrap(
    await client.POST('/api/v1/call-outcome-reasons/{id}/active', {
      params: { path: { id } },
      body: { isActive },
    }),
  );
}
