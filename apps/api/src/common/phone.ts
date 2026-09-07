import { BadRequestException } from '@nestjs/common';
import { parsePhoneNumberWithError, type CountryCode } from 'libphonenumber-js';
/**
 * Clé de déduplication de Representant et Prospect, adossée à un index unique
 * PARTIEL en base : elle doit rester déterministe. L'app mobile applique la même
 * normalisation avec la même région par défaut ; un écart rendrait la
 * déduplication aléatoire.
 */

const DEFAULT_REGION_FALLBACK = 'SN';

const SEPARATORS = /[\s.\-() ‐-―/]/g;

const phoneDefaultRegion = (): CountryCode =>
  (process.env.PHONE_DEFAULT_REGION ?? DEFAULT_REGION_FALLBACK).toUpperCase() as CountryCode;

/**
 * libphonenumber ne reconnaît ni `00221…` ni `221…` avec la région SN par défaut :
 * il les lit comme des numéros locaux absurdes, d'où une E.164 distincte du même
 * abonné.
 */
function canonicalizePrefix(raw: string, region: CountryCode): string {
  const compact = raw.replace(SEPARATORS, '');
  if (compact.startsWith('+')) return compact;

  if (compact.startsWith('00')) return `+${compact.slice(2)}`;

  const callingCode = REGION_CALLING_CODES[region];
  if (callingCode && compact.startsWith(callingCode)) {
    // Longueur vérifiée : sinon un numéro national commençant par les mêmes
    // chiffres que l'indicatif serait amputé.
    const national = compact.slice(callingCode.length);
    if (national.length >= 8) return `+${compact}`;
  }

  return compact;
}

const REGION_CALLING_CODES: Readonly<Record<string, string>> = {
  SN: '221',
  ML: '223',
  CI: '225',
  GN: '224',
  MR: '222',
  GM: '220',
  BF: '226',
  FR: '33',
};

export function normalizePhone(input: string, region: CountryCode = phoneDefaultRegion()): string {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new BadRequestException({
      code: 'PHONE_INVALID',
      message: 'Le numéro de téléphone est obligatoire.',
    });
  }

  const candidate = canonicalizePrefix(input, region);

  try {
    const parsed = parsePhoneNumberWithError(candidate, region);
    if (!parsed.isValid()) {
      throw new BadRequestException({
        code: 'PHONE_INVALID',
        message: `Numéro de téléphone invalide : ${input}`,
      });
    }
    return parsed.number;
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException({
      code: 'PHONE_INVALID',
      message: `Numéro de téléphone invalide : ${input}`,
    });
  }
}

export function tryNormalizePhone(
  input: string | undefined | null,
  region: CountryCode = phoneDefaultRegion(),
): string | undefined {
  if (!input) return undefined;
  try {
    return normalizePhone(input, region);
  } catch {
    return undefined;
  }
}
