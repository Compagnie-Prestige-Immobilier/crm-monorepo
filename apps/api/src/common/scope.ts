import { ForbiddenException } from '@nestjs/common';
import { Role } from '@crm/database';
import type { Prisma } from '@crm/database';

import type { AuthenticatedUser } from './decorators/current-user.decorator.js';

export const isAdmin = (user: Pick<AuthenticatedUser, 'role'>): boolean => user.role === Role.ADMIN;

/** Qui voit le travail de TOUS. Séparé d'`isAdmin` : l'écriture n'en dépend jamais. */
export const readsEveryone = (user: Pick<AuthenticatedUser, 'role'>): boolean =>
  isAdmin(user) || user.role === Role.SUPERVISEUR || user.role === Role.DIRECTION;

/**
 * Portée d'ÉCRITURE, et de la synchronisation mobile qui écrit.
 *
 * Élargir cette fonction à un rôle de lecture tirerait le portefeuille national
 * sur son téléphone et ouvrirait la validation des poussées entre
 * téléconseillers. La lecture large passe par `readScope`.
 */
export const ownerScope = (
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
): { createdById?: string } => (isAdmin(user) ? {} : { createdById: user.id });

/** Portée de LECTURE des écrans : supervision et direction voient le travail de tous. */
export const readScope = (
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
): { createdById?: string } => (readsEveryone(user) ? {} : { createdById: user.id });

/**
 * CE QU'UN TÉLÉCONSEILLER A EN MAIN : ses propres fiches, ou celles qu'une
 * campagne lui a confiées.
 *
 * Écrite ici une seule fois, et servie au panneau comme au téléphone. Quand la
 * règle existait en deux exemplaires, le web bornait sur `createdById` seul et
 * affichait « aucun prospect à appeler » à la personne dont le mobile comptait
 * six fiches à appeler.
 */
/** Portée de lecture des PROSPECTS à l'écran. Tous les téléconseillers lisent leur coque. */
export const prospectReadScope = (
  _user: Pick<AuthenticatedUser, 'id' | 'role'>,
): Prisma.ProspectWhereInput => ({});

/**
 * Portée des prospects sur le TÉLÉPHONE. Volontairement plus étroite que
 * `prospectReadScope` : lire le travail de tous à l'écran est une chose, en
 * tirer le portefeuille national sur un appareil en est une autre.
 */
export const prospectSyncScope = (
  _user: Pick<AuthenticatedUser, 'id' | 'role'>,
): Prisma.ProspectWhereInput => ({});

export function readableOwnerId(
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  requestedId: string,
): string {
  if (readsEveryone(user) || requestedId === user.id) return requestedId;
  return '__aucun__';
}

/**
 * Qui ENCADRE : peut agir sur le travail d'un autre depuis le PANNEAU.
 *
 * Distinct d'`ownerScope`, qui reste la portée du téléphone. Le superviseur
 * corrige, réattribue et débloque ce que ses commerciaux ont saisi ; il ne
 * synchronise pas, donc il ne tire aucun portefeuille sur un appareil.
 * La DIRECTION mène les trois étapes sur SES propres fiches, sans corriger
 * celles des autres : elle n'est pas ici.
 */
export const manages = (user: Pick<AuthenticatedUser, 'role'>): boolean =>
  isAdmin(user) || user.role === Role.SUPERVISEUR;

/** Portée d'écriture des écrans d'encadrement. Ne JAMAIS l'utiliser dans `sync`. */
export const manageScope = (
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
): { createdById?: string } => (manages(user) ? {} : { createdById: user.id });

/** Pendant d'`assertOwnership` pour un geste d'encadrement. */
export function assertManageable(
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  row: { createdById: string },
  message = 'Cette fiche appartient à un autre commercial.',
): void {
  if (manages(user)) return;
  if (row.createdById !== user.id) {
    throw new ForbiddenException({ code: 'NOT_OWNER', message });
  }
}

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
