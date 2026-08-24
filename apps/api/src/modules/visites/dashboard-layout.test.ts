import { describe, expect, it } from 'vitest';

import { DISPOSITION_USINE, parseLayout, resolveLayout, sanitize } from './dashboard-layout.js';

describe('assainissement de la disposition du tableau de bord', () => {
  it('retire une source inconnue', () => {
    const cleaned = sanitize([{ source: 'total-visites' }, { source: 'source-inventee' as never }]);
    expect(cleaned.map((widget) => widget.source)).toEqual(['total-visites']);
  });

  it('déduplique une source répétée', () => {
    const cleaned = sanitize([
      { source: 'par-entreprise', marque: 'barres-horizontales' },
      { source: 'par-entreprise', marque: 'camembert' },
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0]?.marque).toBe('barres-horizontales');
  });

  it('retombe sur la marque par défaut plutôt que de faire disparaître l’élément', () => {
    const cleaned = sanitize([{ source: 'par-entreprise', marque: 'jauge' }]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0]).toMatchObject({ source: 'par-entreprise', marque: 'barres-horizontales' });
  });

  it('rejette une version inconnue', () => {
    expect(parseLayout({ version: 2, preset: 'essentiel', widgets: [] })).toBeNull();
    expect(
      parseLayout({ version: 1, preset: 'essentiel', widgets: [{ source: 'par-jour' }] }),
    ).not.toBeNull();
  });

  it('replie quand la liste est vide une fois nettoyée', () => {
    expect(
      resolveLayout({ version: 1, preset: 'essentiel', widgets: [{ source: 'inconnue' }] }),
    ).toBeNull();
    expect(
      resolveLayout({ version: 2, preset: 'essentiel', widgets: [{ source: 'par-jour' }] }),
    ).toBeNull();
    expect(
      resolveLayout({ version: 1, preset: 'essentiel', widgets: [{ source: 'par-jour' }] }),
    ).not.toBeNull();
  });

  it('la disposition d’usine est non vide et déjà assainie', () => {
    expect(DISPOSITION_USINE.widgets.length).toBeGreaterThan(0);
    expect(sanitize(DISPOSITION_USINE.widgets)).toEqual(DISPOSITION_USINE.widgets);
  });
});
