import { describe, expect, it } from 'vitest';

import {
  EMPTY_REP_CAMPAIGN_FILTERS,
  clearRepCampaignAdvancedFilters,
  countActiveRepCampaignFilters,
  parseRepCampaignFilters,
  serializeRepCampaignFilters,
} from '@/lib/rep-campaign-filters';

describe('parseRepCampaignFilters', () => {
  it('part sans aucun critère quand l’URL est vide', () => {
    expect(parseRepCampaignFilters(new URLSearchParams())).toEqual(EMPTY_REP_CAMPAIGN_FILTERS);
  });

  it('écarte un statut inconnu plutôt que de le propager vers l’API', () => {
    expect(parseRepCampaignFilters(new URLSearchParams('status=ARCHIVED')).status).toBeNull();
    expect(parseRepCampaignFilters(new URLSearchParams('status=CLOSED')).status).toBe('CLOSED');
  });

  it('n’accepte une date qu’au format AAAA-MM-JJ', () => {
    expect(parseRepCampaignFilters(new URLSearchParams('dateFrom=hier')).dateFrom).toBeNull();
    expect(parseRepCampaignFilters(new URLSearchParams('dateFrom=2026-08-13')).dateFrom).toBe(
      '2026-08-13',
    );
  });
});

describe('serializeRepCampaignFilters', () => {
  it('fait l’aller-retour sans perte', () => {
    const filters = {
      ...EMPTY_REP_CAMPAIGN_FILTERS,
      search: 'dormants',
      status: 'ACTIVE' as const,
      createdById: '019ff658-dddd-7489-ab22-1f2ada5ef38a',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      page: 3,
    };
    expect(parseRepCampaignFilters(serializeRepCampaignFilters(filters))).toEqual(filters);
  });

  it('omet la page 1 : l’URL du cas courant reste propre', () => {
    expect(serializeRepCampaignFilters(EMPTY_REP_CAMPAIGN_FILTERS).toString()).toBe('');
  });
});

describe('critères avancés', () => {
  it('efface exactement les trois critères repliés, et rien d’autre', () => {
    expect(clearRepCampaignAdvancedFilters()).toEqual({
      createdById: null,
      dateFrom: null,
      dateTo: null,
    });
  });

  it('compte une période posée comme UN critère, pas deux', () => {
    expect(
      countActiveRepCampaignFilters({
        ...EMPTY_REP_CAMPAIGN_FILTERS,
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      }),
    ).toBe(1);
  });
});
