import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from './prisma.service.js';
import { DemoVisibilityService } from './demo-visibility.service.js';

/**
 * LE SERVICE QUI RÉPOND « allumé, éteint, ou je ne sais pas ».
 *
 * Deux propriétés seulement sont testées ici, parce que ce sont les deux qui
 * ont un coût mesurable en production : le nombre de requêtes de réglage
 * envoyées à une base en peine, et le fait qu'un doute ne se fige pas.
 */

interface PrismaMock {
  appSetting: { findUnique: ReturnType<typeof vi.fn> };
}

let prisma: PrismaMock;
let demo: DemoVisibilityService;

const build = (): DemoVisibilityService =>
  new DemoVisibilityService(prisma as unknown as PrismaService);

beforeEach(() => {
  vi.useRealTimers();
  prisma = { appSetting: { findUnique: vi.fn() } };
});

describe('fusion des lectures concurrentes', () => {
  it('CINQUANTE APPELANTS SIMULTANÉS NE FONT QU’UNE REQUÊTE', async () => {
    // Le cache ne protège que les appels SÉQUENTIELS. Une API sert par nature
    // des appels simultanés : sans fusion, une expiration de cache déclenche
    // autant de requêtes que de requêtes HTTP en vol, et c'est précisément
    // quand la base souffre que le cache expire le plus souvent.
    let resolve: ((row: { value: string } | null) => void) | undefined;
    prisma.appSetting.findUnique.mockReturnValue(
      new Promise<{ value: string } | null>((r) => {
        resolve = r;
      }),
    );
    demo = build();

    const pending = Array.from({ length: 50 }, () => demo.state());
    resolve?.({ value: 'true' });
    const states = await Promise.all(pending);

    expect(prisma.appSetting.findUnique).toHaveBeenCalledTimes(1);
    expect(new Set(states)).toEqual(new Set(['on']));
  });

  it('et la fusion ne survit pas à la lecture : la suivante repart', async () => {
    // Une promesse jamais effacée servirait indéfiniment le même état, et la
    // bascule de l'administrateur ne serait plus jamais vue.
    prisma.appSetting.findUnique.mockResolvedValue({ value: 'false' });
    demo = build();

    await demo.state();
    demo.invalidate();
    await demo.state();

    expect(prisma.appSetting.findUnique).toHaveBeenCalledTimes(2);
  });

  it('une lecture qui LÈVE ne laisse pas la fusion coincée', async () => {
    // Sans le `finally`, une première lecture en échec figerait la promesse
    // rejetée et tous les appels suivants rendraient `unknown` pour toujours.
    prisma.appSetting.findUnique.mockRejectedValueOnce(new Error('base injoignable'));
    demo = build();

    expect(await demo.state()).toBe('unknown');

    prisma.appSetting.findUnique.mockResolvedValue({ value: 'true' });
    demo.invalidate();
    expect(await demo.state()).toBe('on');
  });
});

describe('cache négatif borné', () => {
  it('UNE PANNE NE FAIT PAS MARTELER LA BASE', async () => {
    vi.useFakeTimers();
    prisma.appSetting.findUnique.mockRejectedValue(new Error('base injoignable'));
    demo = build();

    // Cent lectures séquentielles pendant la panne, dans la même seconde.
    for (let index = 0; index < 100; index += 1) {
      expect(await demo.state()).toBe('unknown');
    }

    // Une seule requête : la base en difficulté n'a pas reçu le débit complet
    // de la plateforme au pire moment.
    expect(prisma.appSetting.findUnique).toHaveBeenCalledTimes(1);
  });

  it('mais le doute ne se FIGE pas : il expire vite', async () => {
    vi.useFakeTimers();
    prisma.appSetting.findUnique.mockRejectedValueOnce(new Error('base injoignable'));
    demo = build();
    expect(await demo.state()).toBe('unknown');

    // Le rétablissement doit être vu SANS attendre le TTL positif : c'est ce
    // qui distingue ce cache négatif d'une mise en cache de l'incertitude.
    prisma.appSetting.findUnique.mockResolvedValue({ value: 'true' });
    vi.advanceTimersByTime(1_100);

    expect(await demo.state()).toBe('on');
  });

  it('et une bascule efface le doute sans attendre', async () => {
    vi.useFakeTimers();
    prisma.appSetting.findUnique.mockRejectedValueOnce(new Error('base injoignable'));
    demo = build();
    expect(await demo.state()).toBe('unknown');

    prisma.appSetting.findUnique.mockResolvedValue({ value: 'true' });
    demo.invalidate();

    expect(await demo.state()).toBe('on');
  });
});

/**
 * LES DEUX REPLIS SONT OPPOSÉS, ET C'EST TOUT L'INTÉRÊT DE LA DISTINCTION.
 *
 * Le même échec de lecture doit MASQUER pour une visibilité et REFUSER pour une
 * écriture. Un booléen ne peut pas porter deux sens de sécurité contraires.
 */
describe('enabledForWrite', () => {
  it('REFUSE quand l’état est inconnu, là où enabled() rend false', async () => {
    prisma.appSetting.findUnique.mockRejectedValue(new Error('base injoignable'));
    demo = build();

    // La visibilité masque dans le doute : personne ne voit de fausse donnée.
    expect(await demo.enabled()).toBe(false);

    // L'écriture, elle, ne peut pas se contenter de ce `false` : il vaut
    // « cette ligne est RÉELLE », affirmation qu'on n'est pas en mesure de
    // faire. Les deux valeurs par défaut sont mauvaises, on n'en choisit donc
    // aucune.
    await expect(demo.enabledForWrite()).rejects.toMatchObject({
      response: { code: 'DEMO_MODE_STATE_UNKNOWN' },
    });
  });

  it('rend le même booléen qu’enabled() quand l’état est CONNU', async () => {
    prisma.appSetting.findUnique.mockResolvedValue({ value: 'true' });
    demo = build();
    expect(await demo.enabledForWrite()).toBe(true);

    prisma.appSetting.findUnique.mockResolvedValue({ value: 'false' });
    demo.invalidate();
    expect(await demo.enabledForWrite()).toBe(false);
  });
});

describe('ligne de réglage absente', () => {
  it('vaut ÉTEINT, et se met en cache comme tel', async () => {
    // Propriété rassurante à ne pas casser : supprimer la ligne de réglage ne
    // doit pas produire une incertitude permanente, sur une installation qui
    // n'a jamais fait de démonstration et n'a donc jamais écrit ce réglage.
    prisma.appSetting.findUnique.mockResolvedValue(null);
    demo = build();

    expect(await demo.state()).toBe('off');
    expect(await demo.state()).toBe('off');
    expect(await demo.enabled()).toBe(false);
    expect(prisma.appSetting.findUnique).toHaveBeenCalledTimes(1);
  });
});
