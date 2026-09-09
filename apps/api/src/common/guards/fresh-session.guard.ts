import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import type { AuthenticatedUser } from '../decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';

export const freshUserKey = (id: string): string => `user:${id}`;
const FRESH_USER_TTL_SECONDS = 30;

/**
 * Le jeton porte le rôle et reste figé quinze minutes : l'autorité est donc relue
 * sur TOUTE requête authentifiée, sans condition sur `@Roles`, car
 * `isAdmin(user)` est aussi lu à l'intérieur des services. Trente secondes de
 * cache, purgées par `UsersService` à chaque changement de rôle ou d'état.
 *
 * À enregistrer AVANT `RolesGuard` : la garde écrase `request.user` au lieu de
 * refuser, et laisse `RolesGuard` trancher.
 */
@Injectable()
export class FreshSessionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return true;

    const fresh = await this.redis.cached(freshUserKey(user.id), FRESH_USER_TTL_SECONDS, () =>
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, isActive: true, deletedAt: true },
      }),
    );

    if (!fresh || fresh.deletedAt !== null) {
      throw new UnauthorizedException({
        code: 'SESSION_REVOKED',
        message: 'Ce compte n’existe plus. Reconnectez-vous.',
      });
    }

    if (!fresh.isActive) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'Ce compte est désactivé. Contactez un administrateur.',
      });
    }

    request.user = { ...user, role: fresh.role };
    return true;
  }
}
