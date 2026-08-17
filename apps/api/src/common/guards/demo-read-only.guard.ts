import { CanActivate, ConflictException, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { DEMO_WRITABLE_KEY } from '../decorators/demo-writable.decorator.js';
import { DemoVisibilityService, demoStateUnknown } from '../../prisma/demo-visibility.service.js';

/**
 * Pendant une démonstration, la plateforme est en LECTURE SEULE : `demo_mode` est
 * global au serveur, donc colorier les écritures en `isDemo: true` ferait
 * disparaître le travail réel des quarante commerciaux sur le terrain.
 *
 * Corollaire : ce qui passe encore par un chemin dispensé (la remontée hors ligne
 * du mobile, jamais refusée) est du travail RÉEL, et s'écrit `isDemo: false`.
 *
 * À enregistrer APRÈS `JwtAuthGuard` et `RolesGuard` : un anonyme doit lire 401,
 * pas l'état interne du serveur.
 */

const MUTATING_METHODS: ReadonlySet<string> = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export const DEMO_MODE_READ_ONLY = 'DEMO_MODE_READ_ONLY';

export const DEMO_MODE_READ_ONLY_MESSAGE =
  'La plateforme est en mode démonstration : les écritures sont suspendues. ' +
  'Vos saisies mobiles hors ligne continuent d’être acceptées. Demandez à un ' +
  'administrateur de désactiver le mode démonstration pour reprendre la saisie.';

@Injectable()
export class DemoReadOnlyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly demo: DemoVisibilityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Un autre transport rendrait un objet vide sur `switchToHttp()`.
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<{ method?: string }>();
    if (!MUTATING_METHODS.has((request.method ?? '').toUpperCase())) return true;

    // `getAllAndOverride` : la méthode l'emporte sur la classe, pour dispenser une
    // seule route d'un contrôleur par ailleurs bloqué.
    const reason = this.reflector.getAllAndOverride<string | undefined>(DEMO_WRITABLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (reason !== undefined) return true;

    // `state()` et non `enabled()` : le `false` de repli de `enabled()` voudrait
    // dire « laisse écrire » ici, et rouvrirait les écritures sur une panne de
    // lecture. Dans le doute on refuse.
    const state = await this.demo.state();
    if (state === 'off') return true;

    // Refuser dans le doute sans mentir sur la cause : `DEMO_MODE_READ_ONLY`
    // enverrait l'utilisateur vers un administrateur qui voit le mode éteint.
    if (state === 'unknown') throw demoStateUnknown();

    // 409 et non 403 : c'est l'état de la plateforme qui est en cause, pas le rôle.
    throw new ConflictException({
      code: DEMO_MODE_READ_ONLY,
      message: DEMO_MODE_READ_ONLY_MESSAGE,
    });
  }
}
