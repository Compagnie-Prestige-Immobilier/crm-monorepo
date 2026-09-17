import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import type { Paginated } from '@/lib/types';

export type Suggestion = components['schemas']['QualificationSuggestionDTO'];
export type SuggestionStatus = Suggestion['status'];

export const SUGGESTION_STATUSES = ['A_APPELER', 'APPELE', 'ABANDONNE'] as const;

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  A_APPELER: 'À appeler',
  APPELE: 'Appelé',
  ABANDONNE: 'Abandonné',
};

export const suggestionsQueryKey = (status: SuggestionStatus | null) =>
  ['suggestions', status ?? 'tous'] as const;

export async function fetchSuggestions(
  status: SuggestionStatus | null,
  client: ApiClient = getApiClient(),
): Promise<Paginated<Suggestion>> {
  const query = status === null ? { pageSize: 100 } : { status, pageSize: 100 };
  return flattenPage(unwrap(await client.GET('/api/v1/suggestions', { params: { query } })));
}

export async function setSuggestionStatus(
  id: string,
  status: SuggestionStatus,
  client: ApiClient = getApiClient(),
): Promise<Suggestion> {
  return unwrap(
    await client.PATCH('/api/v1/suggestions/{id}', {
      params: { path: { id } },
      body: { status },
    }),
  );
}

const STATUS_RANK: Record<SuggestionStatus, number> = { A_APPELER: 0, APPELE: 1, ABANDONNE: 2 };

/** Les « à appeler » en tête, puis du plus récemment recueilli au plus ancien. */
export function orderSuggestions(items: readonly Suggestion[]): Suggestion[] {
  return [...items].sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    return b.clientCreatedAt.localeCompare(a.clientCreatedAt);
  });
}

/**
 * Combien de fois chaque numéro revient dans la page servie. L'API ne rend
 * aucun comptage : ce décompte ne porte donc QUE sur les lignes chargées.
 */
export function suggestionCountsByPhone(items: readonly Suggestion[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.suggestedPhoneE164, (counts.get(item.suggestedPhoneE164) ?? 0) + 1);
  }
  return counts;
}
