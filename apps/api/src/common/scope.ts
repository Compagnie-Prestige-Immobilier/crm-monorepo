import { ForbiddenException } from '@nestjs/common';
import { Role } from '@crm/database';

import type { AuthenticatedUser } from './decorators/current-user.decorator.js';

export const isAdmin = (user: Pick<AuthenticatedUser, 'role'>): boolean => user.role === Role.ADMIN;

/** Qui voit le travail de TOUS. Séparé d'`isAdmin` : l'écriture n'en dépend jamais. */
export const readsEveryone = (user: Pick<AuthenticatedUser, 'role'>): boolean =>
  isAdmin(user) || user.role === Role.SUPERVISEUR;

/**
 * Portée d'ÉCRITURE, et de la synchronisation mobile qui écrit.
 *
 * Élargir cette fonction au SUPERVISEUR tirerait le portefeuille national sur
 * le téléphone d'un superviseur et ouvrirait la validation des poussées entre
 * téléconseillers. La lecture large passe par `readScope`.
 */
export const ownerScope = (
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
): { createdById?: string } => (isAdmin(user) ? {} : { createdById: user.id });

/** Portée de LECTURE des écrans : le superviseur voit le travail de tous. */
export const readScope = (
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
): { createdById?: string } => (readsEveryone(user) ? {} : { createdById: user.id });

export function assertOwnership(
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  row: { createdById: string },
  message = 'Cette fiche appartient à un autre commercial.',
): void {
  if (isAdmin(user)) return;
  if (row.createdById !== user.id) {
    throw new ForbiddenException({ code: 'NOT_OWNER', message });
  }
}

/** Pendant d'`assertOwnership` sur un chemin qui ne modifie rien. */
export function assertReadable(
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  row: { createdById: string },
  message = 'Cette fiche appartient à un autre téléconseiller.',
): void {
  if (readsEveryone(user)) return;
  if (row.createdById !== user.id) {
    throw new ForbiddenException({ code: 'NOT_OWNER', message });
  }
}
