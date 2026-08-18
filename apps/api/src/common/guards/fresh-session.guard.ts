import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import type { AuthenticatedUser } from '../decorators/current-user.decorator.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Le jeton porte le rôle et reste figé quinze minutes : l'autorité est donc relue
 * en base sur TOUTE requête authentifiée, sans condition sur `@Roles`, car
 * `isAdmin(user)` est aussi lu à l'intérieur des services.
 *
 * À enregistrer AVANT `RolesGuard` : la garde écrase `request.user` au lieu de
 * refuser, et laisse `RolesGuard` trancher.
 */
@Injectable()
export class FreshSessionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return true;

    const fresh = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, isActive: true, isDemo: true, deletedAt: true },
    });

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

    if (fresh.isDemo && (await this.demo.state()) !== 'on') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message:
          'Ce compte n’existe que pour les démonstrations, et le mode démonstration est ' +
          'éteint. Connectez-vous avec un compte réel.',
      });
    }

    request.user = { ...user, role: fresh.role };
    return true;
  }
}
