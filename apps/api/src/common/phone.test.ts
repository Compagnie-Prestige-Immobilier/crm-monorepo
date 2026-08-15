import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { normalizePhone, tryNormalizePhone } from './phone.js';

const CANONICAL = '+221771234567';

describe('normalizePhone, déterminisme', () => {
  // C'est LE test qui protège la clé de déduplication : toutes ces saisies
  // désignent le même abonné et doivent produire la même chaîne, sinon
  // l'index unique partiel ne dédoublonne plus rien.
  const equivalents = [
    '771234567',
    '77 123 45 67',
    '77.123.45.67',
    '77-123-45-67',
    '77 12 34 567',
    ' 771234567 ',
    '+221771234567',
    '+221 77 123 45 67',
    '+221 (77) 123-45-67',
    '00221771234567',
    '00221 77 123 45 67',
    '221771234567',
    '221 77 123 45 67',
    '221-77-123-45-67',
  ];

  it.each(equivalents)('« %s » → +221771234567', (input) => {
    expect(normalizePhone(input, 'SN')).toBe(CANONICAL);
  });

  it('produit une seule valeur distincte pour toutes les présentations', () => {
    const distinct = new Set(equivalents.map((input) => normalizePhone(input, 'SN')));
    expect([...distinct]).toEqual([CANONICAL]);
  });

  it('est idempotente : normaliser une E.164 la laisse intacte', () => {
    expect(normalizePhone(normalizePhone('77 123 45 67', 'SN'), 'SN')).toBe(CANONICAL);
  });

  it('lit la région par défaut depuis PHONE_DEFAULT_REGION', () => {
    const previous = process.env.PHONE_DEFAULT_REGION;
    process.env.PHONE_DEFAULT_REGION = 'SN';
    try {
      expect(normalizePhone('771234567')).toBe(CANONICAL);
    } finally {
      if (previous === undefined) delete process.env.PHONE_DEFAULT_REGION;
      else process.env.PHONE_DEFAULT_REGION = previous;
    }
  });

  it('normalise les autres opérateurs sénégalais', () => {
    expect(normalizePhone('70 555 44 33', 'SN')).toBe('+221705554433');
    expect(normalizePhone('76 555 44 33', 'SN')).toBe('+221765554433');
    expect(normalizePhone('78 555 44 33', 'SN')).toBe('+221785554433');
    expect(normalizePhone('33 825 44 33', 'SN')).toBe('+221338254433');
  });

  it("n'ampute pas un numéro national qui commence par les chiffres de l'indicatif", () => {
    // 221… n'est pas un préfixe d'opérateur sénégalais valide sur 9 chiffres :
    // le dépréfixage ne doit pas transformer un numéro court en abonné fantôme.
    expect(() => normalizePhone('2217712', 'SN')).toThrow(BadRequestException);
  });
});

describe('normalizePhone, rejets', () => {
  const garbage = [
    '',
    '   ',
    'abc',
    'not a phone',
    '12',
    '0',
    '+',
    '++221771234567',
    '00000000000',
    '99 999 99 99 99 99 99',
    '77 123 45',
    '<script>alert(1)</script>',
  ];

  it.each(garbage)('rejette « %s »', (input) => {
    expect(() => normalizePhone(input, 'SN')).toThrow(BadRequestException);
  });

  it('expose un code métier exploitable côté client', () => {
    try {
      normalizePhone('abc', 'SN');
      expect.unreachable('normalizePhone aurait dû lever');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'PHONE_INVALID' });
    }
  });
});

describe('tryNormalizePhone', () => {
  it('renvoie undefined au lieu de lever', () => {
    expect(tryNormalizePhone('abc', 'SN')).toBeUndefined();
    expect(tryNormalizePhone(undefined, 'SN')).toBeUndefined();
    expect(tryNormalizePhone(null, 'SN')).toBeUndefined();
  });

  it('normalise quand c’est possible', () => {
    expect(tryNormalizePhone('77 123 45 67', 'SN')).toBe(CANONICAL);
  });
});
