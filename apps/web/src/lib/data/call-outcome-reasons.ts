import type { ApiClient } from '@crm/api-client';
import { unwrap, type ApiResult } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

export const CALL_OUTCOME_EFFECTS = [
  'CLOSE_METHOD',
  'CLOSE_REFUSED',
  'CLOSE_WRONG_NUMBER',
  'KEEP_OPEN',
  'SCHEDULE_CALLBACK',
] as const;

export type CallOutcomeEffect = (typeof CALL_OUTCOME_EFFECTS)[number];

export const CALL_OUTCOME_EFFECT_LABELS: Record<CallOutcomeEffect, string> = {
  CLOSE_METHOD: 'Clôt, méthode obtenue',
  CLOSE_REFUSED: 'Clôt, refus',
  CLOSE_WRONG_NUMBER: 'Clôt, faux numéro',
  KEEP_OPEN: 'Laisse le prospect à rappeler',
  SCHEDULE_CALLBACK: 'Planifie un rappel daté',
};

export interface CallOutcomeReason {
  id: string;
  code: string;
  label: string;
  effect: CallOutcomeEffect;
  requiresComment: boolean;
  requiresCallback: boolean;
  countsAsReached: boolean;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  color: string | null;
  minPayloadVersion: number;
  updatedAt: string;
}

export interface CreateCallOutcomeReasonInput {
  code: string;
  label: string;
  effect: CallOutcomeEffect;
  requiresComment?: boolean;
  requiresCallback?: boolean;
  countsAsReached?: boolean;
  sortOrder?: number;
}

export interface UpdateCallOutcomeReasonInput {
  label?: string;
  sortOrder?: number;
  requiresComment?: boolean;
  requiresCallback?: boolean;
  countsAsReached?: boolean;
}

/**
 * Routes absentes du client généré : `pnpm codegen` n'a pas encore tourné sur
 * le modèle `CallOutcomeReason`. Ce port disparaît à la régénération.
 */
interface UncodegennedClient {
  GET: (path: string) => Promise<ApiResult<unknown, unknown>>;
  POST: (path: string, init: { body: unknown }) => Promise<ApiResult<unknown, unknown>>;
  PATCH: (path: string, init: { body: unknown }) => Promise<ApiResult<unknown, unknown>>;
}

const raw = (client: ApiClient): UncodegennedClient => client as unknown as UncodegennedClient;

const BASE = '/api/v1/call-outcome-reasons';

export async function fetchCallOutcomeReasons(
  client: ApiClient = getApiClient(),
): Promise<CallOutcomeReason[]> {
  const result = unwrap(await raw(client).GET(`${BASE}/administration`)) as {
    items: CallOutcomeReason[];
  };
  return result.items;
}

export async function createCallOutcomeReason(
  input: CreateCallOutcomeReasonInput,
  client: ApiClient = getApiClient(),
): Promise<CallOutcomeReason> {
  return unwrap(await raw(client).POST(BASE, { body: input })) as CallOutcomeReason;
}

export async function updateCallOutcomeReason(
  id: string,
  patch: UpdateCallOutcomeReasonInput,
  client: ApiClient = getApiClient(),
): Promise<CallOutcomeReason> {
  return unwrap(await raw(client).PATCH(`${BASE}/${id}`, { body: patch })) as CallOutcomeReason;
}

export async function setCallOutcomeReasonActive(
  id: string,
  isActive: boolean,
  client: ApiClient = getApiClient(),
): Promise<CallOutcomeReason> {
  return unwrap(
    await raw(client).POST(`${BASE}/${id}/active`, { body: { isActive } }),
  ) as CallOutcomeReason;
}
