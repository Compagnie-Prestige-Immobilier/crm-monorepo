'use client';

import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import type { Pays } from '@/lib/types';

export interface CallingCountry {
  code: string;
  label: string;
}

const COUNTRIES = [
  { code: '221', label: '🇸🇳 +221', nationalLength: 9 },
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

export function toInternationalE164(raw: string, callingCode: string): string | null {
  if (/\p{Letter}/u.test(raw)) return null;
  const compact = raw.trim().replace(/[\s.\-()]/gu, '');
  const international = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  if (international.startsWith('+')) {
    const digits = international.slice(1);
    return /^\d{8,15}$/u.test(digits) ? `+${digits}` : null;
  }

  const digits = international.replace(/\D/gu, '');
  const country = COUNTRIES.find((entry) => entry.code === callingCode);
  if (country && 'nationalLength' in country && digits.length !== country.nationalLength)
    return null;
  const value = digits.startsWith(callingCode) ? digits : `${callingCode}${digits}`;
  return /^\d{8,15}$/u.test(value) ? `+${value}` : null;
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
              onChange(event.target.value);
            }}
          />
        </div>
      )}
    </Field>
  );
}
