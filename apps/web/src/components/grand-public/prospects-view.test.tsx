import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GrandPublicProspectsView } from '@/components/grand-public/prospects-view';
import type * as GrandPublicModule from '@/lib/data/grand-public';
import { renderWithQuery } from '@/test/render-query';
import { historyMock, setUrl } from '@/test/router-mock';
import type { ProspectRow } from '@/lib/types';

const list = vi.hoisted(() => vi.fn());
const canaux = vi.hoisted(() => vi.fn());
const download = vi.hoisted(() => vi.fn<(input: unknown) => Promise<void>>());

vi.mock('@/lib/data/grand-public', async () => {
  const actual = await vi.importActual<typeof GrandPublicModule>('@/lib/data/grand-public');
  return { ...actual, fetchGrandPublicProspects: list, fetchCanauxProvenance: canaux };
});

vi.mock('@/components/exports/download-button', () => ({
  useFileDownload: () => ({ pending: false, download }),
}));

beforeEach(() => {
  list.mockReset();
  canaux.mockReset();
  download.mockReset();
  download.mockResolvedValue(undefined);
  canaux.mockResolvedValue([
    { id: 'c-tiktok', code: 'TIKTOK', label: 'TikTok', position: 1, isActive: true, updatedAt: '' },
  ]);
});

const row = (over: Partial<ProspectRow> = {}): ProspectRow =>
  ({
    id: 'p-1',
    nom: 'Fall',
    prenom: 'Moussa',
    phoneE164: '+221771234567',
    statut: 'NOUVEAU',
    projet: 'GRAND_PUBLIC',
    journeys: [{ id: 'j-1', projet: 'GRAND_PUBLIC', statut: 'NOUVEAU' }],
    type: null,
    profession: null,
    dureeSystemeMois: null,
    canalProvenanceId: null,
    canalProvenanceLabel: null,
    banqueId: null,
    banqueName: null,
    syndicatId: null,
    syndicatSigle: null,
    representantId: null,
    representantName: null,
    segment: null,
    ownedByCommercialName: 'Alice Diop',
    clientCreatedAt: '2026-08-14T09:00:00.000Z',
    ...over,
  }) as ProspectRow;

function page(items: ProspectRow[], total = items.length) {
  return { items, total, page: 1, pageSize: 25, pageCount: Math.max(1, Math.ceil(total / 25)) };
}

function mount(canCreate = true, canExport = canCreate) {
  return renderWithQuery(<GrandPublicProspectsView canCreate={canCreate} canExport={canExport} />);
}

describe('le segment absent', () => {
  it('écrit « Aucun » et jamais BDD4 pour une fiche sans banque ni syndicat', async () => {
    list.mockResolvedValue(page([row()]));
    mount();

    expect(await screen.findByText('Aucun')).toBeTruthy();
    expect(screen.queryByText('BDD4')).toBeNull();
  });

  it('affiche le segment quand le croisement a bien eu lieu', async () => {
    list.mockResolvedValue(page([row({ segment: 'BDD3', banqueId: 'b', syndicatId: 's' })]));
    mount();

    expect(await screen.findByText('BDD3')).toBeTruthy();
  });
});

describe('le statut affiché', () => {
  // Fiche entrée par CHUES, restée « Nouveau » en premier niveau, mais
  // convertie dans son parcours Grand Public : c'est ce parcours-là que la
  // liste filtre, et donc celui qu'elle doit montrer.
  it('est celui du parcours Grand Public, pas celui du point d’entrée', async () => {
    list.mockResolvedValue(
      page([
        row({
          statut: 'NOUVEAU',
          projet: 'CHUES',
          journeys: [
            { id: 'j-1', projet: 'CHUES', statut: 'NOUVEAU' },
            { id: 'j-2', projet: 'GRAND_PUBLIC', statut: 'CONVERTI' },
          ],
        } as Partial<ProspectRow>),
      ]),
    );
    mount();

    expect(await screen.findByText('Converti')).toBeTruthy();
    expect(screen.queryByText('Nouveau')).toBeNull();
  });
});

describe('les autres absences', () => {
  it('nomme chaque champ vide au lieu de poser un tiret', async () => {
    list.mockResolvedValue(page([row()]));
    mount();

    await screen.findByText('Aucun');
    expect(screen.getAllByText('Non renseigné').length).toBeGreaterThan(0);
    expect(screen.getByText('Non renseignée')).toBeTruthy();
    expect(screen.queryByText('–')).toBeNull();
  });

  it('rend la valeur dès qu’elle existe', async () => {
    list.mockResolvedValue(
      page([
        row({
          type: 'DIASPORA',
          profession: 'Chauffeur',
          canalProvenanceLabel: 'TikTok',
          banqueName: 'CBAO Sénégal',
        }),
      ]),
    );
    mount();

    expect(await screen.findByText('Chauffeur')).toBeTruthy();
    expect(screen.getByText('TikTok')).toBeTruthy();
    expect(screen.getByText('CBAO Sénégal')).toBeTruthy();
  });
});

describe('l’état vide', () => {
  it('dit que rien n’a été saisi quand aucun filtre n’est posé', async () => {
    list.mockResolvedValue(page([]));
    mount();

    expect(
      await screen.findByText('Aucun prospect Grand Public n’a encore été saisi.'),
    ).toBeTruthy();
    expect(screen.queryByText('Aucun prospect ne correspond à ces filtres.')).toBeNull();
  });

  it('dit que les filtres excluent tout quand un filtre est posé', async () => {
    setUrl('/grand-public?statut=PERDU');
    list.mockResolvedValue(page([]));
    mount();

    expect(await screen.findByText('Aucun prospect ne correspond à ces filtres.')).toBeTruthy();
    expect(screen.queryByText('Aucun prospect Grand Public n’a encore été saisi.')).toBeNull();
  });

  it('dit au téléconseiller que ce sont SES campagnes qui sont vides', async () => {
    list.mockResolvedValue(page([]));
    renderWithQuery(<GrandPublicProspectsView canCreate canExport campaignScoped />);

    expect(await screen.findByText('Vos campagnes n’en contiennent aucun.')).toBeTruthy();
    expect(screen.queryByText(/La première fiche se crée/u)).toBeNull();
  });
});

describe('la liste', () => {
  it('donne accès à la création, aux appels et aux rappels', async () => {
    list.mockResolvedValue(page([]));
    mount();

    expect(await screen.findByRole('button', { name: 'Nouveau prospect' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Appeler les prospects' }).getAttribute('href')).toBe(
      '/grand-public/console',
    );
    expect(screen.getByRole('link', { name: 'Voir les rappels' }).getAttribute('href')).toBe(
      '/grand-public/rappels',
    );
  });

  it('ouvre la fiche depuis le nom', async () => {
    list.mockResolvedValue(page([row()]));
    mount();

    const link = await screen.findByRole('link', { name: /Moussa Fall/u });
    expect(link.getAttribute('href')).toBe('/grand-public/p-1');
  });

  it('demande la liste avec les filtres lus dans l’adresse', async () => {
    setUrl('/grand-public?type=INFORMEL&statut=CONTACTE');
    list.mockResolvedValue(page([]));
    mount();

    await waitFor(() => {
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'INFORMEL', statut: 'CONTACTE' }),
      );
    });
  });

  it('écrit le filtre choisi dans l’adresse', async () => {
    const user = userEvent.setup();
    setUrl('/grand-public');
    list.mockResolvedValue(page([]));
    mount();
    await user.click(await screen.findByRole('button', { name: 'Filtres' }));

    await user.click(screen.getByRole('button', { name: 'Diaspora' }));

    await waitFor(() => {
      expect(historyMock.pushState).toHaveBeenCalledWith(null, '', '/grand-public?type=DIASPORA');
    });
  });

  it('cache la saisie à un rôle qui ne fait que lire', async () => {
    list.mockResolvedValue(page([]));
    mount(false);

    await screen.findByText('Aucun prospect Grand Public n’a encore été saisi.');
    expect(screen.queryByRole('link', { name: /Nouveau prospect/u })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Exporter' })).toBeNull();
  });

  it('laisse exporter un rôle qui ne saisit pas, comme la DIRECTION', async () => {
    list.mockResolvedValue(page([]));
    mount(false, true);

    expect(await screen.findByRole('button', { name: 'Exporter' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Nouveau prospect/u })).toBeNull();
  });

  it('exporte la vue filtrée, bornée au Grand Public', async () => {
    const user = userEvent.setup();
    setUrl('/grand-public?type=DIASPORA');
    list.mockResolvedValue(page([]));
    mount();

    await user.click(await screen.findByRole('button', { name: 'Exporter' }));

    await waitFor(() => {
      expect(download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/export/prospects?type=DIASPORA&projet=GRAND_PUBLIC',
        }),
      );
    });
  });
});

describe('l’échec du chargement', () => {
  it('ne présente pas une liste en échec comme une liste vide', async () => {
    list.mockRejectedValue(new Error('réseau'));
    mount();

    expect(await screen.findByText('Serveur injoignable')).toBeTruthy();
    expect(screen.queryByText('Aucun prospect Grand Public n’a encore été saisi.')).toBeNull();
  });
});
