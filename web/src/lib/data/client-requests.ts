import { apiClient, unwrap } from '@/api/client';
import type { components, paths } from '@/api/schema';

type Schemas = components['schemas'];

export type DemandeClient = Schemas['DemandeClientBanque'];
export type StatutDemande = DemandeClient['status'];
export type RequeteDemandes = NonNullable<
  paths['/api/v1/client-requests']['get']['parameters']['query']
>;

export interface PageDemandes {
  items: DemandeClient[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  pendingCount: number;
}

export const LIBELLES_STATUT_DEMANDE: Record<StatutDemande, string> = {
  PENDING: 'En attente',
  APPROVED: 'Approuvée',
  REJECTED: 'Refusée',
};

export async function fetchDemandes(query: RequeteDemandes): Promise<PageDemandes> {
  const page = unwrap(await apiClient.GET('/api/v1/client-requests', { params: { query } }));
  return { items: page.items ?? [], pendingCount: page.pendingCount, ...page.meta };
}

export async function deposerDemande(body: {
  nom: string;
  prenom: string;
  phone: string;
  banqueId: string;
  note?: string;
}): Promise<DemandeClient> {
  return unwrap(await apiClient.POST('/api/v1/client-requests', { body }));
}

export async function approuverDemande(
  id: string,
  body: { representantId: string; syndicatId: string },
): Promise<DemandeClient> {
  return unwrap(
    await apiClient.POST('/api/v1/client-requests/{id}/approve', {
      params: { path: { id } },
      body,
    }),
  );
}

export async function refuserDemande(id: string, reason: string): Promise<DemandeClient> {
  return unwrap(
    await apiClient.POST('/api/v1/client-requests/{id}/reject', {
      params: { path: { id } },
      body: { reason },
    }),
  );
}
