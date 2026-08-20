import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VisitesDashboard } from '@/components/accueil/dashboard-visites';
import type * as StatsModule from '@/lib/data/visites-stats';
import { renderWithQuery } from '@/test/render-query';

vi.mock('@/lib/data/visites-stats', async () => {
  const actual = await vi.importActual<typeof StatsModule>('@/lib/data/visites-stats');
  return { ...actual, fetchVisitesStats: fetchMock };
});

vi.mock('@/components/dashboard/charts', () => ({
  CategoryBarChart: ({ label }: { label: string }) => <div data-testid="graphique">{label}</div>,
}));

const fetchMock = vi.hoisted(() => vi.fn());

const bucket = (id: string, label: string, count: number) => ({ id, code: id, label, count });

const janvier: StatsModule.VisitesStats = {
  from: '2026-01-01',
  to: '2026-01-31',
  total: 36,
  parEntreprise: [
    bucket('e1', 'CPI', 35),
    bucket('e2', 'SANTARGILE', 1),
    bucket('e3', 'MAKE-UP ADDICTION', 0),
  ],
  parDirection: [
    bucket('d1', 'COMMERCIALE', 22),
    bucket('d2', 'FONCIERE', 0),
    bucket('d3', 'GENERALE', 8),
  ],
  parDestinataire: [bucket('p1', 'MME. NDOYE (RESP. COMM.)', 20), bucket('p2', 'M. SAMB (DG)', 0)],
  parObjet: [
    bucket('o1', 'VERSEMENT ECHEANCE', 6),
    bucket('o2', 'SUIVI DE DOSSIER', 30),
    bucket('o3', 'ACHAT TERRAIN', 0),
  ],
  parMois: [{ month: '2026-01', count: 36 }],
  parJour: [{ date: '2026-01-06', count: 3 }],
  sansDirection: 6,
  sansDestinataire: 16,
};

const moisVide: StatsModule.VisitesStats = {
  ...janvier,
  from: '2026-02-01',
  to: '2026-02-28',
  total: 0,
  parEntreprise: janvier.parEntreprise.map((ligne) => ({ ...ligne, count: 0 })),
  parDirection: janvier.parDirection.map((ligne) => ({ ...ligne, count: 0 })),
  parDestinataire: janvier.parDestinataire.map((ligne) => ({ ...ligne, count: 0 })),
  parObjet: janvier.parObjet.map((ligne) => ({ ...ligne, count: 0 })),
  parMois: [],
  parJour: [],
  sansDirection: 0,
  sansDestinataire: 0,
};

const janvier2026 = { annee: 2026, mois: 1 } as const;

function ligneDe(libelle: string): HTMLElement {
  const ligne = screen.getByText(libelle).closest('tr');
  if (ligne === null) throw new Error(`Aucune ligne pour ${libelle}`);
  return ligne;
}

describe('le tableau de bord des visites', () => {
  it('rend les repartitions du mois telles que le classeur les compte', async () => {
    fetchMock.mockResolvedValue(janvier);

    renderWithQuery(<VisitesDashboard periodeInitiale={janvier2026} />);

    expect(await screen.findByText(/Janvier 2026/u)).toBeTruthy();
    await screen.findByText('COMMERCIALE');

    expect(ligneDe('COMMERCIALE').textContent).toContain('22');
    expect(ligneDe('MME. NDOYE (RESP. COMM.)').textContent).toContain('20');
    expect(ligneDe('VERSEMENT ECHEANCE').textContent).toContain('6');
    expect(screen.getByText('36')).toBeTruthy();
    expect(screen.getByText('35')).toBeTruthy();
  });

  it('avoue les visites sans direction, que la repartition ne compte pas', async () => {
    fetchMock.mockResolvedValue(janvier);

    renderWithQuery(<VisitesDashboard periodeInitiale={janvier2026} />);
    await screen.findByText('COMMERCIALE');

    const directions = screen.getByText('Directions').closest<HTMLElement>('[data-slot="card"]');
    if (directions === null) throw new Error('Carte des directions absente');
    const ligne = within(directions).getByText('Non renseigné').closest('tr');
    if (ligne === null) throw new Error('Pied de tableau absent');

    expect(within(ligne).getByText('6')).toBeTruthy();
  });

  it('affiche zero, et non une case vide, sur un mois sans visite', async () => {
    fetchMock.mockResolvedValue(moisVide);

    renderWithQuery(<VisitesDashboard periodeInitiale={{ annee: 2026, mois: 2 }} />);

    expect(await screen.findByText(/Février 2026/u)).toBeTruthy();
    await screen.findByText('COMMERCIALE');

    expect(ligneDe('COMMERCIALE').textContent).toContain('0');
    expect(screen.getAllByText('Sans objet').length).toBeGreaterThan(0);
    expect(screen.queryByText(/^0 %$/u)).toBeNull();
  });

  it('bascule du mois au cumul annuel, et revient au mois', async () => {
    fetchMock.mockResolvedValue(janvier);
    const user = userEvent.setup();

    renderWithQuery(<VisitesDashboard periodeInitiale={janvier2026} />);
    await screen.findByText('COMMERCIALE');

    await user.click(screen.getByRole('button', { name: 'Année entière' }));

    await waitFor(() => {
      expect(screen.getByText(/Année 2026/u)).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith({ annee: 2026, mois: null });

    await user.click(screen.getByRole('button', { name: 'Janvier' }));

    await waitFor(() => {
      expect(screen.getByText(/Janvier 2026/u)).toBeTruthy();
    });
  });

  it('n’affiche pas de graphique journalier sur le cumul annuel', async () => {
    fetchMock.mockResolvedValue(janvier);

    renderWithQuery(<VisitesDashboard periodeInitiale={{ annee: 2026, mois: null }} />);

    expect(await screen.findByText(/Année 2026/u)).toBeTruthy();
    await screen.findAllByTestId('graphique');

    expect(screen.getAllByTestId('graphique').map((noeud) => noeud.textContent)).toEqual([
      'Visites par destinataire',
      'Visites par direction',
      'Visites par objet',
      'Visites par mois',
    ]);
  });

  it('garde les blocs du classeur avant les series du temps', async () => {
    fetchMock.mockResolvedValue(janvier);

    renderWithQuery(<VisitesDashboard periodeInitiale={janvier2026} />);
    await screen.findByText('COMMERCIALE');

    expect(screen.getAllByTestId('graphique').map((noeud) => noeud.textContent)).toEqual([
      'Visites par destinataire',
      'Visites par direction',
      'Visites par objet',
      'Visites par mois',
      'Visites par jour',
    ]);
  });

  it('chiffre les visites qu’aucune repartition ne compte', async () => {
    fetchMock.mockResolvedValue(janvier);

    renderWithQuery(<VisitesDashboard periodeInitiale={janvier2026} />);
    await screen.findByText('COMMERCIALE');

    const ecart = screen.getByText('Visites hors répartition').closest<HTMLElement>('section');
    if (ecart === null) throw new Error('Le bandeau des visites hors répartition est absent');

    expect(within(ecart).getByText('Sans entreprise').closest('div')?.textContent).toContain('0');
    expect(within(ecart).getByText('Sans destinataire').closest('div')?.textContent).toContain(
      '16',
    );
    expect(within(ecart).getByText('Sans direction').closest('div')?.textContent).toContain('6');
  });

  it('exporte les chiffres de la periode affichee', async () => {
    fetchMock.mockResolvedValue(janvier);
    const user = userEvent.setup();

    const blobs: Blob[] = [];
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (blob: Blob) => {
        blobs.push(blob);
        return 'blob:visites';
      },
      revokeObjectURL: () => undefined,
    });

    renderWithQuery(<VisitesDashboard periodeInitiale={janvier2026} />);
    await screen.findByText('COMMERCIALE');

    await user.click(screen.getByRole('button', { name: /Exporter/u }));

    expect(blobs).toHaveLength(1);
    const texte = await blobs[0]?.text();
    expect(texte).toContain('Visites de janvier 2026');
    expect(texte).toContain('CPI;35');
    expect(texte).toContain('Total;36');

    vi.unstubAllGlobals();
  });
});
