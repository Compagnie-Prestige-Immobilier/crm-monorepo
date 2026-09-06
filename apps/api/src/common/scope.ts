import { ForbiddenException } from '@nestjs/common';
import { ProspectStatut, Role } from '@crm/database';
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
 * téléconseillers. La lecture large passe par `attributionScope`.
 */
export const ownerScope = (
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
): { createdById?: string } => (isAdmin(user) ? {} : { createdById: user.id });

/**
 * CE QU'UN TÉLÉCONSEILLER A EN MAIN : ses propres fiches, ou celles qu'une
 * campagne lui a confiées, tous lots et tous jours confondus.
 *
 * Le `OR` est rendu tel quel plutôt que fondu dans la clause appelante : à la
 * racine d'un `where` il écraserait la recherche libre, qui utilise déjà `OR`.
 * Chaque appelant le pose donc dans un `AND`.
 *
 * `Representant` et `Prospect` portent tous deux `createdById` et `lotItems` :
 * la même clause vaut pour les deux modèles.
 *
 * `malgreLeRole` borne aussi l'encadrement : sur l'écran d'appel, un
 * superviseur ne compose que les numéros qui lui reviennent. Sa vue d'ensemble
 * de l'annuaire et de la supervision passe par un appel sans cette option.
 */
const enMain = (
  user: Pick<AuthenticatedUser, 'id'>,
): (Prisma.RepresentantWhereInput & Prisma.ProspectWhereInput)[] => [
  { createdById: user.id },
  { lotItems: { some: { assigneeId: user.id } } },
];

export const attributionScope = (
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  options: { malgreLeRole?: boolean } = {},
): Prisma.RepresentantWhereInput & Prisma.ProspectWhereInput =>
  readsEveryone(user) && options.malgreLeRole !== true ? {} : { OR: enMain(user) };

/**
 * Portée de lecture des PROSPECTS à l'écran.
 *
 * Le chargé de clientèle y ajoute TOUTE demande convertie, quel qu'en soit
 * l'auteur : c'est lui qui la relit avant l'enrôlement, et une portée bornée à
 * ses propres fiches lui aurait caché celles qu'il doit justement revoir.
 */
export const prospectReadScope = (
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
): Prisma.ProspectWhereInput =>
  user.role === Role.CHARGE_CLIENTELE
    ? { OR: [...enMain(user), { statut: ProspectStatut.CONVERTI }] }
    : attributionScope(user);

/**
 * Portée des prospects sur le TÉLÉPHONE : aucune. Le tirage est GLOBAL et c'est
 * l'appareil qui filtre, sans quoi une réattribution de campagne effacerait des
 * fiches déjà ouvertes hors ligne. La portée d'écran, elle, reste
 * `prospectReadScope`.
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
