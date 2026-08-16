import { ImportStatus } from '@crm/database';
import { describe, expect, it } from 'vitest';

import type { ImportRowError } from './import-adapter.js';
import {
  boundErrors,
  chunkOf,
  exceedsCeiling,
  IMPORT_CLOCK_SKEW_TOLERANCE_MS,
  IMPORT_LEASE_MS,
  isClaimable,
  isInFlight,
  MAX_REPORTED_ERRORS,
  resumeSkip,
} from './imports.job.js';

/**
 * Les règles d'âge et de découpage, exercées SANS base, SANS classeur et SANS
 * horloge réelle.
 *
 * Ce sont elles qui décident si un travail est repris, abandonné ou refusé.
 * Écrites en fonctions pures, elles s'éprouvent sur les cas qui font mal —
 * l'horloge qui recule, la suite dont la taille est un multiple exact de la
 * tranche — que le chemin nominal ne rencontre jamais.
 */

const NOW = new Date('2026-08-16T10:00:00.000Z');
const at = (offsetMs: number): Date => new Date(NOW.getTime() + offsetMs);

const error = (rowNumber: number): ImportRowError => ({
  rowNumber,
  code: 'PHONE_INVALID',
  message: 'Numéro de téléphone inexploitable.',
});

describe('découpage en tranches', () => {
  it('rend une seule tranche quand tout tient dedans', () => {
    expect(chunkOf([1, 2, 3], 500)).toEqual([[1, 2, 3]]);
  });

  it('ne rend AUCUNE tranche sur une suite vide', () => {
    // Une tranche vide ferait ouvrir une transaction pour n'écrire rien.
    expect(chunkOf([], 500)).toEqual([]);
  });

  it('ne rend pas de tranche vide finale quand la taille est un multiple exact', () => {
    expect(chunkOf([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('rend une dernière tranche plus courte quand la division tombe mal', () => {
    expect(chunkOf([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('découpe cinquante mille lignes en cent tranches de cinq cents', () => {
    const rows = Array.from({ length: 50_000 }, (_, index) => index);
    const chunks = chunkOf(rows, 500);

    expect(chunks).toHaveLength(100);
    expect(chunks.every((chunk) => chunk.length === 500)).toBe(true);
    // Aucune ligne perdue, aucune ligne en double : c'est l'invariant du
    // découpage, et c'est lui qui garantit qu'un import écrit ce qu'il a lu.
    expect(chunks.flat()).toHaveLength(50_000);
    expect(new Set(chunks.flat()).size).toBe(50_000);
  });

  it('refuse une taille de tranche nulle ou négative plutôt que de boucler sans fin', () => {
    expect(() => chunkOf([1, 2], 0)).toThrow(RangeError);
    expect(() => chunkOf([1, 2], -1)).toThrow(RangeError);
  });
});

describe('états', () => {
  it('en vol : queued et running, et eux seuls', () => {
    expect(isInFlight(ImportStatus.queued)).toBe(true);
    expect(isInFlight(ImportStatus.running)).toBe(true);
    expect(isInFlight(ImportStatus.succeeded)).toBe(false);
    expect(isInFlight(ImportStatus.failed)).toBe(false);
    expect(isInFlight(ImportStatus.expired)).toBe(false);
  });
});

describe('reprise d’un travail mort', () => {
  const job = (
    status: ImportStatus,
    claimedAt: Date | null,
  ): { status: ImportStatus; claimedAt: Date | null; createdAt: Date } => ({
    status,
    claimedAt,
    createdAt: NOW,
  });

  it('un queued jamais revendiqué est prenable', () => {
    expect(isClaimable(job(ImportStatus.queued, null), NOW)).toBe(true);
  });

  it('un travail dont le bail court n’est PAS prenable', () => {
    expect(isClaimable(job(ImportStatus.running, at(-IMPORT_LEASE_MS + 1_000)), NOW)).toBe(false);
  });

  it('un travail dont le bail a expiré est prenable', () => {
    expect(isClaimable(job(ImportStatus.running, at(-IMPORT_LEASE_MS - 1_000)), NOW)).toBe(true);
  });

  /**
   * LA FENÊTRE QUI TUE UNE FONCTIONNALITÉ ENTIÈRE.
   *
   * Un conteneur qui meurt entre la revendication et l'écriture de `running`
   * laisse une ligne `queued` portant déjà un jeton. « Un queued est forcément
   * libre » la ferait reprendre par deux travailleurs à la fois ; « un queued
   * n'est jamais mort » la figerait pour toujours. Seule la borne de bail
   * appliquée à `queued` AUSSI tranche correctement.
   */
  it('un queued DÉJÀ revendiqué suit la même borne de bail que running', () => {
    expect(isClaimable(job(ImportStatus.queued, at(-1_000)), NOW)).toBe(false);
    expect(isClaimable(job(ImportStatus.queued, at(-IMPORT_LEASE_MS - 1_000)), NOW)).toBe(true);
  });

  it('un travail terminé n’est jamais prenable, même très ancien', () => {
    for (const status of [ImportStatus.succeeded, ImportStatus.failed, ImportStatus.expired]) {
      expect(isClaimable(job(status, at(-10 * IMPORT_LEASE_MS)), NOW)).toBe(false);
    }
  });

  it('une horloge qui recule de peu ne tue PAS un travail bien vivant', () => {
    // Ajustement NTP ordinaire : quelques secondes dans le futur.
    expect(isClaimable(job(ImportStatus.running, at(30_000)), NOW)).toBe(false);
  });

  it('une horloge qui recule beaucoup rend le travail prenable plutôt qu’éternel', () => {
    // Sans cette branche, l'âge reste négatif, ne franchit jamais le bail, et la
    // ligne « en cours » ne vieillit PLUS JAMAIS.
    expect(
      isClaimable(job(ImportStatus.running, at(IMPORT_CLOCK_SKEW_TOLERANCE_MS + 60_000)), NOW),
    ).toBe(true);
  });
});

describe('saut de reprise', () => {
  it('un travail neuf ne saute rien', () => {
    expect(resumeSkip(0)).toBe(0);
  });

  it('un travail repris saute exactement ce qui a été compté', () => {
    expect(resumeSkip(1_500)).toBe(1_500);
  });

  it('une valeur absurde ne fait pas sauter des lignes jamais écrites', () => {
    expect(resumeSkip(-4)).toBe(0);
    expect(resumeSkip(Number.NaN)).toBe(0);
    expect(resumeSkip(2.7)).toBe(2);
  });
});

describe('plafond de lignes', () => {
  it('un nombre inconnu ne refuse rien', () => {
    // L'en-tête de feuille est facultatif dans le format : « inconnu » est le
    // cas ordinaire, et il ne doit pas faire refuser un classeur valide.
    expect(exceedsCeiling(null, 50_000)).toBe(false);
  });

  it('refuse à la première ligne AU-DELÀ du plafond, jamais avant', () => {
    expect(exceedsCeiling(50_000, 50_000)).toBe(false);
    expect(exceedsCeiling(50_001, 50_000)).toBe(true);
  });

  it('une valeur illisible ne refuse pas', () => {
    expect(exceedsCeiling(Number.NaN, 50_000)).toBe(false);
  });
});

describe('liste d’erreurs bornée', () => {
  it('accumule tant que la borne n’est pas atteinte', () => {
    expect(boundErrors([error(3)], [error(4), error(5)])).toHaveLength(3);
  });

  it('ne dépasse JAMAIS la borne, même sur un lot énorme', () => {
    const lot = Array.from({ length: 5_000 }, (_, index) => error(index));
    expect(boundErrors([], lot)).toHaveLength(MAX_REPORTED_ERRORS);
  });

  it('n’ajoute plus rien une fois pleine, et ne recopie pas le lot pour rien', () => {
    const pleine = Array.from({ length: MAX_REPORTED_ERRORS }, (_, index) => error(index));
    const apres = boundErrors(pleine, [error(9_999)]);

    expect(apres).toHaveLength(MAX_REPORTED_ERRORS);
    expect(apres.at(-1)?.rowNumber).toBe(MAX_REPORTED_ERRORS - 1);
  });

  it('garde les PREMIÈRES erreurs, celles du haut du fichier', () => {
    // C'est le haut du fichier que la personne reconnaît : une liste qui
    // garderait les dernières la ferait chercher au mauvais endroit.
    const bornee = boundErrors([error(1), error(2)], [error(3)], 2);
    expect(bornee.map((entry) => entry.rowNumber)).toEqual([1, 2]);
  });
});
