import { describe, expect, it } from 'vitest';

import { dispositionUsine, parseLayout, resolveLayout, sanitize } from './dashboard-layout.js';
import { DASHBOARD_ECRANS } from './dto.js';

describe('assainissement de la disposition d’un écran de chiffres', () => {
  it('retire une source inconnue', () => {
    const cleaned = sanitize('visites', [
      { source: 'total-visites' },
      { source: 'source-inventee' as never },
    ]);
    expect(cleaned.map((widget) => widget.source)).toEqual(['total-visites']);
  });

  // Sans cloisonnement, la disposition du registre suivrait un compte jusqu'aux
  // chiffres CHUES et y afficherait des cartes que l'écran ne sait pas remplir.
  it('retire une source qui appartient à un AUTRE écran', () => {
    expect(sanitize('chues', [{ source: 'total-visites' }])).toEqual([]);
    expect(sanitize('visites', [{ source: 'adhesions' }])).toEqual([]);
  });

  // La qualification d'un représentant syndical n'existe pas hors CHUES.
  it('réserve les chiffres de qualification à CHUES', () => {
    expect(sanitize('chues', [{ source: 'taux-de-qualification' }])).toHaveLength(1);
    expect(sanitize('grand-public', [{ source: 'taux-de-qualification' }])).toEqual([]);
  });

  it('déduplique une source répétée', () => {
    const cleaned = sanitize('visites', [
      { source: 'par-entreprise', marque: 'barres-horizontales' },
      { source: 'par-entreprise', marque: 'camembert' },
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0]?.marque).toBe('barres-horizontales');
  });

  it('retombe sur la marque par défaut plutôt que de faire disparaître l’élément', () => {
    const cleaned = sanitize('visites', [{ source: 'par-entreprise', marque: 'jauge' }]);
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
      resolveLayout('visites', { version: 1, preset: 'essentiel', widgets: [{ source: 'x' }] }),
    ).toBeNull();
    expect(
      resolveLayout('visites', {
        version: 2,
        preset: 'essentiel',
        widgets: [{ source: 'par-jour' }],
      }),
    ).toBeNull();
    expect(
      resolveLayout('visites', {
        version: 1,
        preset: 'essentiel',
        widgets: [{ source: 'par-jour' }],
      }),
    ).not.toBeNull();
  });

  it.each(DASHBOARD_ECRANS)('la disposition d’usine de %s tient debout', (ecran) => {
    const usine = dispositionUsine(ecran);
    expect(usine.widgets.length).toBeGreaterThan(0);
    expect(sanitize(ecran, usine.widgets)).toEqual(usine.widgets);
  });

  // Un écran de pilotage se lit d'un coup d'œil : le repli ne doit pas ouvrir
  // sur un mur de cartes que personne ne trie ensuite.
  it.each(DASHBOARD_ECRANS)('la disposition d’usine de %s reste courte', (ecran) => {
    expect(dispositionUsine(ecran, true).widgets.length).toBeLessThanOrEqual(11);
  });

  it('n’ouvre les montants qu’à qui les regarde', () => {
    const supervision = dispositionUsine('chues').widgets.map((widget) => widget.source);
    const direction = dispositionUsine('chues', true).widgets.map((widget) => widget.source);

    expect(supervision).not.toContain('encaisse');
    expect(direction).toContain('encaisse');
    expect(direction).toContain('de-l-appel-a-l-encaissement');
  });

  it('place le suivi de la dernière campagne sur le tableau de bord de direction', () => {
    const direction = dispositionUsine('chues', true).widgets.map((widget) => widget.source);

    expect(direction).toContain('couverture-derniere-campagne');
    expect(direction).toContain('hors-attribution-derniere-campagne');
  });
});
