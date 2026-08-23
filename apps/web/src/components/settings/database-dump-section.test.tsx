import { screen, waitFor } from '@testing-library/react';
import { ApiError } from '@crm/api-client/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DumpModule from '@/lib/data/db-dump';
import { renderWithQuery } from '@/test/render-query';

const fetchDatabaseDump = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/db-dump', async () => {
  const actual = await vi.importActual<typeof DumpModule>('@/lib/data/db-dump');
  return { ...actual, fetchDatabaseDump };
});

const { DatabaseDumpSection, estIndisponible } =
  await import('@/components/settings/database-dump-section');

const apiError = (status: number): ApiError =>
  new ApiError({ code: 'x', message: 'x' }, new Response(null, { status }));

beforeEach(() => {
  fetchDatabaseDump.mockReset();
});

describe('carte d’export intégral', () => {
  // `DB_DUMP_ENABLED` vaut faux par défaut : l'admin voyait une carte rouge
  // « Introuvable », sans reprise possible, sur un déploiement conforme.
  it('disparaît quand la fonction est fermée', async () => {
    fetchDatabaseDump.mockRejectedValue(apiError(404));
    const { container } = renderWithQuery(<DatabaseDumpSection />);

    await waitFor(() => {
      expect(container.textContent).toBe('');
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('disparaît aussi dans l’espace de démonstration', () => {
    expect(estIndisponible(apiError(403))).toBe(true);
  });

  it('mais une vraie panne reste une panne', () => {
    expect(estIndisponible(apiError(500))).toBe(false);
    expect(estIndisponible(new Error('réseau'))).toBe(false);
  });

  it('rend la carte quand la fonction est ouverte', async () => {
    fetchDatabaseDump.mockResolvedValue({
      status: 'expired',
      requestedAt: null,
      readyAt: null,
      expiresAt: null,
      sizeBytes: null,
      noticeStatus: 'INBOX_ONLY',
    });
    renderWithQuery(<DatabaseDumpSection />);

    expect(await screen.findByText('Export intégral de la base')).toBeTruthy();
  });
});
