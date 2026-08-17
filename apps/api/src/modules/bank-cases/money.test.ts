import { Prisma } from '@crm/database';
import { describe, expect, it } from 'vitest';

import {
  MONEY_PATTERN,
  ZERO_XOF,
  isStrictlyPositive,
  moneyToNumber,
  moneyToString,
  sumToString,
  toDecimal,
} from './money.js';
import { normalizeReferenceDisplay, normalizeReferenceKey } from './reference-key.js';

describe('discipline du montant', () => {
  it('un montant à 18 chiffres survit à l’aller-retour JSON en chaîne, mais PAS en nombre', () => {
    const montant = '123456789012345678';

    expect(JSON.parse(`{"amountXof":"${montant}"}`)).toEqual({ amountXof: montant });

    const enNombre = JSON.parse(`{"amountXof":${montant}}`) as { amountXof: number };
    expect(String(enNombre.amountXof)).not.toBe(montant);
  });

  it('le motif n’accepte qu’un entier non signé de 18 chiffres au plus', () => {
    for (const valide of ['0', '1', '1200000', '123456789012345678']) {
      expect(MONEY_PATTERN.test(valide)).toBe(true);
    }
    for (const invalide of ['', '-1', '12.5', '1 200 000', '1e6', '1234567890123456789', 'abc']) {
      expect(MONEY_PATTERN.test(invalide)).toBe(false);
    }
  });

  it('convertit le Decimal Prisma en chaîne entière, et préserve le nul', () => {
    expect(moneyToString(new Prisma.Decimal('1200000'))).toBe('1200000');
    expect(moneyToString(new Prisma.Decimal('0'))).toBe('0');
    expect(moneyToString(null)).toBeNull();
    expect(moneyToString(undefined)).toBeNull();
  });

  it('une somme d’agrégat SQL devient une chaîne entière, nulle comprise', () => {
    expect(sumToString(null)).toBe(ZERO_XOF);
    expect(sumToString('1200000')).toBe('1200000');
    expect(sumToString('1200000.000')).toBe('1200000');
    expect(sumToString(new Prisma.Decimal('42'))).toBe('42');
    expect(sumToString(7.9)).toBe('7');
  });

  it('l’écriture repasse par Decimal sans perte', () => {
    expect(toDecimal('123456789012345678').toFixed(0)).toBe('123456789012345678');
  });

  it('la stricte positivité ne se laisse pas berner par les zéros', () => {
    expect(isStrictlyPositive('0')).toBe(false);
    expect(isStrictlyPositive('000')).toBe(false);
    expect(isStrictlyPositive('001')).toBe(true);
    expect(isStrictlyPositive('1200000')).toBe(true);
  });

  it('vers Excel, et LÀ seulement, le montant redevient un nombre', () => {
    expect(moneyToNumber('1200000')).toBe(1200000);
    expect(moneyToNumber(null)).toBeNull();
  });
});

describe('normalisation de la référence', () => {
  it('la clé ignore la casse et les espaces superflus', () => {
    expect(normalizeReferenceKey('abc-123')).toBe('ABC-123');
    expect(normalizeReferenceKey('  ABC-123  ')).toBe('ABC-123');
    expect(normalizeReferenceKey('BNK  2026   014')).toBe('BNK 2026 014');
    expect(normalizeReferenceKey('bnk 2026-014')).toBe(normalizeReferenceKey('BNK   2026-014'));
  });

  it('la clé ne touche NI aux tirets NI aux barres obliques : ce sont des références distinctes', () => {
    expect(normalizeReferenceKey('ABC-123')).not.toBe(normalizeReferenceKey('ABC 123'));
    expect(normalizeReferenceKey('ABC/123')).not.toBe(normalizeReferenceKey('ABC-123'));
  });

  it('l’affichage compacte les espaces mais préserve la casse de l’agent', () => {
    expect(normalizeReferenceDisplay('  bnk  2026-014 ')).toBe('bnk 2026-014');
    expect(normalizeReferenceDisplay('ABC-123')).toBe('ABC-123');
  });
});
