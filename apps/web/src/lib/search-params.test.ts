import { describe, expect, it } from 'vitest';

import {
  readEnum,
  readFrenchBoolean,
  readIsoDate,
  readOne,
  readPositiveInt,
  readString,
} from '@/lib/search-params';

/**
 * Les lecteurs partagés par les sept écrans filtrables.
 *
 * Ils décident de ce qui part vers l'API : une valeur mal filtrée ici produit
 * un 400 sur un écran que l'utilisateur n'a fait qu'ouvrir depuis un lien. Ce
 * fichier verrouille le comportement pour les sept d'un coup, ce que sept
 * copies du même code ne permettaient pas.
 */

describe('readOne', () => {
  it('lit indifféremment un objet Next et un URLSearchParams', () => {
    expect(readOne({ search: 'Diallo' }, 'search')).toBe('Diallo');
    expect(readOne(new URLSearchParams('search=Diallo'), 'search')).toBe('Diallo');
  });

  it('retient la PREMIÈRE valeur d’un paramètre répété', () => {
    // Aucun filtre du panel n'est multivalué : sérialiser un tableau
    // produirait `statut=A,B`, que l'API refuserait.
    expect(readOne({ statut: ['CONVERTI', 'PERDU'] }, 'statut')).toBe('CONVERTI');
    expect(readOne(new URLSearchParams('statut=CONVERTI&statut=PERDU'), 'statut')).toBe('CONVERTI');
  });

  it('rend null pour une clé absente ou un tableau vide', () => {
    expect(readOne({}, 'search')).toBeNull();
    expect(readOne({ search: [] }, 'search')).toBeNull();
  });
});

describe('readString', () => {
  it('retire les espaces et traite une chaîne blanche comme absente', () => {
    expect(readString({ search: '  Diallo  ' }, 'search')).toBe('Diallo');
    expect(readString({ search: '   ' }, 'search')).toBeNull();
    expect(readString({ search: '' }, 'search')).toBeNull();
  });
});

describe('readPositiveInt', () => {
  it('n’accepte qu’un entier strictement positif', () => {
    expect(readPositiveInt({ page: '4' }, 'page', 1)).toBe(4);
    expect(readPositiveInt({ page: '0' }, 'page', 1)).toBe(1);
    expect(readPositiveInt({ page: '-3' }, 'page', 1)).toBe(1);
    expect(readPositiveInt({ page: 'abc' }, 'page', 1)).toBe(1);
    expect(readPositiveInt({}, 'page', 1)).toBe(1);
  });
});

describe('readIsoDate', () => {
  it('n’accepte que `YYYY-MM-DD`, sans rien deviner', () => {
    expect(readIsoDate({ dateFrom: '2026-08-13' }, 'dateFrom')).toBe('2026-08-13');
    expect(readIsoDate({ dateFrom: '2026-8-1' }, 'dateFrom')).toBeNull();
    expect(readIsoDate({ dateFrom: '13/08/2026' }, 'dateFrom')).toBeNull();
    expect(readIsoDate({ dateFrom: '2026-08-13T00:00:00Z' }, 'dateFrom')).toBeNull();
  });

  it('refuse des chiffres non arabes, que `\\d` sans `u` laisserait passer ailleurs', () => {
    // Le drapeau `u` manquait dans une des sept copies. Le point n'est pas
    // cosmétique : une expression rationnelle de validation doit se comporter
    // à l'identique sur les sept écrans.
    expect(readIsoDate({ dateFrom: '٢٠٢٦-٠٨-١٣' }, 'dateFrom')).toBeNull();
  });
});

describe('readEnum', () => {
  const ALLOWED = ['ACTIVE', 'CLOSED'] as const;

  it('écarte une valeur hors liste plutôt que de la propager vers l’API', () => {
    expect(readEnum({ status: 'ACTIVE' }, 'status', ALLOWED)).toBe('ACTIVE');
    expect(readEnum({ status: 'TOUT_SUPPRIMER' }, 'status', ALLOWED)).toBeNull();
    expect(readEnum({ status: 'active' }, 'status', ALLOWED)).toBeNull();
  });
});

describe('readFrenchBoolean', () => {
  it('ne connaît que `oui` et `non`', () => {
    expect(readFrenchBoolean({ hasProspects: 'oui' }, 'hasProspects')).toBe(true);
    expect(readFrenchBoolean({ hasProspects: 'non' }, 'hasProspects')).toBe(false);
    // Surtout pas de coercition « chaîne non vide = vrai » : c'est exactement
    // le défaut que l'export des représentants a connu.
    expect(readFrenchBoolean({ hasProspects: 'true' }, 'hasProspects')).toBeNull();
    expect(readFrenchBoolean({ hasProspects: '' }, 'hasProspects')).toBeNull();
    expect(readFrenchBoolean({}, 'hasProspects')).toBeNull();
  });
});
