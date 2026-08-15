import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { Observable } from 'rxjs';

import { DEMO_MODE_HEADER } from '../../modules/export/demo-marking.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';

/**
 * Estampille chaque réponse HTTP de l'état du mode démonstration.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UN INTERCEPTEUR GLOBAL PLUTÔT QU'UN EN-TÊTE PAR CONTRÔLEUR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le mode démonstration ne modifie pas seulement les exports : il modifie
 * TOUTES les lectures, donc tous les compteurs du tableau de bord. Une capture
 * d'écran de statistiques prise pendant une démonstration circule ensuite
 * exactement comme un classeur, sans la bannière qui l'accompagnait.
 *
 * Poser l'en-tête route par route reviendrait à parier qu'aucune route
 * analytique ne sera ajoutée sans y penser. L'intercepteur global renverse la
 * charge : un endpoint créé demain est estampillé sans que personne ait à s'en
 * souvenir.
 *
 * Il ne couvre PAS les réponses qui détournent le flux brut (`reply.hijack()`,
 * c'est-à-dire les exports Excel et les PDF) : celles-là posent l'en-tête
 * elles-mêmes, parce qu'elles écrivent avant que l'intercepteur ne reprenne la
 * main. C'est la seule exception, et elle est explicite dans les contrôleurs
 * concernés.
 *
 * La lecture du réglage est mise en cache deux secondes par
 * `DemoVisibilityService` : l'intercepteur n'ajoute donc pas un aller-retour
 * en base par requête.
 */
@Injectable()
export class DemoModeInterceptor implements NestInterceptor {
  constructor(private readonly demo: DemoVisibilityService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() === 'http') {
      const reply = context.switchToHttp().getResponse<FastifyReply>();
      // `sent` couvre le cas d'un contrôleur qui a déjà détourné le flux : y
      // écrire un en-tête lèverait, et transformerait un export réussi en 500.
      if (!reply.sent) {
        reply.header(DEMO_MODE_HEADER, (await this.demo.enabled()) ? 'true' : 'false');
      }
    }
    return next.handle();
  }
}
