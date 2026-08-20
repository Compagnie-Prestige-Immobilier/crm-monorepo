import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as VisitesModule from '@/lib/data/visites';
import { renderWithQuery } from '@/test/render-query';
import { routerMock, setUrl } from '@/test/router-mock';

const fetchVisites = vi.hoisted(() => vi.fn());
const fetchReferentiels = vi.hoisted(() => vi.fn());
const updateVisite = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/visites', async () => {
  const actual = await vi.importActual<typeof VisitesModule>('@/lib/data/visites');
  return {
    ...actual,
    fetchVisites: (filters: unknown, today: unknown) => fetchVisites(filters, today) as unknown,
    fetchVisiteReferentiels: () => fetchReferentiels() as unknown,
    createVisite: vi.fn(),
    updateVisite: (id: unknown, input: unknown) => updateVisite(id, input) as unknown,
  };
});

const { RegistreView } = await import('@/components/accueil/registre-view');

const item = (id: string, code: string, label: string) => ({
  id,
  code,
  label,
  isActive: true,
  isSystem: true,
  sortOrder: 100,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const referentiels = {
  entreprises: [item('e-cpi', 'CPI', 'CPI'), item('e-sa', 'SANTARGILE', 'SANTARGILE')],
  directions: [item('d-com', 'COMMERCIALE', 'COMMERCIALE'), item('d-rdc', 'RDC_CPI', 'RDC CPI')],
  destinataires: [item('x-ndoye', 'NDOYE', 'MME. NDOYE (RESP. COMM.)')],
  objets: [
    item('o-achat', 'ACHAT_TERRAIN', 'ACHAT TERRAIN'),
    item('o-info', 'DEMANDE_INFOS', "DEMANDE D'INFORMATIONS"),
  ],
};

const ref = (id: string, code: string, label: string) => ({ id, code, label });

const visite = (over: Partial<VisitesModule.Visite> = {}): VisitesModule.Visite => ({
  id: 'v-1',
  reference: 'V-2026-000412',
  date: '2026-08-19',
  time: '09:35',
  visitorName: 'Awa Ndiaye',
  phone: '77 123 45 67',
  phoneE164: '+221771234567',
  entreprise: ref('e-cpi', 'CPI', 'CPI'),
  objet: ref('o-achat', 'ACHAT_TERRAIN', 'ACHAT TERRAIN'),
  direction: ref('d-com', 'COMMERCIALE', 'COMMERCIALE'),
  destinataire: ref('x-ndoye', 'NDOYE', 'MME. NDOYE (RESP. COMM.)'),
  comment: null,
  createdById: 'u-1',
  createdAt: '2026-08-19T09:35:00.000Z',
  ...over,
});

const page = (items: VisitesModule.Visite[], over: Record<string, number> = {}) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 100,
  pageCount: 1,
  ...over,
});

beforeEach(() => {
  fetchVisites.mockReset();
  fetchReferentiels.mockReset();
  updateVisite.mockReset();
  fetchVisites.mockResolvedValue(page([visite()]));
  fetchReferentiels.mockResolvedValue(referentiels);
  updateVisite.mockResolvedValue(visite({ visitorName: 'Awa Ndiaye Sow' }));
  setUrl('/accueil');
});

describe('registre du jour', () => {
  it('reprend les intitulés de colonnes du classeur', async () => {
    renderWithQuery(<RegistreView />);

    const table = await screen.findByRole('table');
    const entetes = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);

    for (const colonne of [
      'DATE VISITE',
      'HEURE VISITE',
      'PRENOM ET NOMS',
      'TELEPHONES',
      'ENTREPRISE',
      'DIRECTION',
      'DESTINATAIRES',
      'OBJET VISITE',
      'COMMENTAIRES / NOTES',
    ]) {
      expect(entetes, colonne).toContain(colonne);
    }
  });

  it('ne montre que la journée en cours tant qu’aucune période n’est demandée', async () => {
    renderWithQuery(<RegistreView />);

    await screen.findByRole('table');
    expect(fetchVisites).toHaveBeenCalledWith(
      expect.objectContaining({ toutePeriode: false, dateFrom: null, dateTo: null }),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u),
    );
    expect(screen.getByRole('button', { name: 'Aujourd’hui' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('remonte la visite la plus récente en haut', async () => {
    fetchVisites.mockResolvedValue(
      page([
        visite({ id: 'v-1', time: '09:00', visitorName: 'Awa Ndiaye' }),
        visite({ id: 'v-2', time: '14:30', visitorName: 'Moussa Fall' }),
      ]),
    );
    renderWithQuery(<RegistreView />);

    const table = await screen.findByRole('table');
    const lignes = within(table).getAllByRole('row').slice(1);

    expect(lignes[0]?.textContent).toContain('Moussa Fall');
    expect(lignes[1]?.textContent).toContain('Awa Ndiaye');
  });

  it('dit quoi faire quand la journée n’a encore aucune visite', async () => {
    fetchVisites.mockResolvedValue(page([]));
    renderWithQuery(<RegistreView />);

    expect(await screen.findByText(/Aucune visite enregistrée aujourd’hui/u)).toBeTruthy();
  });
});

describe('filtres du registre, dans l’adresse', () => {
  it('porte l’objet de visite dans l’URL', async () => {
    renderWithQuery(<RegistreView />);

    const user = userEvent.setup();
    const filtres = await screen.findByRole('region', { name: 'Rechercher dans le registre' });
    await user.click(within(filtres).getByRole('combobox', { name: /OBJET VISITE/u }));
    await user.click(await screen.findByRole('option', { name: /ACHAT TERRAIN/u }));

    expect(routerMock.push).toHaveBeenCalledWith('/accueil?objetId=o-achat', { scroll: false });
  });

  it('porte la recherche par nom ou n° de registre dans l’URL', async () => {
    renderWithQuery(<RegistreView />);

    const filtres = await screen.findByRole('region', { name: 'Rechercher dans le registre' });
    await userEvent
      .setup()
      .type(within(filtres).getByRole('textbox', { name: /Recherche/u }), '77');

    await waitFor(
      () => {
        expect(routerMock.replace).toHaveBeenCalledWith('/accueil?search=77', { scroll: false });
      },
      { timeout: 2000 },
    );
  });

  it('ouvre tout le registre, au-delà de la journée', async () => {
    renderWithQuery(<RegistreView />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Tout le registre' }));

    expect(routerMock.push).toHaveBeenCalledWith('/accueil?periode=tout', { scroll: false });
  });

  it('mène au-delà de la centième ligne, que la période entière dépasse', async () => {
    fetchVisites.mockResolvedValue(page([visite()], { total: 240, pageCount: 3 }));
    renderWithQuery(<RegistreView />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Page suivante' }));

    expect(routerMock.push).toHaveBeenCalledWith('/accueil?page=2', { scroll: false });
  });

  it('ne propose aucune page à tourner quand le registre tient sur une seule', async () => {
    renderWithQuery(<RegistreView />);

    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Page suivante' })).toBeNull();
  });

  it('relit la période et les filtres écrits dans l’adresse', async () => {
    setUrl('/accueil?periode=tout&objetId=o-achat');
    renderWithQuery(<RegistreView />);

    await screen.findByRole('table');
    expect(fetchVisites).toHaveBeenCalledWith(
      expect.objectContaining({ toutePeriode: true, objetId: 'o-achat' }),
      expect.any(String),
    );
    expect(
      screen.getByRole('button', { name: 'Tout le registre' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });
});

describe('correction d’une ligne', () => {
  it('corrige la ligne sur place, sans quitter le registre', async () => {
    renderWithQuery(<RegistreView />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Modifier la visite/u }));

    const correction = await screen.findByRole('form', { name: 'Corriger la visite' });
    const nom = within(correction).getByRole('textbox', { name: /PRENOM ET NOMS/u });
    await user.clear(nom);
    await user.type(nom, 'Awa Ndiaye Sow');
    await user.click(
      within(correction).getByRole('button', { name: /Enregistrer la correction/u }),
    );

    await waitFor(() => {
      expect(updateVisite).toHaveBeenCalledWith(
        'v-1',
        expect.objectContaining({ visitorName: 'Awa Ndiaye Sow' }),
      );
    });
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('referme la correction sans rien changer quand elle annule', async () => {
    renderWithQuery(<RegistreView />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Modifier la visite/u }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Enregistrer la correction/u })).toBeNull();
    });
    expect(updateVisite).not.toHaveBeenCalled();
  });
});
