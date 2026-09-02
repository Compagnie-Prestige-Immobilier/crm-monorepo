import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@crm/api-client/query';
import type * as LotsModule from '@/lib/data/lots-export';
import { renderWithQuery } from '@/test/render-query';

const fetchLotsExport = vi.fn<(query: unknown) => unknown>();
const previewLotExport = vi.fn<(body: unknown) => unknown>();
const createLotExport = vi.fn<(body: unknown) => unknown>();
const fetchTeleconseillers = vi.fn<() => unknown>();
const download = vi.fn<(input: unknown) => unknown>();
const push = vi.fn<(href: string) => void>();

vi.mock('@/lib/data/lots-export', async () => {
  const actual = await vi.importActual<typeof LotsModule>('@/lib/data/lots-export');
  return {
    ...actual,
    fetchLotsExport: (query: unknown) => fetchLotsExport(query) as unknown,
    previewLotExport: (body: unknown) => previewLotExport(body) as unknown,
    createLotExport: (body: unknown) => createLotExport(body) as unknown,
    fetchTeleconseillers: () => fetchTeleconseillers() as unknown,
  };
});

vi.mock('@/lib/data/reference', () => ({
  fetchDepartements: () => Promise.resolve([]),
  fetchIefs: () => Promise.resolve([]),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/components/exports/download-button', () => ({
  useFileDownload: () => ({ pending: false, download: (input: unknown) => download(input) }),
}));

const { LotsExportView } = await import('@/components/lots-export/lots-export-view');

const VIDE = { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1 };

const UN_LOT = {
  items: [
    {
      id: 'lot-1',
      name: 'Prospects CHUES, segment BDD2, 30 août 2026 à 14:02',
      cible: 'PROSPECTS',
      projet: 'CHUES',
      scopeLabel: 'CHUES, segment BDD2',
      itemCount: 340,
      createdById: 'u-1',
      createdByName: 'Administrateur CPI',
      createdAt: '2026-08-30T14:02:00.000Z',
      callsSince: 128,
      fichesAppelees: 91,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 25,
  pageCount: 1,
};

const EQUIPE = [
  { id: 'u-awa', fullName: 'Awa Fixture', role: 'COMMERCIAL' },
  { id: 'u-fatou', fullName: 'Fatou Fixture', role: 'COMMERCIAL' },
];

/** Deux téléconseillers × 50 fiches × 1 jour : 100 places pour 340 fiches. */
const APERCU_DEBORDE = {
  eligible: 340,
  scopeLabel: 'CHUES',
  places: 100,
  retenues: 100,
  parTeleconseiller: 50,
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchLotsExport.mockReturnValue(Promise.resolve(VIDE));
  fetchTeleconseillers.mockReturnValue(Promise.resolve(EQUIPE));
  previewLotExport.mockReturnValue(Promise.resolve(APERCU_DEBORDE));
  createLotExport.mockReturnValue(
    Promise.resolve({ ...UN_LOT.items[0], id: 'lot-neuf', name: 'Prospects CHUES, 30 août 2026' }),
  );
});

describe('LotsExportView, la liste', () => {
  it('dit à quoi sert une campagne, et ce qu’il faut faire quand il n’y en a aucune', async () => {
    renderWithQuery(<LotsExportView canCreate projet="CHUES" />);

    expect(await screen.findByText('Aucune campagne pour l’instant.')).toBeTruthy();
    expect(screen.getByText(/répartit des fiches entre les téléconseillers/)).toBeTruthy();
    expect(screen.getByText('Créez-en une pour répartir des fiches.')).toBeTruthy();
  });

  it('annonce les appels passés sur les fiches depuis la création', async () => {
    fetchLotsExport.mockReturnValue(Promise.resolve(UN_LOT));
    renderWithQuery(<LotsExportView canCreate projet="CHUES" />);

    expect(await screen.findByText('128 appels sur 91 fiches depuis la création.')).toBeTruthy();
    expect(screen.getByText(/CHUES, segment BDD2 ·/)).toBeTruthy();
    expect(screen.getByText('340')).toBeTruthy();
    expect(screen.getByRole('link', { name: /segment BDD2/ }).getAttribute('href')).toBe(
      '/chues/campagnes/lot-1',
    );
  });

  it('cache la création à qui n’y a pas droit', async () => {
    renderWithQuery(<LotsExportView canCreate={false} projet="CHUES" />);

    expect(await screen.findByText('Aucune campagne pour l’instant.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nouvelle campagne' })).toBeNull();
  });

  it('ne demande que les campagnes du projet de la coque', async () => {
    renderWithQuery(<LotsExportView canCreate projet="CHUES" />);

    await waitFor(() => {
      expect(fetchLotsExport).toHaveBeenLastCalledWith(
        expect.objectContaining({ projet: 'CHUES' }),
      );
    });
  });

  it('garde la campagne Grand Public dans SA coque, et n’y filtre aucune cible', async () => {
    fetchLotsExport.mockReturnValue(
      Promise.resolve({
        ...UN_LOT,
        items: [
          {
            ...UN_LOT.items[0],
            name: 'Prospects Grand Public, 30 août 2026',
            projet: 'GRAND_PUBLIC',
            scopeLabel: 'Grand Public',
          },
        ],
      }),
    );
    renderWithQuery(<LotsExportView canCreate projet="GRAND_PUBLIC" />);

    const lien = await screen.findByRole('link', { name: /Prospects Grand Public/ });
    expect(lien.getAttribute('href')).toBe('/grand-public/campagnes/lot-1');
    expect(fetchLotsExport).toHaveBeenLastCalledWith(
      expect.objectContaining({ projet: 'GRAND_PUBLIC' }),
    );
    expect(screen.queryByLabelText('Cible')).toBeNull();
  });
});

async function ouvrirLaCreation(
  projet: 'CHUES' | 'GRAND_PUBLIC' = 'CHUES',
): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  renderWithQuery(<LotsExportView canCreate projet={projet} />);
  await user.click(await screen.findByRole('button', { name: 'Nouvelle campagne' }));
  return user;
}

/** Le bouton n'est actif qu'une fois l'équipe lue et l'aperçu compté. */
async function creerLeLot(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const bouton = await screen.findByRole('button', { name: 'Créer la campagne' });
  await waitFor(() => {
    expect(bouton.hasAttribute('disabled')).toBe(false);
  });
  await user.click(bouton);
}

describe('LotCreateDialog, la création', () => {
  it('coche tous les téléconseillers et les envoie dans la répartition', async () => {
    await ouvrirLaCreation();

    expect(await screen.findByRole('checkbox', { name: 'Awa Fixture' })).toHaveProperty(
      'checked',
      true,
    );
    expect(screen.getByRole('checkbox', { name: 'Fatou Fixture' })).toHaveProperty('checked', true);

    await waitFor(() => {
      expect(previewLotExport).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cible: 'PROSPECTS',
          prospects: expect.objectContaining({ projet: 'CHUES' }),
          distribution: { teleconseillerIds: ['u-awa', 'u-fatou'], fichesParJour: 50, jours: 1 },
        }),
      );
    });
  });

  it('inclut supervision et direction en annonçant leur capacité réduite', async () => {
    fetchTeleconseillers.mockReturnValue(
      Promise.resolve([
        { id: 'u-supervision', fullName: 'Superviseur Fixture', role: 'SUPERVISEUR' },
        { id: 'u-direction', fullName: 'Direction Fixture', role: 'DIRECTION' },
      ]),
    );

    await ouvrirLaCreation();

    expect(
      await screen.findByRole('checkbox', { name: 'Superviseur Fixture (20 %)' }),
    ).toHaveProperty('checked', true);
    expect(screen.getByRole('checkbox', { name: 'Direction Fixture (20 %)' })).toHaveProperty(
      'checked',
      true,
    );
  });

  it('n’envoie que les comptes restés cochés', async () => {
    const user = await ouvrirLaCreation();
    await user.click(await screen.findByRole('checkbox', { name: 'Awa Fixture' }));

    await waitFor(() => {
      expect(previewLotExport).toHaveBeenLastCalledWith(
        expect.objectContaining({
          distribution: expect.objectContaining({ teleconseillerIds: ['u-fatou'] }),
        }),
      );
    });

    await creerLeLot(user);
    await waitFor(() => {
      expect(createLotExport).toHaveBeenCalledWith(
        expect.objectContaining({
          distribution: expect.objectContaining({ teleconseillerIds: ['u-fatou'] }),
        }),
      );
    });
  });

  it('reprend l’aperçu du serveur mot pour mot, sans recompter', async () => {
    await ouvrirLaCreation();

    expect(
      await screen.findByText(
        '340 fiches disponibles pour 100 places : 100 seront réparties selon les capacités choisies ; 240 attendront une prochaine campagne.',
      ),
    ).toBeTruthy();
  });

  it('dit ce que la répartition absorbe quand les places suffisent', async () => {
    previewLotExport.mockReturnValue(
      Promise.resolve({
        eligible: 80,
        scopeLabel: 'CHUES',
        places: 100,
        retenues: 80,
        parTeleconseiller: 40,
      }),
    );
    await ouvrirLaCreation();

    expect(
      await screen.findByText(
        '80 fiches disponibles. 100 places pondérées sur 1 jour : les 80 seront réparties selon les capacités choisies.',
      ),
    ).toBeTruthy();
  });

  it('bloque la création tant qu’aucun téléconseiller n’est coché', async () => {
    const user = await ouvrirLaCreation();
    await user.click(await screen.findByRole('button', { name: 'Tout décocher' }));

    expect(await screen.findByText('Cochez au moins un téléconseiller.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Créer la campagne' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('envoie les nombres saisis pour les fiches et les jours', async () => {
    const user = await ouvrirLaCreation();
    const fiches = await screen.findByLabelText('Fiches par téléconseiller et par jour');
    await user.clear(fiches);
    await user.type(fiches, '30');
    await user.clear(screen.getByLabelText('Nombre de jours'));
    await user.type(screen.getByLabelText('Nombre de jours'), '3');

    await waitFor(() => {
      expect(previewLotExport).toHaveBeenLastCalledWith(
        expect.objectContaining({
          distribution: expect.objectContaining({ fichesParJour: 30, jours: 3 }),
        }),
      );
    });
  });

  it('ne demande aucun nom : le lot est nommé depuis la cible et la date', async () => {
    const user = await ouvrirLaCreation();

    expect(screen.queryByLabelText(/Nom de la campagne/)).toBeNull();
    await creerLeLot(user);

    await waitFor(() => {
      expect(createLotExport).toHaveBeenCalled();
    });
    const corps = createLotExport.mock.calls[0]?.[0] as { name: string };
    expect(corps.name.startsWith('Prospects CHUES, ')).toBe(true);
    expect(corps.name.length).toBeGreaterThanOrEqual(3);
    expect(corps.name.length).toBeLessThanOrEqual(120);
  });

  it('envoie les critères de la cible, jamais la seule cible', async () => {
    const user = await ouvrirLaCreation();
    await user.click(await screen.findByRole('radio', { name: /Représentants/ }));

    await waitFor(() => {
      expect(previewLotExport).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cible: 'REPRESENTANTS',
          representants: { relationStatus: 'INCONNU' },
          name: 'Représentants non qualifiés',
        }),
      );
    });

    await creerLeLot(user);
    await waitFor(() => {
      expect(createLotExport).toHaveBeenCalledWith(
        expect.objectContaining({
          cible: 'REPRESENTANTS',
          representants: { relationStatus: 'INCONNU' },
        }),
      );
    });
  });

  it('laisse décocher l’exclusion des représentants déjà qualifiés', async () => {
    const user = await ouvrirLaCreation();
    await user.click(await screen.findByRole('radio', { name: /Représentants/ }));
    await user.click(
      await screen.findByRole('checkbox', {
        name: 'Exclure les représentants déjà qualifiés (ambassadeur ou refus)',
      }),
    );

    await waitFor(() => {
      expect(previewLotExport).toHaveBeenLastCalledWith(
        expect.objectContaining({ representants: {}, name: 'Représentants' }),
      );
    });

    await creerLeLot(user);
    await waitFor(() => {
      expect(createLotExport).toHaveBeenCalledWith(expect.objectContaining({ representants: {} }));
    });
    const corps = createLotExport.mock.calls[0]?.[0] as { name: string };
    expect(corps.name.startsWith('Représentants, ')).toBe(true);
  });

  it('refuse de créer quand la cible est vide', async () => {
    previewLotExport.mockReturnValue(
      Promise.resolve({
        eligible: 0,
        scopeLabel: 'CHUES',
        places: 100,
        retenues: 0,
        parTeleconseiller: 0,
      }),
    );
    await ouvrirLaCreation();

    expect(await screen.findByText('Aucune fiche ne correspond.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Créer la campagne' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('montre le refus du serveur au lieu d’échouer en silence', async () => {
    createLotExport.mockImplementation(() =>
      Promise.reject(
        new ApiError(
          { code: 'LOT_EXPORT_CIBLE_VIDE', message: 'Aucune fiche ne correspond à cette cible.' },
          new Response(null, { status: 422 }),
        ),
      ),
    );
    const user = await ouvrirLaCreation();
    await creerLeLot(user);

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).toBe('Aucune fiche ne correspond à cette cible.');
  });

  it('ouvre le lot créé au lieu de lâcher un fichier', async () => {
    const user = await ouvrirLaCreation();
    await creerLeLot(user);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/chues/campagnes/lot-neuf');
    });
    expect(download).not.toHaveBeenCalled();
  });

  it('en Grand Public, saute le choix de cible : il n’y en a qu’une', async () => {
    const user = await ouvrirLaCreation('GRAND_PUBLIC');

    expect(await screen.findByLabelText('Type de prospect')).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();

    await waitFor(() => {
      expect(previewLotExport).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cible: 'PROSPECTS',
          prospects: expect.objectContaining({ projet: 'GRAND_PUBLIC' }),
        }),
      );
    });

    await creerLeLot(user);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/grand-public/campagnes/lot-neuf');
    });
  });
});
