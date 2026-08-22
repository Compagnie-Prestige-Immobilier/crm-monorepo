'use client';

import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';

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
  value,
  callingCode,
  error,
  onChange,
  onCallingCodeChange,
}: {
  value: string;
  callingCode: string;
  error?: string | undefined;
  onChange: (value: string) => void;
  onCallingCodeChange: (value: string) => void;
}) {
  return (
    <Field
      label="Téléphone"
      required
      error={error}
      description="Sénégal par défaut. Changez le pays si nécessaire."
    >
      {(props) => (
        <div className="flex gap-2">
          <select
            aria-label="Pays"
            value={callingCode}
            className="h-11 rounded-md border border-input bg-background px-3 text-[0.875rem]"
            onChange={(event) => {
              onCallingCodeChange(event.target.value);
            }}
          >
            {COUNTRIES.map((country) => (
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
            placeholder="77 123 45 67"
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
        </div>
      )}
    </Field>
  );
}
