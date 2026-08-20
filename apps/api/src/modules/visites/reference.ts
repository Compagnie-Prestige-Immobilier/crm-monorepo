/** Le « N° » du registre papier : `V-2026-000412`, une suite par ANNÉE. */

const REFERENCE = /^V-(\d{4})-(\d{6})$/;

export const MAX_VISITE_SEQUENCE = 999_999;

export const visiteReferencePrefix = (year: number): string => `V-${String(year)}-`;

export function formatVisiteReference(year: number, sequence: number): string {
  if (sequence < 1 || sequence > MAX_VISITE_SEQUENCE) {
    throw new RangeError(`Rang de visite hors bornes : ${String(sequence)}`);
  }
  return `${visiteReferencePrefix(year)}${String(sequence).padStart(6, '0')}`;
}

/** Le tri lexicographique suit le rang tant que celui-ci tient sur six chiffres. */
export function nextVisiteSequence(lastReference: string | null | undefined, year: number): number {
  if (!lastReference) return 1;

  const match = REFERENCE.exec(lastReference);
  if (match === null || match[1] !== String(year)) return 1;

  return Number(match[2]) + 1;
}
