import {
  Injectable,
  SetMetadata,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom, tap, type Observable } from 'rxjs';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { readsEveryone } from '../common/scope.js';
import { LiveService, type LiveTopic } from '../modules/live/live.service.js';
import { RedisService } from './redis.service.js';

const CACHED = 'cpi:cached';

interface CachedOptions {
  readonly ttlSeconds: number;
  readonly group?: LiveTopic;
}

/**
 * Met en cache les GET du handler ou de la classe, par URL et par portée de
 * lecture. Avec un `group`, toute mutation (POST, PATCH, DELETE) de la même
 * classe invalide d'un coup ce que le groupe a mis en cache et prévient les
 * panels ouverts.
 */
export const Cached = (ttlSeconds: number, group?: LiveTopic): MethodDecorator & ClassDecorator =>
  SetMetadata<string, CachedOptions>(CACHED, group ? { ttlSeconds, group } : { ttlSeconds });

interface CacheableRequest {
  method: string;
  url: string;
  user?: AuthenticatedUser;
}

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly live: LiveService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const options = this.reflector.getAllAndOverride<CachedOptions | undefined>(CACHED, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest<CacheableRequest>();
    if (request.method !== 'GET') {
      const group = options.group;
      if (!group) return next.handle();
      return next.handle().pipe(
        tap(() => {
          void this.redis.bump(group).then(() => this.live.emit(group));
        }),
      );
    }

    const scope = scopeOf(request.user);
    return from(
      this.redis.cached(
        `http:${scope}:${request.url}`,
        options.ttlSeconds,
        () => lastValueFrom(next.handle(), { defaultValue: undefined }),
        options.group,
      ),
    );
  }
}

// Même clé pour tous ceux qui voient tout ; un téléconseiller ne voit que le sien.
const scopeOf = (user: AuthenticatedUser | undefined): string => {
  if (!user) return 'anon';
  return readsEveryone(user) ? user.role : user.id;
};
