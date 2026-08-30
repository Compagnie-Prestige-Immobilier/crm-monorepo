import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as LotsModule from '@/lib/data/lots-export';
import { renderWithQuery } from '@/test/render-query';

const fetchLotExport = vi.fn<(id: string) => unknown>();
const download = vi.fn<(input: unknown) => unknown>();

vi.mock('@/lib/data/lots-export', async () => {
  const actual = await vi.importActual<typeof LotsModule>('@/lib/data/lots-export');
  return { ...actual, fetchLotExport: (id: string) => fetchLotExport(id) as unknown };
});

vi.mock('@/components/exports/download-button', () => ({
  useFileDownload: () => ({ pending: false, download: (input: unknown) => download(input) }),
}));

const { LotExportDetailView } = await import('@/components/lots-export/lot-export-detail-view');

const LOT = {
  id: 'lot-1',
  name: 'Représentants, département de Thiès, 30 août 2026 à 14:02',
  cible: 'REPRESENTANTS',
  projet: 'CHUES',
  scopeLabel: 'Représentants, département de Thiès',
  itemCount: 340,
  createdById: 'u-1',
  createdByName: 'Administrateur CPI',
  createdAt: '2026-08-30T14:02:00.000Z',
  callsSince: 128,
  fichesAppelees: 91,
  callsByTeleconseiller: { 'Awa Fixture': 80, 'Fatou Fixture': 48 },
  distribution: { fichesParJour: 50, jours: 2 },
  repartition: [
    {
      teleconseillerId: 'u-awa',
      teleconseillerName: 'Awa Fixture',
      jours: [
        { jour: 1, fiches: 50 },
        { jour: 2, fiches: 40 },
      ],
    },
    {
      teleconseillerId: 'u-fatou',
      teleconseillerName: 'Fatou Fixture',
      jours: [
        { jour: 1, fiches: 50 },
        { jour: 2, fiches: 0 },
      ],
    },
  ],
  recentAttempts: [
    {
      id: 'a-1',
      phoneE164: '+221771234567',
      shortCode: 'AB12',
      outcome: 'REACHED',
      method: null,
      comment: 'Rappelle demain.',
      performedByName: 'Awa Fixture',
      createdAt: '2026-08-31T09:00:00.000Z',
      email: null,
      fonctionnaire: null,
      engagementEnCours: null,
      dureeEtablissementMois: null,
      rendezVousAt: null,
    },
  ],
};

beforeEach(() => {
  fetchLotExport.mockReturnValue(Promise.resolve(LOT));
});

describe('LotExportDetailView', () => {
  it('dit l’issue d’un appel en français, et jamais le code du serveur', async () => {
    renderWithQuery(<LotExportDetailView id="lot-1" />);

    expect(await screen.findByText('Joint')).toBeTruthy();
    expect(screen.queryByText('REACHED')).toBeNull();
    expect(screen.getByText('Rappelle demain.')).toBeTruthy();
  });

  it('rapporte les appels au nombre de fiches figées', async () => {
    renderWithQuery(<LotExportDetailView id="lot-1" />);

    expect(
      await screen.findByText(
        (_, node) => node?.textContent === '91 fiches appelées sur 340, 128 appels consignés.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Awa Fixture : 80')).toBeTruthy();
  });

  it('passe le classeur par le téléchargement authentifié, et non par un lien nu', async () => {
    const user = userEvent.setup();
    renderWithQuery(<LotExportDetailView id="lot-1" />);

    await user.click(await screen.findByRole('button', { name: 'Classeur Excel' }));
    await waitFor(() => {
      expect(download).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/api/v1/lots-export/lot-1/export.xlsx' }),
      );
    });

    await user.click(screen.getByRole('button', { name: 'Tous les programmes (ZIP)' }));
    await waitFor(() => {
      expect(download).toHaveBeenLastCalledWith(
        expect.objectContaining({ url: '/api/v1/lots-export/lot-1/programmes.zip' }),
      );
    });
  });

  it('donne un programme par téléconseiller et par jour', async () => {
    const user = userEvent.setup();
    renderWithQuery(<LotExportDetailView id="lot-1" />);

    const grille = await screen.findByRole('table', { name: 'Programmes d’appel' });
    expect(within(grille).getByRole('rowheader', { name: 'Awa Fixture' })).toBeTruthy();
    expect(within(grille).getByRole('columnheader', { name: 'Jour 2' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Programme de Awa Fixture, jour 2' }));
    await waitFor(() => {
      expect(download).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: '/api/v1/lots-export/lot-1/programme.pdf?teleconseillerId=u-awa&jour=2',
          fileName: 'programme-awa-fixture-jour-2.pdf',
        }),
      );
    });

    expect(
      screen
        .getByRole('button', { name: 'Programme de Fatou Fixture, jour 2' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('dit la répartition dans l’en-tête', async () => {
    renderWithQuery(<LotExportDetailView id="lot-1" />);

    expect(
      await screen.findByText(
        (_, node) =>
          node?.textContent ===
          'Représentants, département de Thiès · 340 fiches réparties entre 2 téléconseillers sur 2 jours, le 30 août 2026, par Administrateur CPI.',
      ),
    ).toBeTruthy();
  });

  it('dit le vide quand aucun appel n’a suivi', async () => {
    fetchLotExport.mockReturnValue(
      Promise.resolve({
        ...LOT,
        callsSince: 0,
        fichesAppelees: 0,
        callsByTeleconseiller: {},
        recentAttempts: [],
      }),
    );
    renderWithQuery(<LotExportDetailView id="lot-1" />);

    expect(await screen.findByText('Aucun appel consigné depuis la création.')).toBeTruthy();
  });
});
