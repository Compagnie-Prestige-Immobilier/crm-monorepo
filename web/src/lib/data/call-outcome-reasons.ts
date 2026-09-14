import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { PANEL_PAYLOAD_VERSION } from '@/lib/data/statuts-qualification';
import type { CallOutcome } from '@/lib/types';

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

/** Ce que l'écran d'appel lit d'un motif ; le reste ne sert qu'à l'administration. */
export interface MotifAppel {
  readonly code: string;
  readonly label: string;
  readonly effect: CallOutcomeEffect;
  readonly requiresComment: boolean;
}

/** Les motifs que l'écran d'appel propose : les actifs, dans l'ordre de l'ADMIN. */
export async function fetchMotifsAppel(client: ApiClient = getApiClient()): Promise<MotifAppel[]> {
  const items = unwrap(
    await client.GET('/api/v1/call-outcome-reasons', {
      params: { query: { payloadVersion: PANEL_PAYLOAD_VERSION } },
    }),
  ).items;
  return items.map((motif) => ({
    code: motif.code,
    label: motif.label,
    effect: motif.effect,
    requiresComment: motif.requiresComment,
  }));
}

/**
 * L'effet commande tout : le groupe où le motif s'affiche et l'issue envoyée.
 * Le serveur refuse une issue qui ne correspond pas à l'effet du motif.
 */
export const EFFET_ISSUE: Readonly<Record<CallOutcomeEffect, CallOutcome>> = {
  CLOSE_METHOD: 'METHOD_OBTAINED',
  CLOSE_REFUSED: 'REFUSED',
  CLOSE_WRONG_NUMBER: 'WRONG_NUMBER',
  SCHEDULE_CALLBACK: 'CALLBACK',
  KEEP_OPEN: 'UNREACHABLE',
};

/**
 * KEEP_OPEN couvre aussi l'appel abouti qui ne tranche rien. Envoyé en
 * UNREACHABLE, « Intéressé » s'afficherait « Injoignable » et sortirait des
 * appels aboutis, que les chiffres comptent par issue. OTHER exige un
 * commentaire en base : son motif le réclame donc aussi.
 */
const ISSUE_DU_CODE: Readonly<Record<string, CallOutcome>> = {
  INTERESSE: 'OTHER',
  DEMANDE_INFORMATIONS: 'OTHER',
  DEMANDE_DEVIS: 'OTHER',
  EN_REFLEXION: 'OTHER',
};

export const issueDuMotif = (motif: Pick<MotifAppel, 'code' | 'effect'>): CallOutcome =>
  ISSUE_DU_CODE[motif.code] ?? EFFET_ISSUE[motif.effect];

/** Le libellé du statut qui réclame un commentaire, nul quand aucun ne le réclame. */
export const commentaireExigePar = (motif: MotifAppel | null): string | null =>
  motif?.requiresComment === true ? motif.label : null;

/** Joignable : on a parlé à la personne, qu'elle adhère ou qu'elle refuse. */
const EFFETS_JOIGNABLE: readonly CallOutcomeEffect[] = ['CLOSE_METHOD', 'CLOSE_REFUSED'];

export const estJoignable = (motif: MotifAppel): boolean => EFFETS_JOIGNABLE.includes(motif.effect);

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
