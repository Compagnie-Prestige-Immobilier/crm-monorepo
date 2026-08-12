import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthenticatedUser } from '../decorators/current-user.decorator.js';
import { readEnv } from '../../env.js';

/**
 * Charge utile du jeton d'accès. Volontairement minimale.
 *
 * `typ` est déclaré `string` et non `'access'` : ce qui sort de `verify()` est
 * un JSON quelconque produit par un tiers, pas une valeur dont le compilateur
 * peut garantir la forme. Le typer en littéral ferait disparaître le contrôle
 * ci-dessous comme « toujours vrai » alors qu'il est le seul rempart contre un
 * refresh token présenté à la place d'un jeton d'accès.
 */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  username: string;
  fullName: string;
  role: AuthenticatedUser['role'];
  typ: string;
}

/**
 * Guard global. Ferme par défaut : une route sans `@Public()` exige un jeton
 * valide. L'inverse (ouvrir par défaut, fermer par décorateur) transforme un
 * oubli en fuite de données ; ici un oubli produit un 401.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
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

    // Un refresh token est signé avec un autre secret, mais un jeton forgé avec
    // le bon secret et un mauvais `typ` doit tout de même être refusé.
    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Jeton d’accès invalide');
    }

    request.user = {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
    };
    return true;
  }
}
