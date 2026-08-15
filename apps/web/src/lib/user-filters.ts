import { readPositiveInt, readString, type RawSearchParams } from '@/lib/search-params';
import { type Role } from '@/lib/types';

/**
 * Filtre des comptes : traduction URL ⇄ objet.
 *
 * Le rôle EXISTE côté API (`UserQueryDto`) mais n'était pas exposé : l'écran
 * envoyait `role=COMMERCIAL` en dur, si bien qu'un administrateur cherchant le
 * compte d'un agent Banque & Finance ne le trouvait jamais, et rien ne disait
 * qu'une liste était restreinte.
 */

export const USER_PAGE_SIZE = 25;

export const ROLES: readonly Role[] = ['ADMIN', 'COMMERCIAL', 'BANQUE_FINANCE'];

export interface UserFilters {
  search: string;
  /** `null` = tous les rôles. Le défaut reste `COMMERCIAL` : voir la sérialisation. */
  role: Role | null;
  /** `null` = tous les états ; c'est le défaut, un compte désactivé reste visible. */
  isActive: boolean | null;
  page: number;
  pageSize: number;
}

/**
 * L'écran s'appelle « Téléconseillers » et c'est ce qu'il montre par défaut :
 * les comptes mobiles. Le rôle par défaut n'est donc PAS « tous ».
 */
export const EMPTY_USER_FILTERS: UserFilters = {
  search: '',
  role: 'COMMERCIAL',
  isActive: null,
  page: 1,
  pageSize: USER_PAGE_SIZE,
};

export type { RawSearchParams };

/**
 * « Tous les rôles » s'écrit `role=tous`, et ce n'est pas une coquetterie.
 *
 * Le défaut de l'écran est `COMMERCIAL` : l'ABSENCE du paramètre ne peut donc
 * pas vouloir dire « tous », sinon un lien vers la liste complète serait
 * indistinguable d'un lien vers la liste par défaut, et le destinataire verrait
 * une population différente de celle qu'on lui a envoyée.
 */
export function parseUserFilters(params: RawSearchParams | URLSearchParams): UserFilters {
  const role = readString(params, 'role');
  const isActive = readString(params, 'isActive');

  return {
    search: readString(params, 'search') ?? '',
    role:
      role === 'tous'
        ? null
        : role !== null && (ROLES as readonly string[]).includes(role)
          ? (role as Role)
          : EMPTY_USER_FILTERS.role,
    isActive: isActive === 'oui' ? true : isActive === 'non' ? false : null,
    page: readPositiveInt(params, 'page', 1),
    pageSize: USER_PAGE_SIZE,
  };
}

/** Sérialisation canonique : défauts omis, ordre de clés fixe, donc clé de cache. */
export function serializeUserFilters(filters: UserFilters): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string | null): void => {
    if (value !== null && value !== '') params.set(key, value);
  };

  put('search', filters.search.trim());
  if (filters.role === null) {
    put('role', 'tous');
  } else if (filters.role !== EMPTY_USER_FILTERS.role) {
    put('role', filters.role);
  }
  if (filters.isActive !== null) put('isActive', filters.isActive ? 'oui' : 'non');
  if (filters.page !== 1) put('page', String(filters.page));

  return params;
}

export function userFiltersQueryKey(filters: UserFilters): string {
  return serializeUserFilters(filters).toString();
}

export function countActiveUserFilters(filters: UserFilters): number {
  let count = 0;
  if (filters.search.trim() !== '') count += 1;
  if (filters.role !== EMPTY_USER_FILTERS.role) count += 1;
  if (filters.isActive !== null) count += 1;
  return count;
}
