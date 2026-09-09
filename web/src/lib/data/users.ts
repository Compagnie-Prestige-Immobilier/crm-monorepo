import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';
import type { Role } from '@/lib/types';

export type Compte = components['schemas']['Compte'];
export type CreerCompte = components['schemas']['CreerCompteInputBody'];
export type ModifierCompte = components['schemas']['ModifierCompteInputBody'];

export interface FiltresComptes {
  search: string;
  role: Role | null;
  isActive: boolean | null;
  page: number;
  pageSize: number;
}

export const FILTRES_COMPTES_VIDES: FiltresComptes = {
  search: '',
  role: null,
  isActive: null,
  page: 1,
  pageSize: 25,
};

/** Repreneurs possibles : le serveur n'accepte qu'un téléconseiller actif. */
export const FILTRES_REPRENEURS: FiltresComptes = {
  ...FILTRES_COMPTES_VIDES,
  role: 'COMMERCIAL',
  isActive: true,
  pageSize: 200,
};

/** Politique du serveur, `PASSWORD_MIN_LENGTH` et `PASSWORD_MAX_LENGTH`. */
export const MOT_DE_PASSE_MIN = 8;
export const MOT_DE_PASSE_MAX = 24;

export const ROLES_COMPTE: readonly Role[] = [
  'ADMIN',
  'COMMERCIAL',
  'CHARGE_CLIENTELE',
  'SUPERVISEUR',
  'DIRECTION',
  'BANQUE_FINANCE',
  'ACCUEIL',
];

export async function fetchComptes(filtres: FiltresComptes): Promise<{
  items: Compte[];
  meta: components['schemas']['PageAdmin'];
}> {
  const search = filtres.search.trim();
  const sortie = unwrap(
    await apiClient.GET('/api/v1/users', {
      params: {
        query: {
          page: filtres.page,
          pageSize: filtres.pageSize,
          ...(search === '' ? {} : { search }),
          ...(filtres.role === null ? {} : { role: filtres.role }),
          ...(filtres.isActive === null ? {} : { isActive: filtres.isActive ? 'true' : 'false' }),
        },
      },
    }),
  );
  return { items: sortie.items ?? [], meta: sortie.meta };
}

export async function creerCompte(body: CreerCompte): Promise<Compte> {
  return unwrap(await apiClient.POST('/api/v1/users', { body }));
}

export async function modifierCompte(id: string, body: ModifierCompte): Promise<Compte> {
  return unwrap(await apiClient.PATCH('/api/v1/users/{id}', { params: { path: { id } }, body }));
}

export async function activerCompte(
  id: string,
  isActive: boolean,
  handoverToId?: string,
): Promise<Compte> {
  return unwrap(
    await apiClient.PUT('/api/v1/users/{id}/active', {
      params: { path: { id } },
      body: { isActive, ...(handoverToId === undefined ? {} : { handoverToId }) },
    }),
  );
}

export async function changerMotDePasse(id: string, password: string): Promise<void> {
  unwrap(
    await apiClient.PUT('/api/v1/users/{id}/password', {
      params: { path: { id } },
      body: { password },
    }),
  );
}

export async function supprimerCompte(id: string, handoverToId?: string): Promise<void> {
  unwrap(
    await apiClient.DELETE('/api/v1/users/{id}', {
      params: {
        path: { id },
        query: handoverToId === undefined ? {} : { handoverToId },
      },
    }),
  );
}
