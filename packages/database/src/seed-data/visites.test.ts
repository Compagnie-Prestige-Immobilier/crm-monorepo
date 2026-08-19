import { describe, expect, it } from 'vitest';

import {
  VISITE_DESTINATAIRES,
  VISITE_DIRECTIONS,
  VISITE_ENTREPRISES,
  VISITE_OBJETS,
  type VisiteReferentielSeed,
} from './visites.js';

const LISTES: readonly [string, readonly VisiteReferentielSeed[], number][] = [
  ['entreprises', VISITE_ENTREPRISES, 3],
  ['directions', VISITE_DIRECTIONS, 17],
  ['destinataires', VISITE_DESTINATAIRES, 16],
  ['objets', VISITE_OBJETS, 16],
];

describe('listes de l’accueil, semées', () => {
  it('reprend le classeur au complet', () => {
    for (const [nom, liste, attendu] of LISTES) {
      expect(liste.length, nom).toBe(attendu);
    }
  });

  it('n’a ni code ni libellé en double : les deux portent un index unique', () => {
    for (const [nom, liste] of LISTES) {
      expect(new Set(liste.map((entree) => entree.code)).size, `codes ${nom}`).toBe(liste.length);
      expect(new Set(liste.map((entree) => entree.label)).size, `libellés ${nom}`).toBe(
        liste.length,
      );
    }
  });

  it('donne un code stable, en majuscules, sans espace', () => {
    for (const [nom, liste] of LISTES) {
      for (const entree of liste) {
        expect(entree.code, `${nom} · ${entree.label}`).toMatch(/^[A-Z0-9_]+$/);
      }
    }
  });

  it('range chaque liste sans ex æquo', () => {
    for (const [nom, liste] of LISTES) {
      expect(new Set(liste.map((entree) => entree.sortOrder)).size, nom).toBe(liste.length);
    }
  });

  it('nomme les trois entreprises du groupe', () => {
    expect(VISITE_ENTREPRISES.map((entree) => entree.label)).toEqual([
      'CPI',
      'SANTARGILE',
      'MAKE-UP ADDICTION',
    ]);
  });

  it('garde les niveaux du bâtiment parmi les directions, et non à part', () => {
    const labels = VISITE_DIRECTIONS.map((entree) => entree.label);
    expect(labels).toContain('COMMERCIALE');
    expect(labels).toContain('2EME. ETAGE VILLA');
  });
});
