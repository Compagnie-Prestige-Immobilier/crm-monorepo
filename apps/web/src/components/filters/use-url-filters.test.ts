import { describe, expect, it } from 'vitest';

import { isTransientPatch } from '@/components/filters/use-url-filters';

describe('isTransientPatch', () => {
  it('une frappe de recherche REMPLACE : elle n’empile pas vingt entrées', () => {
    expect(isTransientPatch({ search: 'Diallo' })).toBe(true);
  });

  it('un critère choisi EMPILE : c’est ce que « Précédent » doit défaire', () => {
    expect(isTransientPatch({ banqueId: 'b-1' })).toBe(false);
    expect(isTransientPatch({ statut: 'CONVERTI' })).toBe(false);
    expect(isTransientPatch({ dateFrom: '2026-03-01' })).toBe(false);
    expect(isTransientPatch({ sortBy: 'createdAt' })).toBe(false);
  });

  it('la pagination EMPILE elle aussi', () => {
    expect(isTransientPatch({ page: 3 })).toBe(false);
  });

  it('un lot MIXTE empile, parce qu’il porte un vrai critère', () => {
    expect(isTransientPatch({ search: 'Diallo', banqueId: 'b-1' })).toBe(false);
  });

  it('un patch vide ne navigue vers rien de nouveau', () => {
    expect(isTransientPatch({})).toBe(true);
  });
});
