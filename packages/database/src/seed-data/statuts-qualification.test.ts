import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  CONVERSIONS_STATUT_LOT_1,
  STATUTS_QUALIFICATION,
  type StatutQualificationSeed,
} from './statuts-qualification.js';

const MIGRATION = readFileSync(
  fileURLToPath(
    new URL(
      '../../prisma/migrations/20260905100000_liste_des_statuts_du_lot_1/migration.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);

/**
 * EB-05, tel que l'API l'appliquera a la creation. Ecrite ici pour verifier les
 * codes semes, pas pour etre importee : le depot a deja `sansAccents`
 * (`apps/api/src/modules/bank-cases/bank-cases.service.ts`).
 */
const codeDepuisLibelle = (label: string): string =>
  label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/gu, '_');

/**
 * Le code est fige a la creation : « Numero occupe » a ete renomme « Occupe »
 * par le Lot 1 et garde le sien, que l'historique designe.
 */
const CODES_FIGES_AVANT_RENOMMAGE = new Set(['NUMERO_OCCUPE']);

const joints = STATUTS_QUALIFICATION.filter((s) => s.effect !== 'UNREACHABLE');
const nonJoints = STATUTS_QUALIFICATION.filter((s) => s.effect === 'UNREACHABLE');
const parCode = new Map(STATUTS_QUALIFICATION.map((s) => [s.code, s]));

describe('statuts de qualification du Lot 1', () => {
  it('propose neuf statuts joints et six non joints', () => {
    expect(joints.map((s) => s.label)).toEqual([
      'Accepté',
      'Refusé',
      'À rappeler',
      'Décédé',
      'Retraité',
      'Hors cible',
      'Affecté ailleurs',
      'Faux numéro',
      'Autre joint',
    ]);
    expect(nonJoints.map((s) => s.label)).toEqual([
      'Pas de réponse',
      'Occupé',
      'Messagerie',
      'Téléphone indisponible',
      'Injoignable définitif',
      'Autre non joint',
    ]);
  });

  it('n’a ni code, ni libellé, ni rang en double : les deux premiers portent un index unique', () => {
    const champs: readonly (keyof StatutQualificationSeed)[] = ['code', 'label', 'sortOrder'];
    for (const champ of champs) {
      expect(new Set(STATUTS_QUALIFICATION.map((s) => s[champ])).size, champ).toBe(
        STATUTS_QUALIFICATION.length,
      );
    }
  });

  it('déduit chaque code de son libellé, sauf ceux figés avant un renommage', () => {
    for (const statut of STATUTS_QUALIFICATION) {
      if (CODES_FIGES_AVANT_RENOMMAGE.has(statut.code)) continue;
      expect(codeDepuisLibelle(statut.label), statut.label).toBe(statut.code);
    }
  });

  it('range « Faux numéro » parmi les joints et le laisse hors du taux d’acceptation', () => {
    expect(parCode.get('FAUX_NUMERO')?.effect).toBe('WRONG_NUMBER');
    expect(parCode.get('FAUX_NUMERO')?.retryAfterMinutes).toBeNull();
  });

  it('exige un motif sur les deux « Autre », et sur eux seuls', () => {
    expect(STATUTS_QUALIFICATION.filter((s) => s.requiresComment).map((s) => s.code)).toEqual([
      'AUTRE_JOINT',
      'AUTRE_NON_JOINT',
    ]);
  });

  it('n’exige une date de rappel que du statut qui la planifie', () => {
    for (const statut of STATUTS_QUALIFICATION) {
      expect(statut.requiresCallback, statut.code).toBe(statut.effect === 'SCHEDULE_CALLBACK');
    }
  });

  it('fait repasser tout non joint en file, sauf « Injoignable définitif »', () => {
    for (const statut of nonJoints) {
      const attendu = statut.code === 'INJOIGNABLE_DEFINITIF' ? null : expect.any(Number);
      expect(statut.retryAfterMinutes, statut.code).toEqual(attendu);
    }
  });

  it('ne fait repasser aucun joint : leur fiche est traitée', () => {
    for (const statut of joints) {
      expect(statut.retryAfterMinutes, statut.code).toBeNull();
    }
  });

  it('ne pose une relation que là où la réponse la tranche', () => {
    expect(
      STATUTS_QUALIFICATION.filter((s) => s.relationStatus !== null).map((s) => [
        s.code,
        s.relationStatus,
      ]),
    ).toEqual([
      ['ACCEPTE', 'AMBASSADEUR'],
      ['REFUSE', 'REFUS'],
    ]);
  });
});

describe('reprise des fiches qualifiées avant le Lot 1', () => {
  it('ne convertit que vers un statut de la liste proposée', () => {
    for (const [ancien, nouveau] of CONVERSIONS_STATUT_LOT_1) {
      expect(parCode.has(ancien), ancien).toBe(false);
      expect(parCode.has(nouveau), nouveau).toBe(true);
    }
  });

  it('dit exactement ce que la migration exécute', () => {
    const pairesSql = [...MIGRATION.matchAll(/\('([A-Z_]+)',\s*'([A-Z_]+)'\)/gu)].map(
      ([, ancien, nouveau]) => `${ancien}->${nouveau}`,
    );
    const attendues = CONVERSIONS_STATUT_LOT_1.map(([a, n]) => `${a}->${n}`);

    // La migration porte la table deux fois : les fiches, puis les tentatives.
    expect(pairesSql).toEqual([...attendues, ...attendues]);
  });

  it('désactive dans la migration tout statut converti', () => {
    const desactives = /SET "isActive" = false[\s\S]*?WHERE "code" IN \(([\s\S]*?)\);/u.exec(
      MIGRATION,
    );
    const codes = [...(desactives?.[1] ?? '').matchAll(/'([A-Z_]+)'/gu)].map(([, code]) => code);

    expect(new Set(codes)).toEqual(new Set(CONVERSIONS_STATUT_LOT_1.map(([ancien]) => ancien)));
  });
});
