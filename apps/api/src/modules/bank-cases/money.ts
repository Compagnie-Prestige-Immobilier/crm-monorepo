import { Prisma } from '@crm/database';

/**
 * Le franc CFA est exposé en CHAÎNE, jamais en nombre JSON.
 *
 * XOF n'a pas de décimales et la colonne est un `Decimal(18,0)`. Un montant
 * au-delà de 2^53, 9 007 199 254 740 992 FCFA, soit l'ordre de grandeur d'un
 * portefeuille consolidé, perdrait de la précision dès la désérialisation
 * JSON, silencieusement. Le client formate la chaîne en FCFA ; il n'a jamais
 * besoin d'en faire de l'arithmétique.
 */

/** Entier non signé, 18 chiffres au plus : exactement ce que la colonne accepte. */
export const MONEY_PATTERN = /^\d{1,18}$/u;

export const ZERO_XOF = '0';

/** `Decimal` Prisma → chaîne entière. `null` reste `null`. */
export function moneyToString(value: Prisma.Decimal | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.toFixed(0);
}

/** Somme d'agrégat SQL (numeric) → chaîne entière. `null` devient « 0 ». */
export function sumToString(value: Prisma.Decimal | string | number | null): string {
  if (value === null) return ZERO_XOF;
  if (typeof value === 'string') return value.split('.')[0] ?? ZERO_XOF;
  if (typeof value === 'number') return Math.trunc(value).toString();
  return value.toFixed(0);
}

/** Chaîne validée → `Decimal`, pour l'écriture. */
export function toDecimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/** Vrai si le montant est strictement positif. La chaîne est déjà validée. */
export function isStrictlyPositive(value: string): boolean {
  return /[1-9]/u.test(value);
}

/** Pour Excel : un nombre y est légitime, la feuille sert au calcul. */
export function moneyToNumber(value: string | null): number | null {
  if (value === null) return null;
  return Number(value);
}
