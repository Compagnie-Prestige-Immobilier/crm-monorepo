import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import { toBankCaseQuery, toBankFilterQuery, type BankCaseFilters } from '@/lib/bank-filters';
import type {
  BankCase,
  BankCaseAnalytics,
  BankCaseDetail,
  BankCaseStage,
  BankProspectSearchItem,
  BankRejectionReason,
  CreateBankCaseInput,
  Paginated,
} from '@/lib/types';

/**
 * Banque & Finance — dossiers, étapes, motifs de rejet, agrégats.
 *
 * Deux invariants du contrat sont respectés ici sans exception :
 *
 *  1. TOUT montant reste une chaîne. Aucune fonction de ce module ne fait
 *     `Number(amountXof)` — voir `lib/money.ts` pour ce que coûterait l'inverse.
 *  2. Toute écriture porte `expectedRev`. L'API répond 409 si le dossier a
 *     bougé entre-temps, et c'est ce qui empêche deux agents de faire avancer
 *     le même dossier de deux étapes en croyant chacun l'avoir avancé d'une.
 */

export async function fetchBankCases(
  filters: BankCaseFilters,
  client: ApiClient = getApiClient(),
): Promise<Paginated<BankCase>> {
  return flattenPage(
    unwrap(await client.GET('/api/v1/bank-cases', { params: { query: toBankCaseQuery(filters) } })),
  );
}

export async function fetchBankCase(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<BankCaseDetail> {
  return unwrap(await client.GET('/api/v1/bank-cases/{id}', { params: { path: { id } } }));
}

export async function fetchBankAnalytics(
  filters: BankCaseFilters,
  client: ApiClient = getApiClient(),
): Promise<BankCaseAnalytics> {
  return unwrap(
    await client.GET('/api/v1/bank-cases/analytics', {
      params: { query: { ...toBankFilterQuery(filters), granularity: 'day' } },
    }),
  );
}

export async function fetchBankStages(
  includeInactive: boolean,
  client: ApiClient = getApiClient(),
): Promise<BankCaseStage[]> {
  return unwrap(
    await client.GET('/api/v1/bank-case-stages', { params: { query: { includeInactive } } }),
  ).items;
}

export async function fetchRejectionReasons(
  client: ApiClient = getApiClient(),
): Promise<BankRejectionReason[]> {
  return unwrap(
    await client.GET('/api/v1/bank-cases/rejection-reasons', {
      params: { query: { includeInactive: false } },
    }),
  ).items;
}

/**
 * Autocomplétion client. L'API n'accepte qu'à partir de deux caractères ; on
 * renvoie une liste vide en deçà plutôt que de provoquer un 400 à chaque
 * première frappe.
 */
export async function searchBankProspects(
  q: string,
  client: ApiClient = getApiClient(),
): Promise<BankProspectSearchItem[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  return unwrap(
    await client.GET('/api/v1/bank-cases/prospect-search', {
      params: { query: { q: term, pageSize: 20 } },
    }),
  ).items;
}

export async function createBankCase(
  input: CreateBankCaseInput,
  client: ApiClient = getApiClient(),
): Promise<BankCase> {
  return unwrap(await client.POST('/api/v1/bank-cases', { body: input }));
}

export interface UpdateBankCaseInput {
  expectedRev: number;
  reference?: string | undefined;
  processingBankId?: string | undefined;
}

export async function updateBankCase(
  id: string,
  input: UpdateBankCaseInput,
  client: ApiClient = getApiClient(),
): Promise<BankCase> {
  const body: { expectedRev: number; reference?: string; processingBankId?: string } = {
    expectedRev: input.expectedRev,
  };
  if (input.reference !== undefined) body.reference = input.reference;
  if (input.processingBankId !== undefined) body.processingBankId = input.processingBankId;

  return unwrap(await client.PATCH('/api/v1/bank-cases/{id}', { params: { path: { id } }, body }));
}

export interface TransitionInput {
  targetStageId: string;
  expectedRev: number;
  /** Chaîne de chiffres. Exigé vers l'encaissement, interdit ailleurs. */
  amountXof?: string | undefined;
  rejectionReasonId?: string | undefined;
  rejectionDetail?: string | undefined;
  comment?: string | undefined;
}

/**
 * `exactOptionalPropertyTypes` : une clé présente avec `undefined` n'est PAS
 * une clé absente. `amountXof: undefined` posté vers une étape ouverte
 * déclencherait `BANK_CASE_AMOUNT_NOT_ALLOWED` alors que l'agent n'a rien
 * saisi.
 */
function toTransitionBody(input: TransitionInput): {
  targetStageId: string;
  expectedRev: number;
  amountXof?: string;
  rejectionReasonId?: string;
  rejectionDetail?: string;
  comment?: string;
} {
  const body: ReturnType<typeof toTransitionBody> = {
    targetStageId: input.targetStageId,
    expectedRev: input.expectedRev,
  };
  if (input.amountXof !== undefined && input.amountXof !== '') body.amountXof = input.amountXof;
  if (input.rejectionReasonId !== undefined) body.rejectionReasonId = input.rejectionReasonId;
  if (input.rejectionDetail !== undefined && input.rejectionDetail.trim() !== '') {
    body.rejectionDetail = input.rejectionDetail.trim();
  }
  if (input.comment !== undefined && input.comment.trim() !== '') {
    body.comment = input.comment.trim();
  }
  return body;
}

export async function createBankCaseTransition(
  id: string,
  input: TransitionInput,
  client: ApiClient = getApiClient(),
): Promise<BankCaseDetail> {
  return unwrap(
    await client.POST('/api/v1/bank-cases/{id}/transitions', {
      params: { path: { id } },
      body: toTransitionBody(input),
    }),
  );
}

/** Correction d'un dossier terminal. ADMIN seulement ; justification obligatoire. */
export async function createBankCaseCorrection(
  id: string,
  input: TransitionInput & { reason: string },
  client: ApiClient = getApiClient(),
): Promise<BankCaseDetail> {
  return unwrap(
    await client.POST('/api/v1/bank-cases/{id}/corrections', {
      params: { path: { id } },
      body: { ...toTransitionBody(input), reason: input.reason.trim() },
    }),
  );
}

// ─── Configuration des étapes (ADMIN) ───────────────────────────────────────

export interface CreateStageInput {
  code: string;
  label: string;
  color: string;
  position?: number | undefined;
}

export async function createBankStage(
  input: CreateStageInput,
  client: ApiClient = getApiClient(),
): Promise<BankCaseStage> {
  const body: { code: string; label: string; color: string; position?: number } = {
    code: input.code,
    label: input.label,
    color: input.color,
  };
  if (input.position !== undefined) body.position = input.position;
  return unwrap(await client.POST('/api/v1/bank-case-stages', { body }));
}

export async function updateBankStage(
  id: string,
  patch: { label?: string | undefined; color?: string | undefined },
  client: ApiClient = getApiClient(),
): Promise<BankCaseStage> {
  const body: { label?: string; color?: string } = {};
  if (patch.label !== undefined) body.label = patch.label;
  if (patch.color !== undefined) body.color = patch.color;
  return unwrap(
    await client.PATCH('/api/v1/bank-case-stages/{id}', { params: { path: { id } }, body }),
  );
}

/**
 * Réordonnancement. L'API attend la liste COMPLÈTE des étapes ouvertes —
 * actives comme inactives — l'initiale en tête. Envoyer une liste partielle
 * renvoie `BANK_STAGE_REORDER_INCOMPLETE`.
 */
export async function reorderBankStages(
  stageIds: string[],
  client: ApiClient = getApiClient(),
): Promise<BankCaseStage[]> {
  return unwrap(await client.POST('/api/v1/bank-case-stages/reorder', { body: { stageIds } }))
    .items;
}

export async function setBankStageActive(
  id: string,
  isActive: boolean,
  client: ApiClient = getApiClient(),
): Promise<BankCaseStage> {
  return unwrap(
    await client.POST('/api/v1/bank-case-stages/{id}/active', {
      params: { path: { id } },
      body: { isActive },
    }),
  );
}

// ─── Dérivations d'écran ────────────────────────────────────────────────────

const byPosition = (a: BankCaseStage, b: BankCaseStage): number =>
  a.position - b.position || a.id.localeCompare(b.id);

/** Étapes ouvertes ET actives, dans l'ordre du flux. */
export function activeOpenStages(stages: readonly BankCaseStage[]): BankCaseStage[] {
  return stages.filter((stage) => stage.isActive && stage.type === 'OPEN').sort(byPosition);
}

/** Toutes les étapes ouvertes, actives ou non — l'ordre que `reorder` attend. */
export function allOpenStages(stages: readonly BankCaseStage[]): BankCaseStage[] {
  return stages.filter((stage) => stage.type === 'OPEN').sort(byPosition);
}

export function initialStage(stages: readonly BankCaseStage[]): BankCaseStage | undefined {
  return stages.find((stage) => stage.isInitial);
}

export function stageOfType(
  stages: readonly BankCaseStage[],
  type: BankCaseStage['type'],
): BankCaseStage | undefined {
  return stages.find((stage) => stage.type === type);
}

/**
 * Étape ouverte suivante — reproduction EXACTE de `nextOpenStage` côté API.
 *
 * Fondée sur la position, pas sur un chaînage stocké : une étape désactivée est
 * sautée, et les dossiers qui y stationnent repartent vers la suivante encore
 * active. Recalculer ici évite de proposer un bouton « Étape suivante » que
 * l'API refuserait en `BANK_STAGE_NOT_NEXT`.
 */
export function nextOpenStage(
  stages: readonly BankCaseStage[],
  current: BankCaseStage,
): BankCaseStage | undefined {
  return activeOpenStages(stages).find((stage) => stage.position > current.position);
}

export function lastOpenStage(stages: readonly BankCaseStage[]): BankCaseStage | undefined {
  return activeOpenStages(stages).at(-1);
}

/**
 * Ce que le bouton principal du détail doit faire.
 *
 * L'encaissement ne se déclare qu'à la DERNIÈRE étape ouverte active
 * (`assertReachable` côté API). Décider ici plutôt que d'afficher les deux
 * boutons évite de présenter une action que le serveur refusera.
 */
export type PrimaryAction =
  | { kind: 'advance'; target: BankCaseStage }
  | { kind: 'cash'; target: BankCaseStage }
  | { kind: 'none'; reason: string };

export function primaryAction(
  stages: readonly BankCaseStage[],
  current: BankCaseStage,
): PrimaryAction {
  if (current.type !== 'OPEN') {
    return { kind: 'none', reason: 'Ce dossier est clos : son parcours est terminé.' };
  }

  const next = nextOpenStage(stages, current);
  if (next !== undefined) return { kind: 'advance', target: next };

  const cashed = stageOfType(stages, 'CASHED');
  if (cashed !== undefined && cashed.isActive) return { kind: 'cash', target: cashed };

  return {
    kind: 'none',
    reason:
      'Aucune étape suivante active n’est configurée. Un administrateur doit compléter le flux.',
  };
}
