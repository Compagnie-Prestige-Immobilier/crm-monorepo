import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { ConfirmGrandPublicConversionDto } from './dto.js';

const erreurs = (montant: number): string[] => {
  const dto = plainToInstance(ConfirmGrandPublicConversionDto, {
    offerId: '0198f000-0000-7000-8000-000000000001',
    amountXof: montant,
  });
  return validateSync(dto).flatMap((e) => Object.keys(e.constraints ?? {}));
};

describe('montant d’une conversion', () => {
  /// La colonne est un `Int` PostgreSQL. Sans borne, la base répondait
  /// « integer out of range » et l'appelant recevait un 500 non qualifié sur une
  /// valeur que la validation venait d'accepter.
  it('refuse au-delà du plafond entier de PostgreSQL', () => {
    expect(erreurs(2_147_483_648)).toContain('max');
  });

  it('accepte le plafond lui-même', () => {
    expect(erreurs(2_147_483_647)).toEqual([]);
  });

  it('refuse toujours un montant négatif', () => {
    expect(erreurs(-1)).toContain('min');
  });
});
