import { describe, expect, it } from 'vitest';

import {
  EMPTY_VISITE_FILTERS,
  VISITE_COLONNES,
  countActiveVisiteFilters,
  dakarNow,
  parseVisiteFilters,
  serializeVisiteFilters,
  visiteDateRange,
  visitesQuery,
  visitesQueryKey,
  orderVisites,
  visiteCorrection,
  type CreateVisiteInput,
  type Visite,
  type VisiteFilters,
} from '@/lib/data/visites';

const filters = (over: Partial<VisiteFilters> = {}): VisiteFilters => ({
  ...EMPTY_VISITE_FILTERS,
  ...over,
});

describe('filtres du registre dans l’URL', () => {
  it('relit chaque filtre écrit dans l’adresse', () => {
    const params = new URLSearchParams(
      'search=Ndiaye&entrepriseId=e-1&directionId=d-1&destinataireId=x-1&objetId=o-1' +
        '&dateFrom=2026-08-01&dateTo=2026-08-19&periode=tout&page=3',
    );

    expect(parseVisiteFilters(params)).toEqual({
      search: 'Ndiaye',
      entrepriseId: 'e-1',
      directionId: 'd-1',
      destinataireId: 'x-1',
      objetId: 'o-1',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-19',
      toutePeriode: true,
      page: 3,
      pageSize: EMPTY_VISITE_FILTERS.pageSize,
      sortBy: 'visitedAt',
      sortDir: 'desc',
    });
  });

  it('n’écrit dans l’adresse que ce qui a été choisi', () => {
    expect(serializeVisiteFilters(EMPTY_VISITE_FILTERS).toString()).toBe('');
    expect(serializeVisiteFilters(filters({ objetId: 'o-1', page: 2 })).toString()).toBe(
      'objetId=o-1&page=2',
    );
    expect(serializeVisiteFilters(filters({ toutePeriode: true })).toString()).toBe('periode=tout');
    expect(
      serializeVisiteFilters(filters({ sortBy: 'visitorName', sortDir: 'asc' })).toString(),
    ).toBe('sortBy=visitorName&sortDir=asc');
  });

  it('ignore une date qui n’est pas une date', () => {
    expect(parseVisiteFilters(new URLSearchParams('dateFrom=hier')).dateFrom).toBeNull();
  });

  it('distingue deux jeux de filtres dans la clé de cache', () => {
    expect(visitesQueryKey(filters({ objetId: 'o-1' }))).not.toEqual(
      visitesQueryKey(filters({ objetId: 'o-2' })),
    );
  });

  it('compte les filtres actifs, la période comprise', () => {
    expect(countActiveVisiteFilters(EMPTY_VISITE_FILTERS)).toBe(0);
    expect(countActiveVisiteFilters(filters({ search: '  ' }))).toBe(0);
    expect(countActiveVisiteFilters(filters({ search: 'Ba', entrepriseId: 'e-1' }))).toBe(2);
    expect(countActiveVisiteFilters(filters({ dateFrom: '2026-08-01' }))).toBe(1);
    expect(
      countActiveVisiteFilters(filters({ dateFrom: '2026-08-01', dateTo: '2026-08-19' })),
    ).toBe(1);
    expect(countActiveVisiteFilters(filters({ toutePeriode: true }))).toBe(1);
  });
});

describe('période servie par défaut', () => {
  it('montre la journée en cours tant que rien n’est demandé', () => {
    expect(visiteDateRange(EMPTY_VISITE_FILTERS, '2026-08-19')).toEqual({
      dateFrom: '2026-08-19',
      dateTo: '2026-08-19',
    });
  });

  it('lève les deux bornes quand elle ouvre tout le registre', () => {
    expect(visiteDateRange(filters({ toutePeriode: true }), '2026-08-19')).toEqual({
      dateFrom: null,
      dateTo: null,
    });
  });

  it('laisse les dates choisies l’emporter sur la journée en cours', () => {
    expect(visiteDateRange(filters({ dateFrom: '2026-07-01' }), '2026-08-19')).toEqual({
      dateFrom: '2026-07-01',
      dateTo: null,
    });
  });
});

describe('date et heure de Dakar', () => {
  it('pré-remplit la saisie à la minute en cours', () => {
    expect(dakarNow(new Date('2026-08-19T07:05:00.000Z'))).toEqual({
      date: '2026-08-19',
      time: '07:05',
    });
  });
});

describe('vocabulaire du classeur', () => {
  it('garde les intitulés de colonnes de la Directrice, mot pour mot', () => {
    expect(Object.values(VISITE_COLONNES)).toEqual([
      'DATE VISITE',
      'HEURE VISITE',
      'PRENOM ET NOMS',
      'TELEPHONES',
      'ENTREPRISE',
      'DIRECTION',
      'DESTINATAIRES',
      'OBJET VISITE',
      'COMMENTAIRES / NOTES',
    ]);
  });
});

describe('ordre du registre', () => {
  const at = (id: string, date: string, time: string | null) =>
    ({ id, date, time }) as unknown as Parameters<typeof orderVisites>[0][number];

  it('remonte la visite la plus récente en haut', () => {
    const ordered = orderVisites([
      at('a', '2026-08-19', '09:00'),
      at('b', '2026-08-19', '14:30'),
      at('c', '2026-08-18', '17:45'),
      at('d', '2026-08-19', null),
    ]);

    expect(ordered.map((visite) => visite.id)).toEqual(['b', 'a', 'd', 'c']);
  });
});

describe('requête servie à l’API', () => {
  it('borne la journée en cours sur « from » et « to »', () => {
    expect(visitesQuery(EMPTY_VISITE_FILTERS, '2026-08-19')).toEqual({
      from: '2026-08-19',
      to: '2026-08-19',
      page: 1,
      pageSize: 100,
      sortBy: 'visitedAt',
      sortOrder: 'desc',
    });
  });

  it('renomme « sortDir » en « sortOrder », à la frontière de l’API', () => {
    const query = visitesQuery(filters({ sortBy: 'visitorName', sortDir: 'asc' }), '2026-08-19');
    expect(query.sortBy).toBe('visitorName');
    expect(query.sortOrder).toBe('asc');
  });

  it('retire les deux bornes quand tout le registre est demandé', () => {
    const query = visitesQuery(filters({ toutePeriode: true }), '2026-08-19');

    expect(query.from).toBeUndefined();
    expect(query.to).toBeUndefined();
  });

  // `VisiteQueryDto.search` impose deux caractères : la première frappe ferait 400.
  it('retient la recherche jusqu’à la deuxième frappe', () => {
    expect(visitesQuery(filters({ search: 'N' }), '2026-08-19').search).toBeUndefined();
    expect(visitesQuery(filters({ search: 'Nd' }), '2026-08-19').search).toBe('Nd');
  });

  it('passe chaque liste par son identifiant', () => {
    const query = visitesQuery(
      filters({ entrepriseId: 'e-1', directionId: 'd-1', destinataireId: 'x-1', objetId: 'o-1' }),
      '2026-08-19',
    );

    expect(query.entrepriseId).toBe('e-1');
    expect(query.directionId).toBe('d-1');
    expect(query.destinataireId).toBe('x-1');
    expect(query.objetId).toBe('o-1');
  });
});

describe('ce qu’une correction renvoie à l’API', () => {
  const ref = (id: string, label: string) => ({ id, code: label, label });

  const enregistree: Visite = {
    id: 'v-1',
    reference: 'V-2026-000412',
    date: '2026-08-19',
    time: '09:35',
    visitorName: 'Awa Ndiaye',
    phone: '77 722 04 00',
    phoneE164: '+221777220400',
    entreprise: ref('e-cpi', 'CPI'),
    objet: ref('o-achat', 'ACHAT TERRAIN'),
    direction: ref('d-com', 'COMMERCIALE'),
    destinataire: ref('x-ndoye', 'NDOYE'),
    comment: 'Rappeler lundi',
    createdById: 'u-1',
    createdAt: '2026-08-19T09:35:00.000Z',
  };

  const resaisie = (over: Partial<CreateVisiteInput> = {}): CreateVisiteInput => ({
    date: enregistree.date,
    time: '09:35',
    visitorName: 'Awa Ndiaye',
    phone: '77 722 04 00',
    entrepriseId: 'e-cpi',
    objetId: 'o-achat',
    directionId: 'd-com',
    destinataireId: 'x-ndoye',
    comment: 'Rappeler lundi',
    ...over,
  });

  /** Ce que le formulaire envoie d'un champ vidé : la clé manque. */
  const obligatoires: CreateVisiteInput = {
    date: enregistree.date,
    visitorName: 'Awa Ndiaye',
    entrepriseId: 'e-cpi',
    objetId: 'o-achat',
  };

  // Une entrée retirée du référentiel depuis la saisie ferait rejeter toute la
  // correction si on la renvoyait telle quelle.
  it('ne renvoie que ce qu’elle a touché', () => {
    expect(visiteCorrection(enregistree, resaisie({ visitorName: 'Awa Ndiaye Sow' }))).toEqual({
      visitorName: 'Awa Ndiaye Sow',
    });
  });

  it('ne renvoie rien quand elle ressort sans rien changer', () => {
    expect(visiteCorrection(enregistree, resaisie())).toEqual({});
  });

  it('efface un numéro et un commentaire faux au lieu de les laisser en place', () => {
    const patch = visiteCorrection(enregistree, {
      ...obligatoires,
      time: '09:35',
      directionId: 'd-com',
      destinataireId: 'x-ndoye',
    });

    expect(patch.phone).toBe('');
    expect(patch.comment).toBe('');
  });

  it('n’estampille jamais d’heure la ligne dont l’heure n’a pas été relevée', () => {
    const sansHeure: Visite = { ...enregistree, time: null };

    expect(visiteCorrection(sansHeure, obligatoires)).not.toHaveProperty('time');
  });

  it('renvoie l’heure enfin relevée sur une ligne qui n’en portait pas', () => {
    const sansHeure: Visite = { ...enregistree, time: null };

    expect(visiteCorrection(sansHeure, resaisie({ time: '09:35' })).time).toBe('09:35');
  });

  it('envoie explicitement les valeurs facultatives effacées', () => {
    expect(visiteCorrection(enregistree, obligatoires)).toMatchObject({
      time: null,
      directionId: null,
      destinataireId: null,
    });
  });
});
