import { describe, expect, it } from 'vitest';

import { foldForSearch, matchesSearch } from '@/lib/search';

/**
 * « Thies » doit trouver « Thiès ».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Le défaut, tel qu'il se produit.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un administrateur ouvre la liste des départements, tape « thies », et lit
 * « Aucun résultat ». Il en déduit que Thiès n'est pas au référentiel, va le
 * créer, et fabrique un doublon. Le rapprochement littéral ne rate pas une
 * frappe : il rate une donnée qui existe.
 */

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
    // Les libellés emploient l'apostrophe courbe, les claviers la droite.
    expect(foldForSearch('Campagne d’appels')).toBe(foldForSearch("Campagne d'appels"));
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
    // Personne ne connaît de mémoire l'ordre exact de soixante-douze
    // représentants : « diop awa » doit trouver « Awa Diop ».
    expect(matchesSearch('Awa Diop', 'diop awa')).toBe(true);
    expect(matchesSearch('Awa Diop', 'awa diop')).toBe(true);
  });

  it('exige que TOUS les mots soient présents', () => {
    expect(matchesSearch('Awa Diop', 'awa fall')).toBe(false);
  });

  it('rapproche tout sur une recherche vide', () => {
    // La liste ouverte doit montrer la valeur courante ET ses voisines.
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
