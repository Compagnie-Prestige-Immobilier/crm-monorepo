import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';

export type Suggestion = components['schemas']['QualificationSuggestionDTO'];
export type StatutSuggestion = Suggestion['status'];

export const STATUTS_SUGGESTION: readonly StatutSuggestion[] = ['A_APPELER', 'APPELE', 'ABANDONNE'];

export const LIBELLES_STATUT_SUGGESTION: Record<StatutSuggestion, string> = {
  A_APPELER: 'À appeler',
  APPELE: 'Appelé',
  ABANDONNE: 'Abandonné',
};

export const VARIANTES_STATUT_SUGGESTION = {
  A_APPELER: 'warning',
  APPELE: 'success',
  ABANDONNE: 'outline',
} as const;

export async function fetchSuggestions(
  status: StatutSuggestion | null,
): Promise<{ items: Suggestion[]; total: number }> {
  const page = unwrap(
    await apiClient.GET('/api/v1/suggestions', {
      params: { query: { pageSize: 100, ...(status === null ? {} : { status }) } },
    }),
  );
  return { items: page.items ?? [], total: page.meta.total };
}

export async function changerStatutSuggestion(
  id: string,
  status: StatutSuggestion,
): Promise<Suggestion> {
  return unwrap(
    await apiClient.PATCH('/api/v1/suggestions/{id}', {
      params: { path: { id } },
      body: { status },
    }),
  );
}

const RANG: Record<StatutSuggestion, number> = { A_APPELER: 0, APPELE: 1, ABANDONNE: 2 };

/** Les « à appeler » en tête, puis du plus récemment recueilli au plus ancien. */
export function ordonnerSuggestions(items: readonly Suggestion[]): Suggestion[] {
  return [...items].sort((gauche, droite) => {
    const rang = RANG[gauche.status] - RANG[droite.status];
    if (rang !== 0) return rang;
    return droite.clientCreatedAt.localeCompare(gauche.clientCreatedAt);
  });
}

/**
 * Combien de fois chaque numéro revient dans la page servie. L'API ne rend
 * aucun comptage : ce décompte ne porte QUE sur les lignes chargées.
 */
export function comptesParNumero(items: readonly Suggestion[]): Map<string, number> {
  const comptes = new Map<string, number>();
  for (const item of items) {
    comptes.set(item.suggestedPhoneE164, (comptes.get(item.suggestedPhoneE164) ?? 0) + 1);
  }
  return comptes;
}
