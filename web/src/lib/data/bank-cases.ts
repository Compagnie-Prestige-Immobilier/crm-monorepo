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
  InscriptionAOuvrir,
  Paginated,
  Projet,
} from '@/lib/types';

export async function fetchBankCases(
  filters: BankCaseFilters,
  client: ApiClient = getApiClient(),
): Promise<Paginated<BankCase>> {
  return flattenPage(
    unwrap(await client.GET('/api/v1/bank-cases', { params: { query: toBankCaseQuery(filters) } })),
  );
}

/** `projet` borne la lecture à la coque ouverte : un dossier de l'autre parcours répond 404. */
export async function fetchBankCase(
  id: string,
  projet: Projet,
  client: ApiClient = getApiClient(),
): Promise<BankCaseDetail> {
  return unwrap(
    await client.GET('/api/v1/bank-cases/{id}', {
      params: { path: { id }, query: { projet } },
    }),
  );
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

export async function searchBankProspects(
  q: string,
  projet: Projet,
  client: ApiClient = getApiClient(),
): Promise<BankProspectSearchItem[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  return unwrap(
    await client.GET('/api/v1/bank-cases/prospect-search', {
      params: { query: { search: term, pageSize: 20, projet } },
    }),
  ).items;
}

export async function createBankCase(
  input: CreateBankCaseInput,
  client: ApiClient = getApiClient(),
): Promise<BankCase> {
  return unwrap(await client.POST('/api/v1/bank-cases', { body: input }));
}

/** Inscriptions validées sur la plateforme sans dossier bancaire : la seule porte d'ouverture. */
export async function fetchInscriptionsAOuvrir(
  projet: Projet,
  client: ApiClient = getApiClient(),
): Promise<InscriptionAOuvrir[]> {
  return unwrap(await client.GET('/api/v1/bank-cases/a-ouvrir', { params: { query: { projet } } }))
    .items;
}

export interface TransitionInput {
  targetStageId: string;
  expectedRev: number;
  amountXof?: string | undefined;
  rejectionReasonId?: string | undefined;
  rejectionDetail?: string | undefined;
  comment?: string | undefined;
}

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

const byPosition = (a: BankCaseStage, b: BankCaseStage): number =>
  a.position - b.position || a.id.localeCompare(b.id);

function activeOpenStages(stages: readonly BankCaseStage[]): BankCaseStage[] {
  return stages.filter((stage) => stage.isActive && stage.type === 'OPEN').sort(byPosition);
}

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

function nextOpenStage(
  stages: readonly BankCaseStage[],
  current: BankCaseStage,
): BankCaseStage | undefined {
  return activeOpenStages(stages).find((stage) => stage.position > current.position);
}

export type PrimaryAction =
  | { kind: 'advance'; target: BankCaseStage }
  | { kind: 'cash'; target: BankCaseStage }
  | { kind: 'none'; reason: string };

export function primaryAction(
  stages: readonly BankCaseStage[],
  current: BankCaseStage,
): PrimaryAction {
  if (current.type !== 'OPEN') {
    return { kind: 'none', reason: 'Dossier clos.' };
  }

  const next = nextOpenStage(stages, current);
  if (next !== undefined) return { kind: 'advance', target: next };

  const cashed = stageOfType(stages, 'CASHED');
  if (cashed !== undefined && cashed.isActive) return { kind: 'cash', target: cashed };

  return {
    kind: 'none',
    reason: 'Aucune étape suivante active. Complétez le flux de traitement.',
  };
}
