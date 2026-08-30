import { describe, expect, it } from 'vitest';

import { foldForSearch, matchesSearch } from '@/lib/search';

describe('foldForSearch', () => {
  it('retire les accents sans toucher aux lettres', () => {
    expect(foldForSearch('Thiès')).toBe('thies');
    expect(foldForSearch('Kédougou')).toBe('kedougou');
    expect(foldForSearch('Sédhiou')).toBe('sedhiou');
    expect(foldForSearch('CONTACTÉ')).toBe('contacte');
  });

  it('défait les ligatures, que la normalisation Unicode laisse entières', () => {
    expect(foldForSearch('Cœur')).toBe('coeur');
    expect(foldForSearch('Ex æquo')).toBe('ex aequo');
  });

  it('unifie les apostrophes', () => {
    expect(foldForSearch('Lot d’export')).toBe(foldForSearch("Lot d'export"));
    expect(foldForSearch('Méthode d’enrôlement')).toBe("methode d'enrolement");
  });
});

describe('matchesSearch', () => {
  it('trouve une valeur accentuée depuis une frappe sans accent', () => {
    expect(matchesSearch('Thiès', 'thies')).toBe(true);
    expect(matchesSearch('Thiès', 'Thiès')).toBe(true);
    expect(matchesSearch('Kédougou', 'kedou')).toBe(true);
  });

  it('trouve dans n’importe quel ordre de mots', () => {
    expect(matchesSearch('Awa Diop', 'diop awa')).toBe(true);
    expect(matchesSearch('Awa Diop', 'awa diop')).toBe(true);
  });

  it('exige que TOUS les mots soient présents', () => {
    expect(matchesSearch('Awa Diop', 'awa fall')).toBe(false);
  });

  it('rapproche tout sur une recherche vide', () => {
    expect(matchesSearch('Thiès', '')).toBe(true);
    expect(matchesSearch('Thiès', '   ')).toBe(true);
  });

  it('cherche aussi dans la précision de la ligne', () => {
    expect(matchesSearch('CBAO CBAO Attijariwafa', 'attijari')).toBe(true);
  });

  it('ne trouve pas ce qui n’est pas là', () => {
    expect(matchesSearch('Thiès', 'dakar')).toBe(false);
  });
});
