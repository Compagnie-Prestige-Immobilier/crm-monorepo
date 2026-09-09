import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';

export type ReferentielItem = components['schemas']['ReferentielsItem'];
export type Referentiels = components['schemas']['ReferentielsBundleOutputBody'];

/** Les listes changent quelques fois par mois : les relire à chaque écran est du bruit. */
export const REFERENTIELS_STALE_MS = 5 * 60_000;

/**
 * `activeOnly: false` : une fiche déjà rattachée à une entrée retirée doit
 * continuer à l'afficher, sinon la modification l'effacerait sans le dire.
 */
export async function fetchReferentiels(): Promise<Referentiels> {
  return unwrap(
    await apiClient.GET('/api/v1/referentiels', { params: { query: { activeOnly: false } } }),
  );
}

export async function fetchReferentiel(
  kind: string,
  activeOnly = false,
): Promise<ReferentielItem[]> {
  const items = unwrap(
    await apiClient.GET('/api/v1/referentiels/{kind}', {
      params: { path: { kind }, query: { activeOnly } },
    }),
  );
  return items ?? [];
}

export function actifs(items: readonly ReferentielItem[] | null | undefined): ReferentielItem[] {
  return (items ?? []).filter((item) => item.isActive !== false);
}

export function libelle(item: ReferentielItem): string {
  return item.label ?? item.name ?? item.code ?? item.id;
}

/** Un sigle ou un nom court se pose à droite du libellé, jamais à sa place. */
export function complement(item: ReferentielItem): string | undefined {
  return item.sigle ?? item.shortName ?? undefined;
}

/** Les IEF ne sont pas dans le lot : elles se filtrent par département. */
export async function fetchIefs(departementId?: string): Promise<ReferentielItem[]> {
  const items = unwrap(
    await apiClient.GET('/api/v1/referentiels/{kind}', {
      params: {
        path: { kind: 'iefs' },
        query: { activeOnly: false, ...(departementId === undefined ? {} : { departementId }) },
      },
    }),
  );
  return items ?? [];
}

export function enOptions(
  items: readonly ReferentielItem[] | null | undefined,
  indice?: (item: ReferentielItem) => string | undefined,
): { value: string; label: string; hint?: string | undefined }[] {
  return (items ?? []).map((item) => ({
    value: item.id,
    label: libelle(item),
    hint: indice === undefined ? complement(item) : indice(item),
  }));
}

export type ReferentielEntree = components['schemas']['ReferentielsEntree'];

export async function creerEntreeReferentiel(
  kind: string,
  body: ReferentielEntree,
): Promise<ReferentielItem> {
  return unwrap(
    await apiClient.POST('/api/v1/referentiels/{kind}', { params: { path: { kind } }, body }),
  );
}

export async function modifierEntreeReferentiel(
  kind: string,
  id: string,
  body: ReferentielEntree,
): Promise<ReferentielItem> {
  return unwrap(
    await apiClient.PATCH('/api/v1/referentiels/{kind}/{id}', {
      params: { path: { kind, id } },
      body,
    }),
  );
}
