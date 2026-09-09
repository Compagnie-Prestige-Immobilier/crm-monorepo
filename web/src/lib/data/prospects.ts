import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';
import type { FiltresProspects } from '@/components/prospects/filtres';
import type { ProspectQuery } from '@/lib/data/console';
import { fetchPageProspects, type PageProspects } from '@/lib/data/grand-public';
import { sansNuls } from '@/lib/filtres-url';

export type Prospect = components['schemas']['Prospect'];
export type ProspectBody = components['schemas']['ProspectBody'];
export type AppelProspect = components['schemas']['ProspectCallAttempt'];

const debutDeJour = (date: string): string => `${date}T00:00:00.000Z`;
const finDeJour = (date: string): string => `${date}T23:59:59.999Z`;

const ouiNon = (valeur: boolean | null): 'true' | 'false' | null => {
  if (valeur === null) return null;
  return valeur ? 'true' : 'false';
};

function versRequete(filtres: FiltresProspects): ProspectQuery {
  const search = filtres.search.trim();
  return {
    page: filtres.page,
    pageSize: filtres.pageSize,
    sortBy: filtres.sortBy,
    sortOrder: filtres.sortDir,
    ...sansNuls({
      search: search === '' ? null : search,
      projet: filtres.projet,
      commercialId: filtres.commercialId,
      representantId: filtres.representantId,
      departementId: filtres.departementId,
      banqueId: filtres.banqueId,
      syndicatId: filtres.syndicatId,
      statut: filtres.statut,
      segment: filtres.segment,
      phase2Status: filtres.phase2Status,
      enrollmentMethod: filtres.enrollmentMethod,
      revue: ouiNon(filtres.revue),
      dateFrom: filtres.dateFrom === null ? null : debutDeJour(filtres.dateFrom),
      dateTo: filtres.dateTo === null ? null : finDeJour(filtres.dateTo),
    }),
  };
}

export async function fetchProspects(filtres: FiltresProspects): Promise<PageProspects> {
  return fetchPageProspects(versRequete(filtres));
}

/** `projet` posé ICI : oublié, la fiche partirait dans le mauvais projet. */
export async function creerProspectChues(body: ProspectBody): Promise<Prospect> {
  return unwrap(await apiClient.POST('/api/v1/prospects', { body: { ...body, projet: 'CHUES' } }));
}

export async function modifierProspect(id: string, body: ProspectBody): Promise<Prospect> {
  return unwrap(
    await apiClient.PATCH('/api/v1/prospects/{id}', { params: { path: { id } }, body }),
  );
}

export async function supprimerProspect(id: string): Promise<void> {
  unwrap(await apiClient.DELETE('/api/v1/prospects/{id}', { params: { path: { id } } }));
}

/** La revue du closing, avant transmission à l'enrôlement. */
export async function marquerProspectRevue(id: string): Promise<Prospect> {
  return unwrap(await apiClient.POST('/api/v1/prospects/{id}/revue', { params: { path: { id } } }));
}

export async function fusionnerProspects(input: {
  targetId: string;
  sourceId: string;
  preferSource: boolean;
}): Promise<Prospect> {
  return unwrap(await apiClient.POST('/api/v1/prospects/merge', { body: input }));
}

export async function reaffecterProspects(input: {
  prospectIds: string[];
  representantId?: string | undefined;
  commercialId?: string | undefined;
}): Promise<{ updated: number }> {
  return unwrap(
    await apiClient.POST('/api/v1/prospects/reassign', {
      body: {
        prospectIds: input.prospectIds,
        ...(input.representantId === undefined ? {} : { representantId: input.representantId }),
        ...(input.commercialId === undefined ? {} : { commercialId: input.commercialId }),
      },
    }),
  );
}

export async function fetchAppelsProspect(id: string): Promise<AppelProspect[]> {
  const sortie = unwrap(
    await apiClient.GET('/api/v1/prospects/{id}/call-attempts', { params: { path: { id } } }),
  );
  return sortie.items ?? [];
}

const SIGLE_CHUES = 'CHUES';
const NOM_COURT_CBAO = 'CBAO';

/** Le croisement banque × syndicat décide la base : la règle est la même côté serveur. */
export function segmentDe(input: { syndicatSigle: string; banqueShortName: string }): string {
  const chues = input.syndicatSigle === SIGLE_CHUES;
  const cbao = input.banqueShortName === NOM_COURT_CBAO;
  if (chues) return cbao ? 'BDD1' : 'BDD2';
  return cbao ? 'BDD3' : 'BDD4';
}
