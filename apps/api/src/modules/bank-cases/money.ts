import { Prisma } from '@crm/database';

// XOF n'a pas de décimales et la colonne est un `Decimal(18,0)` : tout montant
// voyage en CHAÎNE, un nombre JSON perdrait la précision au-delà de 2^53.
export const MONEY_PATTERN = /^\d{1,18}$/u;

export const ZERO_XOF = '0';

export function moneyToString(value: Prisma.Decimal | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.toFixed(0);
}

/** Somme d'agrégat SQL : PostgreSQL rend un `numeric` décimal, tronqué ici. */
export function sumToString(value: Prisma.Decimal | string | number | null): string {
  if (value === null) return ZERO_XOF;
  if (typeof value === 'string') return value.split('.')[0] ?? ZERO_XOF;
  if (typeof value === 'number') return Math.trunc(value).toString();
  return value.toFixed(0);
}

export function toDecimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

// Un chiffre non nul, et non `Number(value) > 0` : la conversion perdrait la
// précision au-delà de 2^53. La chaîne est déjà validée par `MONEY_PATTERN`.
export function isStrictlyPositive(value: string): boolean {
  return /[1-9]/u.test(value);
}

/** Pour Excel, et là seulement : la feuille sert au calcul. */
export function moneyToNumber(value: string | null): number | null {
  if (value === null) return null;
  return Number(value);
}
