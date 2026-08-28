import { readPositiveInt, readString, type RawSearchParams } from '@/lib/search-params';
import { type Role } from '@/lib/types';

export const USER_PAGE_SIZE = 25;

export const ROLES: readonly Role[] = [
  'ADMIN',
  'COMMERCIAL',
  'BANQUE_FINANCE',
  'SUPERVISEUR',
  'DIRECTION',
  'ACCUEIL',
];

export interface UserFilters {
  search: string;
  role: Role | null;
  isActive: boolean | null;
  page: number;
  pageSize: number;
}

export const EMPTY_USER_FILTERS: UserFilters = {
  search: '',
  role: 'COMMERCIAL',
  isActive: null,
  page: 1,
  pageSize: USER_PAGE_SIZE,
};

export type { RawSearchParams };

function parseRole(role: string | null): Role | null {
  if (role === 'tous') return null;
  if (role !== null && (ROLES as readonly string[]).includes(role)) return role as Role;
  return EMPTY_USER_FILTERS.role;
}

function parseActive(value: string | null): boolean | null {
  if (value === 'oui') return true;
  if (value === 'non') return false;
  return null;
}

export function parseUserFilters(params: RawSearchParams | URLSearchParams): UserFilters {
  const role = readString(params, 'role');
  const isActive = readString(params, 'isActive');

  return {
    search: readString(params, 'search') ?? '',
    role: parseRole(role),
    isActive: parseActive(isActive),
    page: readPositiveInt(params, 'page', 1),
    pageSize: USER_PAGE_SIZE,
  };
}

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
