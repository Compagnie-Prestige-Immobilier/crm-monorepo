import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

type Schemas = components['schemas'];

export type CallOutcomeEffect = Schemas['CallOutcomeEffect'];
export type CallOutcomeReason = Schemas['CallOutcomeReasonDto'];
export type CreateCallOutcomeReasonInput = Schemas['CreateCallOutcomeReasonDto'];
export type UpdateCallOutcomeReasonInput = Schemas['UpdateCallOutcomeReasonDto'];

export const CALL_OUTCOME_EFFECTS = [
  'CLOSE_METHOD',
  'CLOSE_REFUSED',
  'CLOSE_WRONG_NUMBER',
  'KEEP_OPEN',
  'SCHEDULE_CALLBACK',
] as const satisfies readonly CallOutcomeEffect[];

export const CALL_OUTCOME_EFFECT_LABELS: Record<CallOutcomeEffect, string> = {
  CLOSE_METHOD: 'Clôt, méthode obtenue',
  CLOSE_REFUSED: 'Clôt, refus',
  CLOSE_WRONG_NUMBER: 'Clôt, faux numéro',
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
