const MONEY_PATTERN = /^\d{1,18}$/u;

const GROUP_SEPARATOR = ' ';

export function isMoneyString(value: unknown): value is string {
  return typeof value === 'string' && MONEY_PATTERN.test(value);
}

function groupDigits(digits: string): string {
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end));
  }
  return groups.join(GROUP_SEPARATOR);
}

export function formatXof(value: string | null | undefined, placeholder = '–'): string {
  if (value === null || value === undefined || value === '') return placeholder;
  const trimmed = value.trim();
  if (!MONEY_PATTERN.test(trimmed)) return `${trimmed} FCFA`;
  const normalized = trimmed.replace(/^0+(?=\d)/u, '');
  return `${groupDigits(normalized)} FCFA`;
}

const COMPACT_UNITS: readonly { readonly minDigits: number; readonly suffix: string }[] = [
  { minDigits: 10, suffix: 'Mrd' },
  { minDigits: 7, suffix: 'M' },
  { minDigits: 4, suffix: 'k' },
];

function compactMantissa(digits: string): string {
  const unit = COMPACT_UNITS.find((candidate) => digits.length >= candidate.minDigits);

  if (unit === undefined) return digits;

  const scale = unit.minDigits - 1;
  const whole = digits.slice(0, digits.length - scale);
  const rest = digits.slice(digits.length - scale);

  const decimals = Math.max(0, 3 - whole.length);
  const fraction = rest.slice(0, decimals).replace(/0+$/u, '');

  const mantissa = fraction === '' ? groupDigits(whole) : `${groupDigits(whole)},${fraction}`;
  return `${mantissa} ${unit.suffix}`;
}

export function formatXofCompact(value: string | null | undefined, placeholder = '–'): string {
  if (value === null || value === undefined || value === '') return placeholder;
  const trimmed = value.trim();
  if (!MONEY_PATTERN.test(trimmed)) return formatXof(trimmed, placeholder);

  return `${compactMantissa(trimmed.replace(/^0+(?=\d)/u, ''))} FCFA`;
}

export function formatXofAxisTick(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return compactMantissa(Math.round(value).toString());
}

export function parseMoneyInput(raw: string): string | null {
  const digits = raw.replace(/\D/gu, '');
  if (digits === '') return null;
  const normalized = digits.replace(/^0+(?=\d)/u, '');
  return normalized.length > 18 ? null : normalized;
}

export function xofToChartNumber(value: string | null | undefined): number {
  if (!isMoneyString(value)) return 0;
  return Number(value);
}
