import { describe, expect, it } from 'vitest';

import {
  BANK_DEFAULT_PAGE_SIZE,
  EMPTY_BANK_FILTERS,
  activeQuickView,
  bankFiltersQueryKey,
  countActiveBankFilters,
  parseBankFilters,
  quickViewPatch,
  serializeBankFilters,
  toBankCaseQuery,
  toBankFilterQuery,
  type BankCaseFilters,
} from '@/lib/bank-filters';
import { buildBankExportUrl } from '@/lib/data/export';

const FULL: BankCaseFilters = {
  search: 'CPI-2026',
  stageId: 'stage-1',
  stageType: 'OPEN',
  banqueId: 'bank-1',
  agentId: 'agent-1',
  rejectionReasonId: 'reason-1',
  dateFrom: '2026-01-01',
  dateTo: '2026-03-31',
  amountMin: '100000',
  amountMax: '5000000',
  page: 3,
  pageSize: 50,
  sortBy: 'amountXof',
  sortDir: 'asc',
};

describe('aller-retour filtres ⇄ URL', () => {
  it('restitue un filtre complet à l’identique', () => {
    expect(parseBankFilters(serializeBankFilters(FULL))).toEqual(FULL);
  });

  it('n’écrit aucun paramètre pour le filtre par défaut', () => {
    expect(serializeBankFilters(EMPTY_BANK_FILTERS).toString()).toBe('');
    expect(parseBankFilters(serializeBankFilters(EMPTY_BANK_FILTERS))).toEqual(EMPTY_BANK_FILTERS);
  });

  it('la clé de cache est stable quel que soit l’ordre d’écriture', () => {
    const a = bankFiltersQueryKey({ ...EMPTY_BANK_FILTERS, banqueId: 'b', stageType: 'CASHED' });
    const b = bankFiltersQueryKey({ ...EMPTY_BANK_FILTERS, stageType: 'CASHED', banqueId: 'b' });
    expect(a).toBe(b);
  });

  it('lit la forme `Record` que Next passe aux pages serveur', () => {
    const parsed = parseBankFilters({ search: 'CPI', stageType: 'CASHED', page: '2' });
    expect(parsed.search).toBe('CPI');
    expect(parsed.stageType).toBe('CASHED');
    expect(parsed.page).toBe(2);
  });
});

describe('analyse défensive', () => {
  it('écarte un type d’étape inconnu', () => {
    expect(parseBankFilters(new URLSearchParams('stageType=ARCHIVE')).stageType).toBeNull();
  });

  it('écarte une borne de montant qui n’est pas un entier de chiffres', () => {
    expect(parseBankFilters(new URLSearchParams('amountMin=1200,50')).amountMin).toBeNull();
    expect(parseBankFilters(new URLSearchParams('amountMin=-500')).amountMin).toBeNull();
    expect(parseBankFilters(new URLSearchParams('amountMin=1200000')).amountMin).toBe('1200000');
  });

  it('accepte une borne de 18 chiffres : la borne exacte de la colonne', () => {
    const huge = '9'.repeat(18);
    expect(parseBankFilters(new URLSearchParams(`amountMax=${huge}`)).amountMax).toBe(huge);
    expect(serializeBankFilters({ ...EMPTY_BANK_FILTERS, amountMax: huge }).get('amountMax')).toBe(
      huge,
    );
  });

  it('retombe sur les valeurs par défaut pour une pagination absurde', () => {
    const parsed = parseBankFilters(new URLSearchParams('page=0&pageSize=99999'));
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(BANK_DEFAULT_PAGE_SIZE);
  });
});

describe('traduction vers les paramètres de l’API', () => {
  it('élargit les bornes de date à la journée entière', () => {
    const query = toBankFilterQuery(FULL);
    expect(query.dateFrom).toBe('2026-01-01T00:00:00.000Z');
    expect(query.dateTo).toBe('2026-03-31T23:59:59.999Z');
  });

  it('transmet les montants EN CHAÎNE', () => {
    const query = toBankFilterQuery(FULL);
    expect(query.amountMin).toBe('100000');
    expect(typeof query.amountMin).toBe('string');
  });

  it('n’écrit aucune clé pour un critère non renseigné', () => {
    expect(Object.keys(toBankFilterQuery(EMPTY_BANK_FILTERS))).toHaveLength(0);
  });

  it('la sélection de la liste est identique à celle des agrégats', () => {
    const { page, pageSize, sortBy, sortOrder, ...selection } = toBankCaseQuery(FULL);
    void page;
    void pageSize;
    void sortBy;
    void sortOrder;
    expect(selection).toEqual(toBankFilterQuery(FULL));
  });
});

describe('vues rapides', () => {
  it('« À traiter » vise l’étape initiale, lue dans la configuration', () => {
    expect(quickViewPatch('a-traiter', 'stage-init')).toEqual({
      stageId: 'stage-init',
      stageType: null,
    });
  });

  it('« En cours » couvre TOUTES les étapes ouvertes, y compris celles à venir', () => {
    expect(quickViewPatch('en-cours', 'stage-init')).toEqual({
      stageId: null,
      stageType: 'OPEN',
    });
  });

  it('les vues terminales visent le type, pas une étape précise', () => {
    expect(quickViewPatch('encaisses', null).stageType).toBe('CASHED');
    expect(quickViewPatch('rejetes', null).stageType).toBe('REJECTED');
    expect(quickViewPatch('tous', null)).toEqual({ stageId: null, stageType: null });
  });

  it('surligne la vue correspondant à l’état courant', () => {
    expect(activeQuickView(EMPTY_BANK_FILTERS, 'init')).toBe('tous');
    expect(activeQuickView({ ...EMPTY_BANK_FILTERS, stageId: 'init' }, 'init')).toBe('a-traiter');
    expect(activeQuickView({ ...EMPTY_BANK_FILTERS, stageType: 'CASHED' }, 'init')).toBe(
      'encaisses',
    );
    expect(activeQuickView({ ...EMPTY_BANK_FILTERS, stageId: 'autre' }, 'init')).toBe('tous');
  });
});

describe('countActiveBankFilters', () => {
  it('ne compte ni pagination ni tri', () => {
    expect(
      countActiveBankFilters({ ...EMPTY_BANK_FILTERS, page: 5, pageSize: 100, sortDir: 'asc' }),
    ).toBe(0);
  });

  it('compte chaque plage pour un seul filtre', () => {
    expect(countActiveBankFilters({ ...EMPTY_BANK_FILTERS, amountMin: '1', amountMax: '2' })).toBe(
      1,
    );
    expect(
      countActiveBankFilters({
        ...EMPTY_BANK_FILTERS,
        dateFrom: '2026-01-01',
        dateTo: '2026-02-01',
      }),
    ).toBe(1);
  });
});

describe('buildBankExportUrl', () => {
  it('garde la sélection et écarte pagination et tri', () => {
    const params = new URLSearchParams(buildBankExportUrl(FULL).split('?')[1]);
    expect(params.has('page')).toBe(false);
    expect(params.has('pageSize')).toBe(false);
    expect(params.has('sortBy')).toBe(false);
    expect(params.get('stageId')).toBe('stage-1');
    expect(params.get('amountMin')).toBe('100000');
    expect(params.get('search')).toBe('CPI-2026');
  });

  it('sans filtre, l’URL n’a pas de query string', () => {
    expect(buildBankExportUrl(EMPTY_BANK_FILTERS)).toBe('/api/export/bank-cases');
  });
});
