import type { ApiClient } from '@crm/api-client';
import { describe, expect, it, vi } from 'vitest';

import {
  EMPTY_GRAND_PUBLIC_FILTERS,
  countGrandPublicFilters,
  createGrandPublicProspect,
  fetchCanauxProvenance,
  fetchGrandPublicProspects,
  formatDureeMois,
  grandPublicFiltersKey,
  parseGrandPublicFilters,
  serializeGrandPublicFilters,
  toGrandPublicQuery,
  type GrandPublicFilters,
} from '@/lib/data/grand-public';

const filters = (over: Partial<GrandPublicFilters> = {}): GrandPublicFilters => ({
  ...EMPTY_GRAND_PUBLIC_FILTERS,
  ...over,
});

function pageClient(): { GET: ReturnType<typeof vi.fn>; client: ApiClient } {
  const GET = vi.fn().mockResolvedValue({
    data: { items: [], meta: { total: 0, page: 1, pageSize: 25, pageCount: 0 } },
    response: new Response(null, { status: 200 }),
  });
  return { GET, client: { GET } as unknown as ApiClient };
}

describe('le cloisonnement des deux projets', () => {
  it('pose projet=GRAND_PUBLIC sur une requête sans aucun filtre', () => {
    expect(toGrandPublicQuery(filters()).projet).toBe('GRAND_PUBLIC');
  });

  it('le pose encore quand tous les filtres sont renseignés', () => {
    const query = toGrandPublicQuery(
      filters({
        search: 'Ndiaye',
        type: 'DIASPORA',
        canalProvenanceId: 'canal-1',
        statut: 'CONTACTE',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-19',
      }),
    );
    expect(query.projet).toBe('GRAND_PUBLIC');
  });

  it('l’envoie réellement à l’API sur chaque appel de liste', async () => {
    const { GET, client } = pageClient();

    await fetchGrandPublicProspects(filters(), client);

    const call = GET.mock.calls[0] as [string, { params: { query: { projet?: string } } }];
    expect(call[0]).toBe('/api/v1/prospects');
    expect(call[1].params.query.projet).toBe('GRAND_PUBLIC');
  });
});

describe('la requête de liste', () => {
  it('porte le type, le canal et le statut choisis', () => {
    const query = toGrandPublicQuery(
      filters({ type: 'INFORMEL', canalProvenanceId: 'canal-7', statut: 'PERDU' }),
    );
    expect(query.type).toBe('INFORMEL');
    expect(query.canalProvenanceId).toBe('canal-7');
    expect(query.statut).toBe('PERDU');
  });

  it('omet ce qui n’est pas filtré plutôt que d’envoyer une clé vide', () => {
    const query = toGrandPublicQuery(filters());
    expect('type' in query).toBe(false);
    expect('canalProvenanceId' in query).toBe(false);
    expect('statut' in query).toBe(false);
    expect('search' in query).toBe(false);
  });

  it('ferme la journée haute à 23:59:59.999, sans quoi le dernier jour tombe', () => {
    const query = toGrandPublicQuery(filters({ dateFrom: '2026-08-01', dateTo: '2026-08-19' }));
    expect(query.dateFrom).toBe('2026-08-01T00:00:00.000Z');
    expect(query.dateTo).toBe('2026-08-19T23:59:59.999Z');
  });

  it('trie sur la saisie terrain, du plus récent au plus ancien', () => {
    const query = toGrandPublicQuery(filters({ page: 3, pageSize: 50 }));
    expect(query.sortBy).toBe('clientCreatedAt');
    expect(query.sortOrder).toBe('desc');
    expect(query.page).toBe(3);
    expect(query.pageSize).toBe(50);
  });
});

describe('les filtres dans l’adresse', () => {
  it('relit chaque filtre écrit dans l’URL', () => {
    const read = parseGrandPublicFilters(
      new URLSearchParams(
        'search=Fall&type=DIASPORA&canalProvenanceId=c-1&statut=CONVERTI' +
          '&dateFrom=2026-01-02&dateTo=2026-01-31&page=4&pageSize=50',
      ),
    );
    expect(read).toEqual({
      search: 'Fall',
      type: 'DIASPORA',
      canalProvenanceId: 'c-1',
      statut: 'CONVERTI',
      dateFrom: '2026-01-02',
      dateTo: '2026-01-31',
      page: 4,
      pageSize: 50,
    });
  });

  it('ignore un type ou un statut que l’API ne connaît pas', () => {
    const read = parseGrandPublicFilters(new URLSearchParams('type=RETRAITE&statut=EN_COURS'));
    expect(read.type).toBeNull();
    expect(read.statut).toBeNull();
  });

  it('fait un aller-retour sans rien perdre', () => {
    const source = filters({ search: 'Sow', type: 'FONCTIONNAIRE', dateTo: '2026-03-04', page: 2 });
    expect(parseGrandPublicFilters(serializeGrandPublicFilters(source))).toEqual(source);
  });

  it('laisse l’adresse nue quand rien n’est filtré', () => {
    expect(grandPublicFiltersKey(filters())).toBe('');
  });

  it('compte la période comme un seul filtre', () => {
    expect(countGrandPublicFilters(filters({ dateFrom: '2026-01-01', dateTo: '2026-02-01' }))).toBe(
      1,
    );
    expect(countGrandPublicFilters(filters({ search: '  ' }))).toBe(0);
    expect(countGrandPublicFilters(filters({ type: 'INFORMEL', statut: 'NOUVEAU' }))).toBe(2);
  });
});

describe('la création d’une fiche', () => {
  function postClient(): {
    POST: ReturnType<typeof vi.fn>;
    client: ApiClient;
    sentBody: () => Record<string, unknown>;
  } {
    const POST = vi.fn().mockResolvedValue({
      data: { id: 'p-1' },
      response: new Response(null, { status: 201 }),
    });
    const sentBody = (): Record<string, unknown> => {
      const call = POST.mock.calls[0] as [string, { body: Record<string, unknown> }] | undefined;
      if (call === undefined) throw new Error('Aucun POST n’a été émis.');
      return call[1].body;
    };
    return { POST, client: { POST } as unknown as ApiClient, sentBody };
  }

  it('n’exige que le nom, le prénom et le téléphone', async () => {
    const { POST, client } = postClient();

    await createGrandPublicProspect(
      { nom: 'Fall', prenom: 'Moussa', phone: '+221771234567' },
      client,
    );

    expect(POST).toHaveBeenCalledWith('/api/v1/prospects', {
      body: { nom: 'Fall', prenom: 'Moussa', phone: '+221771234567', projet: 'GRAND_PUBLIC' },
    });
  });

  it('marque la fiche GRAND_PUBLIC : sans elle le serveur la rangerait en CHUES', async () => {
    const { client, sentBody } = postClient();

    await createGrandPublicProspect({ nom: 'Ba', prenom: 'Awa', phone: '+221770000000' }, client);

    expect(sentBody().projet).toBe('GRAND_PUBLIC');
  });

  it('transmet les champs facultatifs qui ont été renseignés', async () => {
    const { client, sentBody } = postClient();

    await createGrandPublicProspect(
      {
        nom: 'Diop',
        prenom: 'Fatou',
        phone: '+221771112233',
        profession: 'Commerçante',
        type: 'INFORMEL',
        banqueId: 'bnq-1',
        syndicatId: 'snd-1',
        dureeSystemeMois: 36,
        canalProvenanceId: 'canal-tiktok',
      },
      client,
    );

    expect(sentBody()).toEqual({
      nom: 'Diop',
      prenom: 'Fatou',
      phone: '+221771112233',
      projet: 'GRAND_PUBLIC',
      profession: 'Commerçante',
      type: 'INFORMEL',
      banqueId: 'bnq-1',
      syndicatId: 'snd-1',
      dureeSystemeMois: 36,
      canalProvenanceId: 'canal-tiktok',
    });
  });
});

describe('le référentiel des canaux', () => {
  it('demande aussi les canaux retirés, sinon un filtre posé sur l’un d’eux perd son nom', async () => {
    const GET = vi.fn().mockResolvedValue({
      data: [],
      response: new Response(null, { status: 200 }),
    });

    await fetchCanauxProvenance({ GET } as unknown as ApiClient);

    expect(GET).toHaveBeenCalledWith('/api/v1/referentiels/canaux-provenance', {
      params: { query: { activeOnly: false } },
    });
  });
});

describe('la durée du système', () => {
  it('se lit en années quand elle tombe juste, en mois sinon', () => {
    expect(formatDureeMois(6)).toBe('6 mois');
    expect(formatDureeMois(12)).toBe('1 an (12 mois)');
    expect(formatDureeMois(36)).toBe('3 ans (36 mois)');
  });
});
