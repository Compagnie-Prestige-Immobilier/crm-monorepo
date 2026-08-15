import { BadRequestException } from '@nestjs/common';
import { parsePhoneNumberWithError, type CountryCode } from 'libphonenumber-js';

/**
 * Normalisation du numéro de téléphone en E.164.
 *
 * C'EST LA CLÉ DE DÉDUPLICATION du système, pour Representant comme pour
 * Prospect, et elle est adossée à un index unique partiel en base. Elle doit
 * donc être DÉTERMINISTE : la même personne saisie « 77 123 45 67 » à Dakar et
 * « +221 77 123 45 67 » à Thiès doit produire exactement la même chaîne, sinon
 * la contrainte d'unicité ne contraint plus rien.
 *
 * L'app mobile applique la même normalisation avec la même région par défaut ;
 * un écart entre les deux rendrait la déduplication aléatoire.
 */

const DEFAULT_REGION_FALLBACK = 'SN';

/** Caractères de présentation admis dans une saisie humaine. */
const SEPARATORS = /[\s.\-() ‐-―/]/g;

export const phoneDefaultRegion = (): CountryCode =>
  (process.env.PHONE_DEFAULT_REGION ?? DEFAULT_REGION_FALLBACK).toUpperCase() as CountryCode;

/**
 * Ramène les préfixes internationaux écrits « à la main » à la forme `+`.
 *
 * `00221…` (préfixe de sortie UIT) et `221…` (indicatif nu, tel que le compose
 * un abonné sénégalais qui recopie un numéro) désignent le même abonné que
 * `+221…`. libphonenumber ne reconnaît spontanément ni l'un ni l'autre quand la
 * région par défaut est SN : `00221771234567` est lu comme un numéro local
 * absurde, et `221771234567` comme un numéro national de 12 chiffres. Les deux
 * échoueraient, ou pire, produiraient une E.164 distincte du même abonné.
 */
function canonicalizePrefix(raw: string, region: CountryCode): string {
  const compact = raw.replace(SEPARATORS, '');
  if (compact.startsWith('+')) return compact;

  // Préfixe de sortie international : 00 dans l'UIT-T E.123, 011 en Amérique
  // du Nord. Seul 00 concerne le Sénégal, mais accepter les deux ne crée pas
  // d'ambiguïté (aucun indicatif pays ne commence par 0).
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;

  const callingCode = REGION_CALLING_CODES[region];
  if (callingCode && compact.startsWith(callingCode)) {
    const national = compact.slice(callingCode.length);
    // On ne retire l'indicatif que si ce qui reste a la bonne longueur pour un
    // numéro national. Sans ce garde-fou, un numéro national qui commence par
    // les mêmes chiffres que l'indicatif serait amputé.
    if (national.length >= 8) return `+${compact}`;
  }

  return compact;
}

/**
 * Indicatifs des régions que le système peut rencontrer. Volontairement court :
 * l'app est déployée au Sénégal. `getCountryCallingCode` de libphonenumber
 * ferait le travail, mais elle lève sur une région inconnue, ici une région
 * absente signifie simplement « pas de dépréfixage », ce qui est sans risque.
 */
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

/**
 * @param input numéro saisi, dans n'importe quelle présentation courante
 * @param region région ISO 3166-1 alpha-2 par défaut (défaut : PHONE_DEFAULT_REGION)
 * @returns le numéro en E.164, par exemple `+221771234567`
 * @throws BadRequestException si le numéro est inexploitable
 */
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

/** Variante non levante, pour les filtres de recherche où un numéro partiel est acceptable. */
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
