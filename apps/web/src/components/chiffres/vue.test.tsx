import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChiffresView } from '@/components/chiffres/vue';
import type * as DispositionModule from '@/lib/data/disposition';
import type { Role } from '@/lib/types';
import { renderWithQuery } from '@/test/render-query';
import { setUrl } from '@/test/router-mock';

const SUPERVISEUR: Role = 'SUPERVISEUR';

const activiteMock = vi.hoisted(() => vi.fn<() => Promise<unknown>>());
const dispositionMock = vi.hoisted(() => vi.fn<() => Promise<unknown>>());

// Seuls les jeux des cartes POSÉES doivent partir : les autres rejettent, et
// une requête de trop ferait rougir le test au lieu de passer inaperçue.
vi.mock('@/lib/data/chiffres', () => ({
  fetchChiffresActivite: activiteMock,
  fetchChiffresEntonnoir: vi.fn<() => Promise<never>>(),
  fetchChiffresDelais: vi.fn<() => Promise<never>>(),
  fetchChiffresRendement: vi.fn<() => Promise<never>>(),
  fetchChiffresMethodes: vi.fn<() => Promise<never>>(),
  fetchChiffresBanques: vi.fn<() => Promise<never>>(),
}));

vi.mock('@/lib/data/disposition', async () => {
  const actual = await vi.importActual<typeof DispositionModule>('@/lib/data/disposition');
  return {
    ...actual,
    fetchDisposition: dispositionMock,
    saveDisposition: vi.fn<() => Promise<never>>(),
    resetDisposition: vi.fn<() => Promise<never>>(),
    saveDefaultDisposition: vi.fn<() => Promise<never>>(),
  };
});

const totaux = {
  calls: 40,
  unreachable: 4,
  wrongNumber: 1,
  refused: 3,
  other: 0,
  methodObtained: 12,
  callback: 5,
  reachRate: 87.5,
  prospectsCreated: 26,
  representantsContacted: 9,
  tasksClosed: 18,
  repCalls: 30,
  repReached: 21,
  repCallback: 6,
  repUnreachable: 3,
  repOther: 0,
  repContactRate: 70,
  repCallbackRate: 20,
  repQuestioned: 21,
  repQualified: 14,
  repQualificationRate: 66.7,
};

const activite = {
  from: '2026-08-01T00:00:00.000Z',
  to: '2026-08-28T23:59:59.999Z',
  granularity: 'day',
  totals: totaux,
  items: [
    {
      ...totaux,
      bucket: '2026-08-27',
      teleconseillerId: '01a04329-af5e-7000-8000-000000000001',
      teleconseillerName: 'Awa Sy',
    },
  ],
  teleconseillers: [
    {
      id: '01a04329-af5e-7000-8000-000000000001',
      fullName: 'Awa Sy',
      isActive: true,
      openTasks: 7,
    },
    {
      id: '01a04329-af5e-7000-8000-000000000002',
      fullName: 'Moussa Ba',
      isActive: true,
      openTasks: 2,
    },
  ],
  prospectsByTeleconseiller: [],
  prospectsByRepresentant: [],
};

const disposition = (sources: string[]) => ({
  widgets: sources.map((source, index) => ({
    id: `${source}-${String(index)}`,
    source,
    marque: source === 'par-teleconseiller' ? 'tableau' : 'tuile',
    taille: 'demi',
  })),
  preset: 'essentiel',
  source: 'usine',
  updatedAt: null,
});

describe('l’écran Chiffres, du squelette aux chiffres', () => {
  it('affiche les cartes posées une fois la requête revenue', async () => {
    setUrl('/chues/statistiques');
    dispositionMock.mockResolvedValue(
      disposition(['prospects-notes', 'adhesions', 'par-teleconseiller']),
    );
    activiteMock.mockResolvedValue(activite);

    const abandons: string[] = [];
    const noter = (event: ErrorEvent): void => {
      abandons.push(event.error instanceof Error ? event.error.message : String(event.message));
    };
    window.addEventListener('error', noter);

    renderWithQuery(<ChiffresView ecran="chues" role={SUPERVISEUR} />);

    await waitFor(() => {
      expect(screen.getAllByText('Prospects notés').length).toBeGreaterThan(0);
    });
    window.removeEventListener('error', noter);

    expect(abandons).toEqual([]);
    expect(screen.getAllByText('26').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Adhésions obtenues').length).toBeGreaterThan(0);
    expect(screen.getByText('Awa Sy')).toBeTruthy();
  });

  // Base UI rend la VALEUR de l'item si on ne lui donne rien d'autre : le
  // déclencheur affichait l'identifiant du téléconseiller en clair.
  it('nomme le téléconseiller choisi au lieu de son identifiant', async () => {
    setUrl('/chues/statistiques?teleconseiller=01a04329-af5e-7000-8000-000000000002');
    dispositionMock.mockResolvedValue(disposition(['prospects-notes']));
    activiteMock.mockResolvedValue(activite);

    renderWithQuery(<ChiffresView ecran="chues" role={SUPERVISEUR} />);

    const declencheur = await screen.findByRole('combobox', { name: 'Téléconseiller regardé' });
    expect(declencheur.textContent).toContain('Moussa Ba');
    expect(declencheur.textContent).not.toContain('01a04329');
  });

  it('annonce « Toute l’équipe » quand aucun téléconseiller n’est choisi', async () => {
    setUrl('/chues/statistiques');
    dispositionMock.mockResolvedValue(disposition(['prospects-notes']));
    activiteMock.mockResolvedValue(activite);

    renderWithQuery(<ChiffresView ecran="chues" role={SUPERVISEUR} />);

    const declencheur = await screen.findByRole('combobox', { name: 'Téléconseiller regardé' });
    expect(declencheur.textContent).toContain('Toute l’équipe');
  });

  // Le pilotage d'équipe parle d'appels, pas de recette : la carte des montants
  // ne doit même pas être proposée à un superviseur.
  it('n’ouvre pas les montants à un SUPERVISEUR', async () => {
    setUrl('/chues/statistiques');
    dispositionMock.mockResolvedValue(disposition(['prospects-notes', 'encaisse']));
    activiteMock.mockResolvedValue(activite);

    renderWithQuery(<ChiffresView ecran="chues" role={SUPERVISEUR} />);

    await waitFor(() => {
      expect(screen.getAllByText('Prospects notés').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Encaissé')).toBeNull();
  });

  // Un représentant syndical n'existe pas hors CHUES : ces cartes seraient à zéro.
  it('n’offre pas la qualification des représentants au Grand Public', async () => {
    setUrl('/grand-public/statistiques');
    dispositionMock.mockResolvedValue(disposition(['prospects-notes', 'appels-de-qualification']));
    activiteMock.mockResolvedValue(activite);

    renderWithQuery(<ChiffresView ecran="grand-public" role={SUPERVISEUR} />);

    await waitFor(() => {
      expect(screen.getAllByText('Prospects notés').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Appels aux représentants')).toBeNull();
  });
});
