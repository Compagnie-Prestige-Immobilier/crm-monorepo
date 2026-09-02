'use client';

import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';

import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import type { Pays } from '@/lib/types';

export interface CallingCountry {
  code: string;
  label: string;
}

const COUNTRIES = [
  { code: '221', label: '🇸🇳 +221' },
  { code: '33', label: '🇫🇷 +33' },
  { code: '225', label: '🇨🇮 +225' },
  { code: '223', label: '🇲🇱 +223' },
  { code: '224', label: '🇬🇳 +224' },
  { code: '220', label: '🇬🇲 +220' },
  { code: '222', label: '🇲🇷 +222' },
  { code: '226', label: '🇧🇫 +226' },
] as const;

/** Deux lettres ISO 3166-1 alpha-2 en drapeau, par indicateurs régionaux. */
function drapeau(iso2: string): string {
  if (iso2.length !== 2) return '';
  const majuscules = iso2.toUpperCase();
  return String.fromCodePoint(
    0x1f1a5 + majuscules.charCodeAt(0),
    0x1f1a5 + majuscules.charCodeAt(1),
  );
}

/**
 * Les indicatifs viennent du référentiel `pays` : une seconde table côté client
 * en divergerait au premier pays ajouté.
 */
export function callingCountriesFrom(pays: readonly Pays[]): CallingCountry[] {
  return pays
    .filter((entry) => entry.isActive)
    .map((entry) => ({
      code: entry.indicatif,
      label: `${drapeau(entry.code)} +${entry.indicatif}`,
    }));
}

const paysDeIndicatif = (callingCode: string): CountryCode | undefined =>
  getCountries().find((pays) => getCountryCallingCode(pays) === callingCode);

/** Le masque du pays de l'indicatif. Rendu tel quel si le pays est inconnu de la métadonnée. */
function masquer(saisie: string, callingCode: string): string {
  const pays = paysDeIndicatif(callingCode);
  return pays === undefined ? saisie : new AsYouType(pays).input(saisie);
}

/** L'indicatif d'un côté, le national de l'autre : ce que la saisie attend. */
export function fromE164(e164: string): { phone: string; callingCode: string } {
  const parsed = parsePhoneNumberFromString(e164);
  if (parsed === undefined) return { phone: e164, callingCode: '221' };
  return {
    phone: masquer(parsed.nationalNumber, parsed.countryCallingCode),
    callingCode: parsed.countryCallingCode,
  };
}

export function toInternationalE164(raw: string, callingCode: string): string | null {
  if (/\p{Letter}/u.test(raw)) return null;
  const compact = raw.trim().replace(/[\s.\-()]/gu, '');
  const international = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  const digits = international.replace(/\D/gu, '');
  if (digits === '') return null;

  const value =
    international.startsWith('+') || digits.startsWith(callingCode)
      ? digits
      : `${callingCode}${digits}`;
  return isValidPhoneNumber(`+${value}`) ? `+${value}` : null;
}

export function InternationalPhoneField({
  label = 'Téléphone',
  countryLabel = 'Pays',
  description = 'Sénégal par défaut. Changez le pays si nécessaire.',
  required = true,
  placeholder = '77 123 45 67',
  countries,
  value,
  callingCode,
  error,
  onChange,
  onCallingCodeChange,
}: {
  label?: string | undefined;
  countryLabel?: string | undefined;
  description?: string | undefined;
  required?: boolean | undefined;
  placeholder?: string | undefined;
  countries?: readonly CallingCountry[] | undefined;
  value: string;
  callingCode: string;
  error?: string | undefined;
  onChange: (value: string) => void;
  onCallingCodeChange: (value: string) => void;
}) {
  const liste = countries === undefined || countries.length === 0 ? COUNTRIES : countries;
  // Un indicatif venu du pays de résidence peut ne pas figurer dans la liste
  // courte : sans cette entrée, le `select` retomberait silencieusement sur +221.
  const connu = liste.some((country) => country.code === callingCode);

  return (
    <Field label={label} required={required} error={error} description={description}>
      {(props) => (
        <div className="flex gap-2">
          <select
            aria-label={countryLabel}
            value={callingCode}
            className="h-11 rounded-md border border-input bg-background px-3 text-[0.875rem]"
            onChange={(event) => {
              onCallingCodeChange(event.target.value);
            }}
          >
            {connu ? null : <option value={callingCode}>+{callingCode}</option>}
            {liste.map((country) => (
              <option key={country.code} value={country.code}>
                {country.label}
              </option>
            ))}
          </select>
          <Input
            {...props}
            value={value}
            maxLength={40}
            inputMode="tel"
            autoComplete="tel"
            placeholder={placeholder}
            onChange={(event) => {
              const saisie = event.target.value;
              // Le masque ne s'applique qu'à la frappe : reformater une suppression
              // remettrait le séparateur que le retour arrière vient d'enlever.
              onChange(saisie.length > value.length ? masquer(saisie, callingCode) : saisie);
            }}
          />
        </div>
      )}
    </Field>
  );
}
