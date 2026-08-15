import { screen } from '@testing-library/react';
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
