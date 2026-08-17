export type RawSearchParams = Record<string, string | string[] | undefined>;

export function readOne(params: RawSearchParams | URLSearchParams, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key);
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

export function readString(params: RawSearchParams | URLSearchParams, key: string): string | null {
  const value = readOne(params, key);
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function readPositiveInt(
  params: RawSearchParams | URLSearchParams,
  key: string,
  fallback: number,
): number {
  const value = readString(params, key);
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readIsoDate(params: RawSearchParams | URLSearchParams, key: string): string | null {
  const value = readString(params, key);
  if (value === null) return null;
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : null;
}

export function readEnum<T extends string>(
  params: RawSearchParams | URLSearchParams,
  key: string,
  allowed: readonly T[],
): T | null {
  const value = readString(params, key);
  if (value === null) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function readFrenchBoolean(
  params: RawSearchParams | URLSearchParams,
  key: string,
): boolean | null {
  const value = readString(params, key);
  if (value === 'oui') return true;
  if (value === 'non') return false;
  return null;
}
