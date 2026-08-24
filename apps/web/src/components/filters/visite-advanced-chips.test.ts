import { describe, expect, it } from 'vitest';

import { buildVisiteAdvancedChips } from '@/components/filters/visite-advanced-chips';
import {
  EMPTY_VISITE_FILTERS,
  type VisiteFilters,
  type VisiteReferentiels,
} from '@/lib/data/visites';

const item = (id: string, code: string, label: string) => ({
  id,
  code,
  label,
  isActive: true,
  isSystem: true,
  sortOrder: 100,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const REFERENTIELS: VisiteReferentiels = {
  entreprises: [item('e-cpi', 'CPI', 'CPI')],
  directions: [item('d-com', 'COMMERCIALE', 'COMMERCIALE')],
  destinataires: [item('x-ndoye', 'NDOYE', 'MME. NDOYE (RESP. COMM.)')],
  objets: [item('o-achat', 'ACHAT_TERRAIN', 'ACHAT TERRAIN')],
};

const filters = (over: Partial<VisiteFilters> = {}): VisiteFilters => ({
  ...EMPTY_VISITE_FILTERS,
  ...over,
});

describe('puces des filtres avancés du registre', () => {
  it('ne montre rien tant qu’aucun filtre avancé n’est posé', () => {
    expect(buildVisiteAdvancedChips(EMPTY_VISITE_FILTERS, REFERENTIELS)).toEqual([]);
  });

  it('nomme chaque filtre avancé posé par son intitulé de colonne', () => {
    const chips = buildVisiteAdvancedChips(
      filters({ entrepriseId: 'e-cpi', objetId: 'o-achat' }),
      REFERENTIELS,
    );

    expect(chips).toEqual([
      { key: 'entrepriseId', field: 'ENTREPRISE', value: 'CPI' },
      { key: 'objetId', field: 'OBJET VISITE', value: 'ACHAT TERRAIN' },
    ]);
  });

  it('signale une entrée retirée du référentiel plutôt que de la taire', () => {
    const chips = buildVisiteAdvancedChips(filters({ directionId: 'd-disparue' }), REFERENTIELS);

    expect(chips).toEqual([{ key: 'directionId', field: 'DIRECTION', value: 'Valeur inconnue' }]);
  });
});
