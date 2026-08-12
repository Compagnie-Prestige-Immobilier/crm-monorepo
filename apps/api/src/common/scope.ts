import { ForbiddenException } from '@nestjs/common';
import { Role } from '@crm/database';

import type { AuthenticatedUser } from './decorators/current-user.decorator.js';

/**
 * Cloisonnement par commercial.
 *
 * Un COMMERCIAL ne lit et n'écrit QUE ses propres lignes ; un ADMIN voit tout.
 *
 * Le filtre est appliqué dans la COUCHE SERVICE, jamais dans le contrôleur.
 * Posé dans le contrôleur, il dépendrait de la discipline de chaque route :
 * une nouvelle route qui oublie de le transmettre lirait toute la table sans
 * qu'aucun test de ce module ne s'en aperçoive. Dans le service, il est
 * traversé par tous les appelants, présents et futurs.
 */

export const isAdmin = (user: Pick<AuthenticatedUser, 'role'>): boolean => user.role === Role.ADMIN;

/**
 * Fragment `where` restreignant la lecture aux lignes du commercial courant.
 * Vide pour un ADMIN.
 */
export const ownerScope = (
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
): { createdById?: string } => (isAdmin(user) ? {} : { createdById: user.id });

/**
 * Vérifie qu'une ligne déjà chargée appartient bien à l'appelant.
 *
 * Utilisé sur les chemins d'écriture où la ligne est lue par identifiant : le
 * `where` de lecture ne peut pas distinguer « inexistant » de « appartient à
 * quelqu'un d'autre », et confondre les deux transformerait un 403 en écrasement
 * silencieux.
 */
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
