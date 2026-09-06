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
    expect(sanitize('chues', [{ source: 'taux-d-acceptation' }])).toHaveLength(1);
    expect(sanitize('grand-public', [{ source: 'taux-d-acceptation' }])).toEqual([]);
  });

  // Trois clés de la version 1 ont changé de sens en version 2 : relues telles
  // quelles, elles afficheraient un autre chiffre sous le même nom.
  it('renomme les clés d’une disposition en version 1', () => {
    const parsed = parseLayout({
      version: 1,
      preset: 'essentiel',
      widgets: [
        { source: 'taux-de-contact', marque: 'tuile' },
        { source: 'taux-de-qualification' },
        { source: 'a-rappeler' },
        { source: 'adhesions' },
      ],
    });

    expect(parsed?.version).toBe(2);
    expect(parsed?.widgets.map((widget) => widget.source)).toEqual([
      'taux-de-joignabilite-representants',
      'taux-d-acceptation',
      'taux-de-rappel',
      'adhesions',
    ]);
  });

  it('lit une version 2 sans renommer', () => {
    const parsed = parseLayout({
      version: 2,
      preset: 'essentiel',
      widgets: [{ source: 'taux-de-contact' }],
    });

    expect(parsed?.widgets.map((widget) => widget.source)).toEqual(['taux-de-contact']);
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
    expect(parseLayout({ version: 3, preset: 'essentiel', widgets: [] })).toBeNull();
    expect(
      parseLayout({ version: 2, preset: 'essentiel', widgets: [{ source: 'par-jour' }] }),
    ).not.toBeNull();
  });

  it('replie quand la liste est vide une fois nettoyée', () => {
    expect(
      resolveLayout('visites', { version: 2, preset: 'essentiel', widgets: [{ source: 'x' }] }),
    ).toBeNull();
    expect(
      resolveLayout('visites', {
        version: 3,
        preset: 'essentiel',
        widgets: [{ source: 'par-jour' }],
      }),
    ).toBeNull();
    expect(
      resolveLayout('visites', {
        version: 2,
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
    expect(dispositionUsine(ecran, true).widgets.length).toBeLessThanOrEqual(12);
  });

  it('n’ouvre les montants qu’à qui les regarde', () => {
    const supervision = dispositionUsine('chues').widgets.map((widget) => widget.source);
    const direction = dispositionUsine('chues', true).widgets.map((widget) => widget.source);

    expect(supervision).not.toContain('encaisse');
    expect(direction).toContain('encaisse');
    expect(direction).toContain('de-l-appel-a-l-encaissement');
  });

  // EB-32 : le suivi de campagne et le rendement pilotent des appels, pas une
  // recette. La supervision les ouvre comme la direction.
  it('place le suivi de la dernière campagne sur les deux tableaux de bord', () => {
    for (const voitLesMontants of [false, true]) {
      const sources = dispositionUsine('chues', voitLesMontants).widgets.map(
        (widget) => widget.source,
      );

      expect(sources).toContain('couverture-derniere-campagne');
      expect(sources).toContain('hors-attribution-derniere-campagne');
      expect(sources).toContain('rendement-par-departement');
    }
  });

  // EB-13 : le compte des fiches ouvertes se lit SUR le tableau de bord. Posé
  // seulement dans le tiroir, il resterait à découvrir.
  it.each(['chues', 'grand-public'] as const)(
    'pose les fiches ouvertes par téléconseiller et par jour sur le tableau de bord de %s',
    (ecran) => {
      const widget = dispositionUsine(ecran).widgets.find(
        (item) => item.source === 'fiches-ouvertes',
      );

      expect(widget).toMatchObject({
        source: 'fiches-ouvertes',
        marque: 'carte-de-chaleur',
        taille: 'pleine',
      });
    },
  );

  it('met la répartition des statuts de qualification en graphique large dès l’usine', () => {
    const widget = dispositionUsine('chues').widgets.find(
      (item) => item.source === 'repartition-statuts-qualification',
    );

    expect(widget).toMatchObject({
      source: 'repartition-statuts-qualification',
      marque: 'barres-horizontales',
      taille: 'pleine',
      presentation: { valeurs: true },
    });
  });
});
