import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@crm/database';

/** Identité résolue par le JwtAuthGuard et attachée à la requête. */
export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly fullName: string;
  readonly role: Role;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user) {
      // Impossible en pratique : le guard global rejette avant d'arriver ici.
      // Lever plutôt que renvoyer undefined évite qu'un service reçoive un
      // `ownerId` undefined et lise l'intégralité de la table.
      throw new Error('CurrentUser utilisé sur une route non authentifiée');
    }
    return request.user;
  },
);
