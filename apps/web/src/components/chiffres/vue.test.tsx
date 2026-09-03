import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChiffresView } from '@/components/chiffres/vue';
import { catalogueDe } from '@/components/chiffres/sources';
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
  fetchChiffresCampagne: vi.fn<() => Promise<never>>(),
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
  repCalls: 30,
  repWrongNumber: 0,
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
    },
    {
      id: '01a04329-af5e-7000-8000-000000000002',
      fullName: 'Moussa Ba',
      isActive: true,
    },
  ],
  prospectsByTeleconseiller: [],
  prospectsByRepresentant: [],
  repQualificationStatuses: null,
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
  it('représente la couverture et les appels hors attribution de la dernière campagne', () => {
    const catalogue = catalogueDe({ chues: true, voitLesMontants: true, role: 'ADMIN' });
    const campagne = {
      name: 'Programme de 50 fiches',
      performance: [
        {
          teleconseillerId: 'awa',
          teleconseillerName: 'Awa Fixture',
          assigned: 25,
          treated: 15,
          completionRate: 60,
          assignedCalls: 18,
          outsideAssignmentCalls: 4,
        },
      ],
    };

    expect(catalogue['couverture-derniere-campagne']?.extraire({ campagne })).toEqual({
      forme: 'composition',
      donnee: [
        {
          ligne: 'Awa Fixture',
          segments: [
            { id: 'traitees', label: 'Traitées', value: 15 },
            { id: 'restantes', label: 'Restantes', value: 10 },
          ],
        },
      ],
    });
    expect(catalogue['hors-attribution-derniere-campagne']?.extraire({ campagne })).toEqual({
      forme: 'classement',
      donnee: [{ id: 'awa', label: 'Awa Fixture', value: 4 }],
    });
  });

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
      expect(screen.getAllByText('Prospects saisis').length).toBeGreaterThan(0);
    });
    window.removeEventListener('error', noter);

    expect(abandons).toEqual([]);
    expect(screen.getAllByText('26').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Méthodes obtenues').length).toBeGreaterThan(0);
    expect(screen.getByText('Awa Sy')).toBeTruthy();
  });

  it('explique chaque KPI depuis son indice d’information', async () => {
    setUrl('/chues/statistiques');
    dispositionMock.mockResolvedValue(disposition(['prospects-notes']));
    activiteMock.mockResolvedValue(activite);
    const user = userEvent.setup();

    renderWithQuery(<ChiffresView ecran="chues" role={SUPERVISEUR} />);

    await user.click(await screen.findByRole('button', { name: 'À propos de Prospects saisis' }));
    expect(
      await screen.findByText('Le nombre de nouvelles fiches saisies pendant la période.'),
    ).toBeTruthy();
  });

  // Les taux par téléconseiller se relisent sur les sommes des lignes ; la
  // ligne « Équipe » vient de `totals`, calculé par le serveur.
  it('porte les trois taux par téléconseiller et une ligne d’équipe en pied', async () => {
    setUrl('/chues/statistiques');
    dispositionMock.mockResolvedValue(disposition(['par-teleconseiller']));
    activiteMock.mockResolvedValue(activite);

    renderWithQuery(<ChiffresView ecran="chues" role={SUPERVISEUR} />);

    const tableau = await screen.findByRole('table', { name: 'Par téléconseiller' });
    for (const entete of [
      'Appels représentants',
      'Contact',
      'Rendez-vous',
      'Qualification',
      'Méthodes obtenues',
    ]) {
      expect(within(tableau).getByRole('columnheader', { name: entete })).toBeTruthy();
    }
    const awa = within(tableau).getByRole('row', { name: /Awa Sy/u });
    expect(
      within(awa)
        .getAllByRole('cell')
        .map((cellule) => cellule.textContent),
    ).toEqual(['30', '70,0 %', '20,0 %', '66,7 %', '26', '12']);
    const equipe = within(tableau).getByRole('row', { name: /Équipe/u });
    expect(within(equipe).getAllByRole('cell')[1]?.textContent).toBe('70,0 %');
    // Moussa n'a rien fait : des taux « Sans objet », jamais « 0 % ».
    const moussa = within(tableau).getByRole('row', { name: /Moussa Ba/u });
    expect(within(moussa).getAllByRole('cell')[1]?.textContent).toBe('Sans objet');
  });

  it('au Grand Public, le tableau parle de joignabilité et non de représentants', async () => {
    setUrl('/grand-public/statistiques');
    dispositionMock.mockResolvedValue(disposition(['par-teleconseiller']));
    activiteMock.mockResolvedValue(activite);

    renderWithQuery(<ChiffresView ecran="grand-public" role={SUPERVISEUR} />);

    const tableau = await screen.findByRole('table', { name: 'Par téléconseiller' });
    expect(within(tableau).getByRole('columnheader', { name: 'Appels prospects' })).toBeTruthy();
    expect(within(tableau).getByRole('columnheader', { name: 'Joignabilité' })).toBeTruthy();
    expect(within(tableau).queryByRole('columnheader', { name: 'Qualification' })).toBeNull();
    const awa = within(tableau).getByRole('row', { name: /Awa Sy/u });
    expect(
      within(awa)
        .getAllByRole('cell')
        .map((cellule) => cellule.textContent),
    ).toEqual(['40', '87,5 %', '26', '12']);
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
      expect(screen.getAllByText('Prospects saisis').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Encaissé')).toBeNull();
  });

  it('ne propose pas les résultats par banque à un SUPERVISEUR', async () => {
    setUrl('/chues/statistiques');
    dispositionMock.mockResolvedValue(disposition(['par-banque']));
    activiteMock.mockResolvedValue(activite);

    renderWithQuery(<ChiffresView ecran="chues" role={SUPERVISEUR} />);

    await waitFor(() => {
      expect(screen.getByText(/écran est vide/iu)).toBeTruthy();
    });
    expect(screen.queryByText('Par banque')).toBeNull();
  });

  // Un représentant syndical n'existe pas hors CHUES : ces cartes seraient à zéro.
  it('n’offre pas la qualification des représentants au Grand Public', async () => {
    setUrl('/grand-public/statistiques');
    dispositionMock.mockResolvedValue(disposition(['prospects-notes', 'taux-de-contact']));
    activiteMock.mockResolvedValue(activite);

    renderWithQuery(<ChiffresView ecran="grand-public" role={SUPERVISEUR} />);

    await waitFor(() => {
      expect(screen.getAllByText('Prospects saisis').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Taux de joignabilité des représentants')).toBeNull();
  });

  // Deux familles d'appels sur le même écran : le titre de la tuile, et non son
  // seul info-bulle, doit dire de quels appels elle parle.
  it('nomme la famille d’appels dans le titre et dans le vide de chaque taux', async () => {
    setUrl('/chues/statistiques');
    dispositionMock.mockResolvedValue(disposition(['taux-de-contact', 'taux-de-joignabilite']));
    activiteMock.mockResolvedValue({
      ...activite,
      totals: { ...totaux, calls: 0, reachRate: null },
    });

    renderWithQuery(<ChiffresView ecran="chues" role={SUPERVISEUR} />);

    expect(
      (await screen.findAllByText('Taux de joignabilité des représentants')).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Taux de joignabilité des prospects').length).toBeGreaterThan(0);
    expect(screen.getByText('Sans objet')).toBeTruthy();
    expect(screen.getByText('Aucun appel à un prospect sur la période')).toBeTruthy();
  });
});
