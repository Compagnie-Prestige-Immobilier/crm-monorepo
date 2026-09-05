import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthenticatedUser } from '../decorators/current-user.decorator.js';
import { readEnv } from '../../env.js';
import { WorkspaceContext, type Workspace } from '../../workspaces/workspace.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  username: string;
  fullName: string;
  role: AuthenticatedUser['role'];
  workspace?: Workspace;
  typ: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly workspace: WorkspaceContext,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthenticatedUser;
    }>();

    const header = request.headers.authorization;
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Jeton d’accès manquant');
    }

    let payload: AccessTokenPayload;
    try {
      payload = this.jwt.verify<AccessTokenPayload>(raw.slice('Bearer '.length).trim(), {
        secret: readEnv().JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Jeton d’accès invalide ou expiré');
    }

    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Jeton d’accès invalide');
    }

    // Un jeton frappé avant la coupure porte encore `demo` : sans ce repli, il
    // ouvrirait le schéma de démonstration sur une base qui n'en veut pas.
    const workspace =
      payload.workspace === 'demo' && readEnv().DEMO_WORKSPACE_ENABLED ? 'demo' : 'public';
    this.workspace.enter(workspace);
    request.user = {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
      workspace,
    };
    return true;
  }
}
