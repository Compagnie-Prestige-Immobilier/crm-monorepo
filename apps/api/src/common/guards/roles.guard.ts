import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@crm/database';

import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../decorators/current-user.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Accès refusé');
    if (!required.includes(user.role)) {
      throw new ForbiddenException('Rôle insuffisant pour cette opération');
    }
    return true;
  }
}
