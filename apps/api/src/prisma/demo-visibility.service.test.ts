import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from './prisma.service.js';
import { DemoVisibilityService } from './demo-visibility.service.js';

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
    prisma.appSetting.findUnique.mockResolvedValue({ value: 'false' });
    demo = build();

    await demo.state();
    demo.invalidate();
    await demo.state();

    expect(prisma.appSetting.findUnique).toHaveBeenCalledTimes(2);
  });

  it('une lecture qui LÈVE ne laisse pas la fusion coincée', async () => {
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

    for (let index = 0; index < 100; index += 1) {
      expect(await demo.state()).toBe('unknown');
    }

    expect(prisma.appSetting.findUnique).toHaveBeenCalledTimes(1);
  });

  it('mais le doute ne se FIGE pas : il expire vite', async () => {
    vi.useFakeTimers();
    prisma.appSetting.findUnique.mockRejectedValueOnce(new Error('base injoignable'));
    demo = build();
    expect(await demo.state()).toBe('unknown');

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

describe('enabledForWrite', () => {
  it('REFUSE quand l’état est inconnu, là où enabled() rend false', async () => {
    prisma.appSetting.findUnique.mockRejectedValue(new Error('base injoignable'));
    demo = build();

    expect(await demo.enabled()).toBe(false);

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
    prisma.appSetting.findUnique.mockResolvedValue(null);
    demo = build();

    expect(await demo.state()).toBe('off');
    expect(await demo.state()).toBe('off');
    expect(await demo.enabled()).toBe(false);
    expect(prisma.appSetting.findUnique).toHaveBeenCalledTimes(1);
  });
});
