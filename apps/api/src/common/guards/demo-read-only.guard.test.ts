import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import {
  DEMO_MODE_READ_ONLY,
  DEMO_MODE_READ_ONLY_MESSAGE,
  DemoReadOnlyGuard,
} from './demo-read-only.guard.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { DEMO_MODE_STATE_UNKNOWN } from '../../prisma/demo-visibility.service.js';

import { AuthController } from '../../modules/auth/auth.controller.js';
import { DemoController } from '../../modules/demo/demo.controller.js';
import { NotificationsController } from '../../modules/notifications/notifications.controller.js';
import { NotificationTemplatesController } from '../../modules/notifications/templates.controller.js';
import { ProspectsController } from '../../modules/prospects/prospects.controller.js';
import { SyncController } from '../../modules/sync/sync.controller.js';

/**
 * Lecture seule pendant une démonstration, et les dispenses qui la rendent
 * vivable.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST VISE LES VRAIS CONTRÔLEURS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un test qui poserait lui-même la métadonnée sur une classe factice
 * vérifierait que `Reflector` sait lire ce que le test vient d'écrire, c'est à
 * dire rien. Les cas de dispense ci-dessous pointent donc les VRAIES classes
 * et les VRAIES méthodes : retirer `@DemoWritable` de `DemoController` fait
 * rougir « le mode démonstration peut encore être ÉTEINT », qui est le seul
 * test dont l'échec vaut incident de production.
 */

/** Contexte HTTP minimal, avec la classe et la méthode réellement visées. */
const contextFor = (
  method: string,
  target: { prototype: object },
  handlerName: string,
): ExecutionContext =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ method }) }),
    getClass: () => target,
    getHandler: () => (target.prototype as Record<string, unknown>)[handlerName],
  }) as unknown as ExecutionContext;

const guardWithDemo = (enabled: boolean | 'unknown'): DemoReadOnlyGuard =>
  new DemoReadOnlyGuard(new Reflector(), fakeDemoVisibility(enabled));

/** Le refus attendu, extrait pour être comparé champ à champ. */
const refusalOf = async (
  guard: DemoReadOnlyGuard,
  context: ExecutionContext,
): Promise<{ status: number; body: unknown }> => {
  try {
    await guard.canActivate(context);
  } catch (error) {
    const exception = error as { getStatus: () => number; getResponse: () => unknown };
    return { status: exception.getStatus(), body: exception.getResponse() };
  }
  throw new Error('La garde a laissé passer une écriture alors qu’elle devait refuser.');
};

describe('lecture seule pendant une démonstration', () => {
  it('refuse une écriture interactive quand le mode est ALLUMÉ', async () => {
    const refusal = await refusalOf(
      guardWithDemo(true),
      contextFor('POST', ProspectsController, 'create'),
    );

    // 409 et non 403 : ce n'est pas le rôle de l'appelant qui est en cause,
    // c'est l'état de la plateforme, et il changera.
    expect(refusal.status).toBe(409);
    expect(refusal.body).toEqual({
      code: DEMO_MODE_READ_ONLY,
      message: DEMO_MODE_READ_ONLY_MESSAGE,
    });
  });

  it('laisse passer la MÊME écriture quand le mode est éteint', async () => {
    await expect(
      guardWithDemo(false).canActivate(contextFor('POST', ProspectsController, 'create')),
    ).resolves.toBe(true);
  });

  it('couvre les quatre méthodes mutantes, et elles seules', async () => {
    const guard = guardWithDemo(true);

    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      await expect(
        guard.canActivate(contextFor(method, ProspectsController, 'create')),
      ).rejects.toThrow();
    }

    // Une lecture n'écrit rien : la bloquer viderait tous les écrans, et
    // consulterait le réglage sur chaque affichage de tableau de bord.
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      await expect(
        guard.canActivate(contextFor(method, ProspectsController, 'create')),
      ).resolves.toBe(true);
    }
  });

  it('reconnaît la méthode quelle que soit sa casse', async () => {
    // Fastify normalise en majuscules, mais un test ou un proxy peut ne pas le
    // faire, et une comparaison sensible à la casse ouvrirait TOUTES les
    // écritures d'un coup.
    await expect(
      guardWithDemo(true).canActivate(contextFor('post', ProspectsController, 'create')),
    ).rejects.toThrow();
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * DANS LE DOUTE, ON REFUSE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `DemoVisibilityService.enabled()` rend `false` quand la lecture du réglage
   * échoue. Ce repli est le bon pour la VISIBILITÉ : dans le doute, on masque
   * les lignes fictives, et personne ne lit de fausse donnée.
   *
   * La garde s'était branchée sur ce même booléen, où `false` veut dire « laisse
   * écrire ». Le repli réputé sûr s'inversait donc en changeant d'usage : une
   * panne de lecture pendant une démonstration rouvrait les écritures que le
   * mode venait de suspendre, sans rien signaler à personne.
   *
   * Ce test existe pour que ce raccourci ne soit pas repris. Il tombe dès que la
   * garde retourne à `enabled()`.
   */
  it('REFUSE l’écriture quand l’état du mode est indéterminé', async () => {
    await expect(
      guardWithDemo('unknown').canActivate(contextFor('POST', ProspectsController, 'create')),
    ).rejects.toThrow();
  });

  /**
   * ET IL LE DIT AVEC LE BON CODE.
   *
   * Le refus était le même dans les deux cas : « une démonstration est en
   * cours, demandez à un administrateur de la désactiver ». Sur une panne de
   * lecture du réglage alors que le mode est ÉTEINT, cette phrase envoie tous
   * les utilisateurs qui écrivent vers un administrateur qui ouvre l'écran et
   * voit le mode éteint. Personne n'a de prise sur ce qui est annoncé.
   *
   * `DEMO_MODE_STATE_UNKNOWN` nomme la vraie cause, et son message invite à
   * réessayer plutôt qu'à chercher un interrupteur.
   */
  it('et il NOMME LA VRAIE CAUSE au lieu d’annoncer une démonstration', async () => {
    const refusal = await refusalOf(
      guardWithDemo('unknown'),
      contextFor('POST', ProspectsController, 'create'),
    );

    expect(refusal.status).toBe(409);
    expect((refusal.body as { code: string }).code).toBe(DEMO_MODE_STATE_UNKNOWN);
    expect((refusal.body as { message: string }).message).not.toContain('administrateur');
  });

  it('laisse néanmoins passer une route dispensée, même dans le doute', async () => {
    // La remontée hors ligne du mobile n'est JAMAIS refusée : une file de
    // terrain ne doit pas échouer parce que le serveur hésite sur un réglage.
    await expect(
      guardWithDemo('unknown').canActivate(contextFor('POST', SyncController, 'push')),
    ).resolves.toBe(true);
  });

  it('ne lit pas le réglage sur une requête non mutante', async () => {
    let reads = 0;
    const counting = {
      // La garde interroge `state()` et non `enabled()` : elle doit distinguer
      // « éteint » d'« on ne sait pas », les deux ne commandant pas la même
      // décision. Le compteur porte donc sur `state`, sans quoi ce test
      // resterait vert alors que la garde lit le réglage à chaque GET.
      enabled: () => {
        reads += 1;
        return Promise.resolve(true);
      },
      state: () => {
        reads += 1;
        return Promise.resolve('on' as const);
      },
      invalidate: () => undefined,
    };

    const guard = new DemoReadOnlyGuard(
      new Reflector(),
      counting as unknown as ReturnType<typeof fakeDemoVisibility>,
    );

    await guard.canActivate(contextFor('GET', ProspectsController, 'list'));
    expect(reads).toBe(0);

    await expect(
      guard.canActivate(contextFor('POST', ProspectsController, 'create')),
    ).rejects.toThrow();
    expect(reads).toBe(1);
  });
});

describe('les dispenses, une par une', () => {
  /**
   * LE PIÈGE DE CETTE FONCTIONNALITÉ, ÉPINGLÉ ICI.
   *
   * Si les routes du contrôleur de démonstration étaient bloquées par le mode
   * qu'elles pilotent, la plateforme resterait en lecture seule POUR TOUJOURS,
   * sans autre issue qu'un UPDATE manuel sur `app_settings` en production.
   */
  it('le mode démonstration peut encore être ÉTEINT alors qu’il est allumé', async () => {
    await expect(
      guardWithDemo(true).canActivate(contextFor('POST', DemoController, 'disable')),
    ).resolves.toBe(true);
  });

  it('et il peut aussi être PURGÉ et RÉ-ACTIVÉ pendant qu’il est allumé', async () => {
    const guard = guardWithDemo(true);
    await expect(guard.canActivate(contextFor('POST', DemoController, 'purge'))).resolves.toBe(
      true,
    );
    // `enable` est idempotent : un second appel pendant que le mode est allumé
    // est le geste le plus banal de l'écran, il ne doit pas répondre 409.
    await expect(guard.canActivate(contextFor('POST', DemoController, 'enable'))).resolves.toBe(
      true,
    );
  });

  /**
   * L'EXEMPTION ABSOLUE. Une file hors ligne ne doit jamais être refusée parce
   * que quelqu'un a basculé un interrupteur au bureau.
   */
  it('la remontée hors ligne du mobile passe', async () => {
    await expect(
      guardWithDemo(true).canActivate(contextFor('POST', SyncController, 'push')),
    ).resolves.toBe(true);
  });

  it('les trois routes d’authentification passent', async () => {
    const guard = guardWithDemo(true);
    for (const route of ['login', 'refresh', 'logout']) {
      await expect(guard.canActivate(contextFor('POST', AuthController, route))).resolves.toBe(
        true,
      );
    }
  });

  it('marquer lue sa propre notification passe', async () => {
    await expect(
      guardWithDemo(true).canActivate(contextFor('POST', NotificationsController, 'markRead')),
    ).resolves.toBe(true);
  });

  it('l’aperçu d’un gabarit passe, il n’écrit rien malgré sa méthode POST', async () => {
    await expect(
      guardWithDemo(true).canActivate(
        contextFor('POST', NotificationTemplatesController, 'render'),
      ),
    ).resolves.toBe(true);
  });

  /**
   * LA DISPENSE EST PAR ROUTE, PAS PAR CONTRÔLEUR.
   *
   * `NotificationsController` porte une route dispensée (`read`) et des routes
   * bloquées. Une dispense posée par erreur sur la classe les ouvrirait toutes,
   * y compris la CRÉATION d'une campagne de notification, qui part réellement
   * en e-mail. Ce test est le filet de cette erreur-là.
   */
  it('les autres routes du MÊME contrôleur restent bloquées', async () => {
    const guard = guardWithDemo(true);
    for (const route of ['create', 'cancel']) {
      await expect(
        guard.canActivate(contextFor('POST', NotificationsController, route)),
      ).rejects.toThrow();
    }
  });
});
