import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as RepresentantsModule from '@/lib/data/representants';
import { renderWithQuery } from '@/test/render-query';
import { setUrl } from '@/test/router-mock';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Deux vides, deux messages, et la distinction n'est pas cosmétique.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'état vide disait TOUJOURS « Aucun représentant ne correspond à ces critères.
 * Élargissez la recherche ou retirez un filtre. », y compris sans le moindre
 * critère posé. Une installation neuve, ou un compte qui ouvre l'écran pour la
 * première fois, se voyait donc renvoyé retirer des filtres qu'il n'avait jamais
 * mis : il cherchait, ne trouvait rien à retirer, et concluait à une panne.
 *
 * Le critère de bascule est le nombre de filtres ACTIFS, lu dans l'URL. Le test
 * pose donc une vraie URL plutôt que d'injecter un état : c'est le seul endroit
 * où ces critères vivent, et un correctif qui lirait ailleurs serait faux.
 */

const fetchRepresentants = vi.fn();

vi.mock('@/lib/data/representants', async () => {
  const actual = await vi.importActual<typeof RepresentantsModule>('@/lib/data/representants');
  return { ...actual, fetchRepresentants: () => fetchRepresentants() as unknown };
});

/**
 * La barre de filtres charge les référentiels (départements, IEF) pour ses
 * listes déroulantes. Ils n'ont aucun rapport avec l'état vide du tableau, et
 * les laisser partir ferait échouer le test sur un appel réseau absent.
 */
vi.mock('@/lib/data/reference', () => ({
  fetchDepartements: () => Promise.resolve([]),
  fetchIefs: () => Promise.resolve([]),
  fetchBanques: () => Promise.resolve([]),
  fetchSyndicats: () => Promise.resolve([]),
  fetchRegions: () => Promise.resolve([]),
}));

const { RepresentantsView } = await import('@/components/representants/representants-view');

const EMPTY_PAGE = {
  items: [],
  meta: { total: 0, page: 1, pageSize: 25, pageCount: 0 },
};

const ONE_PAGE = {
  items: [
    {
      id: 'r-1',
      fullName: 'Ndeye Fall',
      phoneE164: '+221771234567',
      departementId: 'd-1',
      departementName: 'Dakar',
      iefId: null,
      iefName: null,
      createdById: 'u-1',
      createdByName: 'Aminata Diallo',
      prospectCount: 12,
      clientCreatedAt: '2026-03-01T09:00:00.000Z',
      notes: null,
      createdAt: '2026-03-01T09:00:00.000Z',
      updatedAt: '2026-03-01T09:00:00.000Z',
    },
  ],
  meta: { total: 1, page: 1, pageSize: 25, pageCount: 1 },
};

describe('RepresentantsView, état vide', () => {
  beforeEach(() => {
    fetchRepresentants.mockReturnValue(Promise.resolve(EMPTY_PAGE));
  });

  it('sans aucun critère, ne renvoie PAS retirer un filtre inexistant', async () => {
    setUrl('/representants');
    renderWithQuery(<RepresentantsView />);

    expect(await screen.findByText('Aucun représentant enregistré.')).toBeTruthy();
    // La phrase fautive, celle qui envoyait chercher des filtres absents.
    expect(screen.queryByText(/retirez un filtre/)).toBeNull();
  });

  it('sans aucun critère, dit d’où viennent les fiches', async () => {
    setUrl('/representants');
    renderWithQuery(<RepresentantsView />);

    // Un état vide utile nomme le geste suivant : ici, la tournée mobile,
    // la saisie unitaire ou l'import.
    expect(await screen.findByText(/saisies en tournée depuis le mobile/)).toBeTruthy();
  });

  /**
   * L'état vide vit désormais HORS du `<tbody>`.
   *
   * Il y était enfermé dans un `<td colSpan={8}>`, ce qui le faisait disparaître
   * avec le tableau sous 1024 px : le petit écran n'avait alors ni liste, ni
   * message, ni la moindre indication que la requête avait abouti.
   */
  it('rend son état vide en dehors du tableau, pour qu’il survive au petit écran', async () => {
    setUrl('/representants');
    renderWithQuery(<RepresentantsView />);

    const message = await screen.findByText('Aucun représentant enregistré.');
    expect(message.closest('table')).toBeNull();
  });

  it('avec un critère actif, invite bien à l’élargir', async () => {
    setUrl('/representants?search=Ndeye');
    renderWithQuery(<RepresentantsView />);

    expect(
      await screen.findByText('Aucun représentant ne correspond à ces critères.'),
    ).toBeTruthy();
    expect(screen.getByText(/Élargissez la recherche ou retirez un filtre/)).toBeTruthy();
    expect(screen.queryByText('Aucun représentant enregistré.')).toBeNull();
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Huit colonnes, DEUX rendus.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'écran n'avait qu'un tableau de huit colonnes, sans repli en carte sous
 * 1024 px, alors que `/dossiers` en offre un pour exactement le même nombre de
 * colonnes. Sur 360 px, cela donne des colonnes de quarante pixels et un
 * balayage latéral pour lire une seule fiche.
 *
 * jsdom n'applique aucune requête de média : on ne peut donc pas éprouver LEQUEL
 * des deux est visible. Ce qui se vérifie, et qui est le fond du correctif,
 * c'est que le second rendu EXISTE, qu'il porte les mêmes données, et qu'il est
 * hors du tableau : un repli qui vivrait dans une cellule disparaîtrait avec lui.
 */
describe('RepresentantsView, repli en carte', () => {
  beforeEach(() => {
    fetchRepresentants.mockReturnValue(Promise.resolve(ONE_PAGE));
  });

  it('rend chaque représentant DEUX fois : en ligne de tableau et en carte', async () => {
    setUrl('/representants');
    renderWithQuery(<RepresentantsView />);

    const noms = await screen.findAllByText('Ndeye Fall');
    expect(noms).toHaveLength(2);
    expect(noms.filter((node) => node.closest('table') !== null)).toHaveLength(1);
    expect(noms.filter((node) => node.closest('table') === null)).toHaveLength(1);
  });

  it('la carte porte les mêmes champs que la ligne, sans en perdre un seul', async () => {
    setUrl('/representants');
    renderWithQuery(<RepresentantsView />);

    await screen.findAllByText('Ndeye Fall');
    const carte = screen.getAllByRole('article')[0];
    if (carte === undefined) throw new Error('Aucune carte de représentant.');

    expect(within(carte).getByText('Dakar')).toBeTruthy();
    expect(within(carte).getByText('Aminata Diallo')).toBeTruthy();
    // Le compte de prospects est l'information centrale : c'est lui qui dit si
    // une fiche compte.
    expect(within(carte).getByText('12')).toBeTruthy();
    expect(
      within(carte).getByRole('button', { name: /Modifier la fiche de Ndeye Fall/ }),
    ).toBeTruthy();
  });
});
