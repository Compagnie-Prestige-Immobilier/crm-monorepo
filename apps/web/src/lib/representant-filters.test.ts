import { describe, expect, it } from 'vitest';

import { toRepresentantQuery } from '@/lib/data/representants';
import {
  countActiveRepresentantFilters,
  EMPTY_REPRESENTANT_FILTERS,
  parseRepresentantFilters,
  REPRESENTANT_RELATION_LABELS,
  REPRESENTANT_RELATIONS,
  serializeRepresentantFilters,
} from '@/lib/representant-filters';

describe('filtre par état de la relation', () => {
  it('se lit dans l’URL', () => {
    const filters = parseRepresentantFilters(new URLSearchParams('relationStatus=AMBASSADEUR'));

    expect(filters.relationStatus).toBe('AMBASSADEUR');
  });

  it('ignore une valeur qui n’est pas un état du contrat', () => {
    const filters = parseRepresentantFilters(new URLSearchParams('relationStatus=AMI'));

    expect(filters.relationStatus).toBeNull();
  });

  it('revient dans l’URL, et disparaît quand il est vide', () => {
    const retenu = serializeRepresentantFilters({
      ...EMPTY_REPRESENTANT_FILTERS,
      relationStatus: 'REFUS',
    });
    expect(retenu.get('relationStatus')).toBe('REFUS');

    expect(serializeRepresentantFilters(EMPTY_REPRESENTANT_FILTERS).has('relationStatus')).toBe(
      false,
    );
  });

  it('compte comme un critère actif', () => {
    expect(
      countActiveRepresentantFilters({
        ...EMPTY_REPRESENTANT_FILTERS,
        relationStatus: 'CONTACTE',
      }),
    ).toBe(1);
    expect(countActiveRepresentantFilters(EMPTY_REPRESENTANT_FILTERS)).toBe(0);
  });

  it('part vers l’API, et seulement s’il est posé', () => {
    expect(
      toRepresentantQuery({ ...EMPTY_REPRESENTANT_FILTERS, relationStatus: 'AMBASSADEUR' })
        .relationStatus,
    ).toBe('AMBASSADEUR');
    expect(toRepresentantQuery(EMPTY_REPRESENTANT_FILTERS).relationStatus).toBeUndefined();
  });

  it('nomme les quatre états en clair', () => {
    for (const relation of REPRESENTANT_RELATIONS) {
      expect(REPRESENTANT_RELATION_LABELS[relation].trim()).not.toBe('');
    }
    expect(new Set(Object.values(REPRESENTANT_RELATION_LABELS)).size).toBe(4);
  });
});
