import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DashboardVisitesView } from '@/components/accueil/tableau-de-bord/vue';
import type { VisiteStats } from '@/components/accueil/tableau-de-bord/sources';
import type * as VisitesDashboardModule from '@/lib/data/visites-dashboard';
import type { DashboardWidget, Disposition } from '@/lib/data/visites-dashboard';
import { renderWithQuery } from '@/test/render-query';

interface PresentationStub {
  palette?: string;
  valeurs?: boolean;
  legende?: boolean;
}

vi.mock('@/components/dashboard/visites-charts', () => {
  const stub = (nom: string) =>
    function Stub({
      items,
      presentation,
    }: {
      items?: readonly { label: string }[];
      presentation?: PresentationStub;
    }) {
      return (
        <div
          data-testid={`marque-${nom}`}
          data-palette={presentation?.palette ?? 'serie'}
          data-valeurs={presentation?.valeurs === true}
          data-legende={presentation?.legende === true}
        >
          {(items ?? []).map((item) => item.label).join(',')}
        </div>
      );
    };
  return {
    BarresVerticalesChart: stub('barres-verticales'),
    BarresHorizontalesChart: stub('barres-horizontales'),
    BarresGroupeesChart: stub('barres-groupees'),
    Barres100Chart: stub('barres-100'),
    BarresEmpileesChart: stub('barres-empilees'),
    CourbeChart: stub('courbe'),
    AireChart: stub('aire'),
    EscalierChart: stub('escalier'),
    AnneauChart: stub('anneau'),
    CamembertChart: stub('camembert'),
    AirePolaireChart: stub('aire-polaire'),
    RadarChart: stub('radar'),
    NuageChart: stub('nuage'),
    BullesChart: stub('bulles'),
    MixteChart: stub('mixte'),
    JaugeChart: stub('jauge'),
    CarteDeChaleurTable: stub('carte-de-chaleur'),
    TableauWidget: stub('tableau'),
    TuileWidget: function Tuile({ libelle }: { libelle: string }) {
      return <div data-testid="marque-tuile">{libelle}</div>;
    },
    TuileCourbeWidget: function TuileCourbe({ libelle }: { libelle: string }) {
      return <div data-testid="marque-tuile-courbe">{libelle}</div>;
    },
  };
});

const bucket = (id: string, label: string, count: number) => ({ id, code: id, label, count });

const stats: VisiteStats = {
  from: '2026-02-01',
  to: '2026-02-28',
  total: 40,
  parEntreprise: [bucket('e1', 'CPI', 30), bucket('e2', 'SANTARGILE', 10)],
  parDirection: [],
  parDestinataire: [],
  parObjet: [bucket('o1', 'VERSEMENT', 40)],
  parMois: [],
  parJour: [],
  sansDirection: 0,
  sansDestinataire: 0,
  parHeure: [],
  sansHeure: 0,
  parJourSemaine: [],
  parHeureJourSemaine: [],
  parAgent: [],
  parEntrepriseObjet: [],
  parDestinataireDirection: [],
  parObjetMois: [],
  recurrents: [],
  partRecurrents: 0,
  avecTelephone: 0,
  saisieDifferee: { memeJour: 0, lendemain: 0, plusTard: 0, delaiMedianHeures: null },
};

const widgets: DashboardWidget[] = [
  { id: 'total-visites-0', source: 'total-visites', marque: 'tuile' },
  { id: 'par-entreprise-1', source: 'par-entreprise', marque: 'barres-horizontales' },
];

const disposition: Disposition = {
  widgets,
  preset: 'essentiel',
  source: 'utilisateur',
  updatedAt: null,
};

const fetchDispositionMock = vi.hoisted(() => vi.fn());
const fetchStatsMock = vi.hoisted(() => vi.fn());
const saveDispositionMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/visites-dashboard', async () => {
  const actual = await vi.importActual<typeof VisitesDashboardModule>(
    '@/lib/data/visites-dashboard',
  );
  return {
    ...actual,
    fetchDisposition: fetchDispositionMock,
    fetchVisiteDashboardStats: fetchStatsMock,
    saveDisposition: saveDispositionMock,
    resetDisposition: vi.fn(),
    saveDefaultDisposition: vi.fn(),
  };
});

function cardTitles(): (string | null)[] {
  return Array.from(document.querySelectorAll('[data-slot="card-title"]')).map(
    (node) => node.textContent,
  );
}

function setup() {
  fetchDispositionMock.mockResolvedValue(disposition);
  fetchStatsMock.mockResolvedValue(stats);
  saveDispositionMock.mockResolvedValue(disposition);
  return renderWithQuery(<DashboardVisitesView role="ACCUEIL" />);
}

describe('DashboardVisitesView', () => {
  it('rend la disposition dans l’ordre', async () => {
    setup();
    await screen.findByText('Par entreprise');
    expect(cardTitles()).toEqual(['Total des visites', 'Par entreprise']);
  });

  it('Organiser fait apparaître les commandes', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Par entreprise');

    await user.click(screen.getByRole('button', { name: 'Organiser les graphiques' }));

    expect(await screen.findByRole('button', { name: 'Enregistrer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Monter Par entreprise/u })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Retirer Total des visites/u })).toBeTruthy();
  });

  it('Monter réordonne', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Par entreprise');
    await user.click(screen.getByRole('button', { name: 'Organiser les graphiques' }));

    await user.click(await screen.findByRole('button', { name: /Monter Par entreprise/u }));

    await waitFor(() => {
      expect(cardTitles()).toEqual(['Par entreprise', 'Total des visites']);
    });
  });

  it('Retirer retire un widget', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Par entreprise');
    await user.click(screen.getByRole('button', { name: 'Organiser les graphiques' }));

    await user.click(await screen.findByRole('button', { name: /Retirer Total des visites/u }));

    await waitFor(() => {
      expect(cardTitles()).not.toContain('Total des visites');
    });
  });

  it('Annuler restaure la disposition d’origine', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Par entreprise');
    await user.click(screen.getByRole('button', { name: 'Organiser les graphiques' }));
    await user.click(await screen.findByRole('button', { name: /Retirer Total des visites/u }));
    await waitFor(() => {
      expect(screen.queryByText('Total des visites')).toBeNull();
    });

    await user.click(screen.getByRole('button', { name: 'Quitter' }));
    await user.click(await screen.findByRole('button', { name: 'Quitter sans enregistrer' }));

    await waitFor(() => {
      expect(cardTitles()).toContain('Total des visites');
    });
  });

  it('le tiroir ne liste que les sources non placées', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Par entreprise');
    await user.click(screen.getByRole('button', { name: 'Organiser les graphiques' }));

    await user.click(await screen.findByRole('button', { name: 'Ajouter un graphique' }));

    const tiroir = await screen.findByRole('dialog');
    expect(within(tiroir).queryByText('Total des visites')).toBeNull();
    expect(within(tiroir).queryByText('Par entreprise')).toBeNull();
    expect(within(tiroir).getByText('Par objet')).toBeTruthy();
  });

  it('Enregistrer envoie exactement le corps attendu au client', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Par entreprise');
    await user.click(screen.getByRole('button', { name: 'Organiser les graphiques' }));
    await user.click(await screen.findByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(saveDispositionMock).toHaveBeenCalled();
    });
    const [ecran, sentWidgets] = saveDispositionMock.mock.calls[0] as [string, DashboardWidget[]];
    expect(ecran).toBe('visites');
    expect(sentWidgets.map((widget) => ({ source: widget.source, marque: widget.marque }))).toEqual(
      [
        { source: 'total-visites', marque: 'tuile' },
        { source: 'par-entreprise', marque: 'barres-horizontales' },
      ],
    );
  });

  it('changer la marque change le composant rendu', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByTestId('marque-tuile');
    await user.click(screen.getByRole('button', { name: 'Organiser les graphiques' }));

    await user.click(
      await screen.findByRole('button', { name: 'Changer la présentation de Total des visites' }),
    );
    await user.click(await screen.findByText('Jauge'));

    expect(await screen.findByTestId('marque-jauge')).toBeTruthy();
    expect(screen.queryByTestId('marque-tuile')).toBeNull();
  });

  it('un réglage changé modifie ce qui est passé au composant de marque', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByTestId('marque-barres-horizontales');
    await user.click(screen.getByRole('button', { name: 'Organiser les graphiques' }));

    await user.click(await screen.findByRole('button', { name: 'Réglages de Par entreprise' }));
    await user.click(await screen.findByRole('button', { name: 'Afficher les valeurs' }));

    await waitFor(() => {
      expect(screen.getByTestId('marque-barres-horizontales').dataset.valeurs).toBe('true');
    });
  });

  it('une commande de présentation sans effet n’est pas rendue', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByTestId('marque-tuile');
    await user.click(screen.getByRole('button', { name: 'Organiser les graphiques' }));

    // « Total des visites » est une tuile : aucun réglage d'aspect ne l'affecte.
    expect(screen.queryByRole('button', { name: 'Réglages de Total des visites' })).toBeNull();

    // « Par entreprise » honore la palette et les valeurs, pas la légende.
    await user.click(await screen.findByRole('button', { name: 'Réglages de Par entreprise' }));
    expect(await screen.findByText('Palette')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Afficher les valeurs' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Afficher la légende' })).toBeNull();
  });

  it('un widget sans données affiche son état vide', async () => {
    fetchDispositionMock.mockResolvedValue({
      widgets: [{ id: 'w1', source: 'par-objet', marque: 'barres-verticales' }],
      preset: 'essentiel',
      source: 'utilisateur',
      updatedAt: null,
    });
    fetchStatsMock.mockResolvedValue({ ...stats, parObjet: [bucket('o1', 'VERSEMENT', 0)] });
    renderWithQuery(<DashboardVisitesView role="ACCUEIL" />);

    expect(await screen.findByText('Aucune visite sur la période.')).toBeTruthy();
  });
});
