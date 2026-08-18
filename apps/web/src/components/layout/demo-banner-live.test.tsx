import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DemoModule from '@/lib/data/demo';
import { LIVE_INTERVAL_MS, LIVE_SLOW_INTERVAL_MS } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';
import { renderWithQuery } from '@/test/render-query';

const COUNTS = {
  users: 0,
  representants: 0,
  prospects: 0,
  campaigns: 0,
  campaignCommerciaux: 0,
  callTasks: 0,
  callAttempts: 0,
  bankCases: 0,
  bankCaseTransitions: 0,
};

function apiStatus(enabled: boolean) {
  return { enabled, canToggle: true, reason: null, seededAt: '', counts: COUNTS };
}

const fetchDemoStatus = vi.fn();

vi.mock('@/lib/data/demo', async () => {
  const actual = await vi.importActual<typeof DemoModule>('@/lib/data/demo');
  return { ...actual, fetchDemoStatus: () => fetchDemoStatus() as unknown };
});

const { DemoBannerLive } = await import('@/components/layout/demo-banner-live');

async function passerUnCycle(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(LIVE_SLOW_INTERVAL_MS + 1_000);
  });
}

function masquerOnglet(): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'hidden',
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchDemoStatus.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
});

describe('DemoBannerLive', () => {
  it('affiche le bandeau dès le premier rendu, sans attendre le réseau', () => {
    fetchDemoStatus.mockReturnValue(new Promise(() => {}));

    renderWithQuery(<DemoBannerLive initial={{ enabled: true, seededAt: null }} role="ADMIN" />);

    expect(screen.getByRole('status').textContent).toMatch(/Mode démonstration actif/u);
  });

  it('ne rend rien quand le mode est éteint', () => {
    fetchDemoStatus.mockReturnValue(new Promise(() => {}));

    renderWithQuery(<DemoBannerLive initial={{ enabled: false, seededAt: null }} role="ADMIN" />);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('fait apparaître le bandeau quand un autre poste allume le mode', async () => {
    fetchDemoStatus.mockResolvedValue(apiStatus(true));

    renderWithQuery(
      <DemoBannerLive initial={{ enabled: false, seededAt: null }} role="COMMERCIAL" />,
    );
    expect(screen.queryByRole('status')).toBeNull();

    await passerUnCycle();

    expect(screen.getByRole('status').textContent).toMatch(/écritures suspendues/u);
  });

  it('fait disparaître le bandeau quand le mode est éteint ailleurs', async () => {
    fetchDemoStatus.mockResolvedValue(apiStatus(false));

    renderWithQuery(
      <DemoBannerLive
        initial={{ enabled: true, seededAt: '2026-03-04T10:00:00.000Z' }}
        role="ADMIN"
      />,
    );
    expect(screen.getByRole('status')).toBeTruthy();

    await passerUnCycle();

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('n’empile pas un second bandeau sur celui du serveur', async () => {
    fetchDemoStatus.mockResolvedValue(apiStatus(true));

    renderWithQuery(<DemoBannerLive initial={{ enabled: true, seededAt: null }} role="ADMIN" />);

    await passerUnCycle();
    await passerUnCycle();

    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('suit une bascule faite depuis ce poste, sans attendre le cycle', async () => {
    fetchDemoStatus.mockResolvedValue(apiStatus(true));

    const { client } = renderWithQuery(
      <DemoBannerLive initial={{ enabled: false, seededAt: null }} role="ADMIN" />,
    );

    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.demoStatus });
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole('status').textContent).toMatch(/Mode démonstration actif/u);
  });

  it('sonde au rythme lent, et non à celui des tableaux de bord', async () => {
    fetchDemoStatus.mockResolvedValue(apiStatus(true));

    renderWithQuery(<DemoBannerLive initial={{ enabled: false, seededAt: null }} role="ADMIN" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_INTERVAL_MS + 1_000);
    });
    expect(fetchDemoStatus).not.toHaveBeenCalled();

    await passerUnCycle();
    expect(fetchDemoStatus).toHaveBeenCalledTimes(1);
  });

  it('ne sonde pas tant que l’onglet est en arrière-plan', async () => {
    masquerOnglet();
    fetchDemoStatus.mockResolvedValue(apiStatus(true));

    renderWithQuery(<DemoBannerLive initial={{ enabled: false, seededAt: null }} role="ADMIN" />);

    await passerUnCycle();
    await passerUnCycle();
    await passerUnCycle();

    expect(fetchDemoStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('garde le bandeau quand un cycle de sondage échoue', async () => {
    fetchDemoStatus.mockRejectedValue(new Error('réseau'));

    renderWithQuery(<DemoBannerLive initial={{ enabled: true, seededAt: null }} role="ADMIN" />);

    await passerUnCycle();

    expect(screen.getByRole('status')).toBeTruthy();
  });
});
