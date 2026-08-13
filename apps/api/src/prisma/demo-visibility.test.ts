import { describe, expect, it } from 'vitest';

import { demoScope, demoScopeSql, withDemoScope } from './demo-visibility.js';

/**
 * Le mode démonstration est une bascule d'AFFICHAGE.
 *
 * Le test qui compte est le premier : mode éteint, une ligne de démonstration
 * doit être invisible pour toute lecture — y compris celle qui alimente un
 * export Excel transmis au siège. C'est la seule faute que cette mécanique
 * puisse commettre.
 */
describe('demoScope', () => {
  it('mode ÉTEINT : les lignes de démonstration sont exclues', () => {
    expect(demoScope(false)).toEqual({ isDemo: false });
  });

  it('mode ALLUMÉ : plus aucun filtre, réel et démonstration se mêlent', () => {
    expect(demoScope(true)).toEqual({});
  });

  it('le défaut protégé est « pas de démonstration »', () => {
    // Le sens de la condition compte : on filtre quand le mode est éteint. Une
    // inversion rendrait la démonstration visible sur une plateforme réelle.
    expect(demoScope(false)).toHaveProperty('isDemo', false);
    expect(demoScope(true)).not.toHaveProperty('isDemo');
  });
});

describe('withDemoScope', () => {
  it('compose sans écraser le filtre existant', () => {
    expect(withDemoScope({ deletedAt: null, statut: 'NOUVEAU' }, false)).toEqual({
      deletedAt: null,
      statut: 'NOUVEAU',
      isDemo: false,
    });
  });

  it('accepte un filtre absent', () => {
    expect(withDemoScope(undefined, false)).toEqual({ isDemo: false });
  });

  it('mode allumé : le filtre d’origine ressort intact', () => {
    expect(withDemoScope({ deletedAt: null }, true)).toEqual({ deletedAt: null });
  });
});

describe('demoScopeSql', () => {
  it('mode éteint : condition sur la colonne', () => {
    expect(demoScopeSql(false)).toBe('"isDemo" = FALSE');
  });

  it('mode allumé : TRUE, jamais une chaîne vide', () => {
    // Une chaîne vide produirait « WHERE ... AND  » et un SQL bancal chez
    // l'appelant. `TRUE` se compose sans condition.
    expect(demoScopeSql(true)).toBe('TRUE');
    expect(demoScopeSql(true)).not.toBe('');
  });

  it('se compose dans un WHERE sans produire de SQL invalide', () => {
    for (const enabled of [true, false]) {
      const clause = `WHERE "deletedAt" IS NULL AND ${demoScopeSql(enabled)}`;
      expect(clause).not.toMatch(/AND\s*$/);
      expect(clause).not.toMatch(/AND\s+AND/);
    }
  });
});
