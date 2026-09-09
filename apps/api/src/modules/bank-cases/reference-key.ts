export function normalizeReferenceKey(reference: string): string {
  return reference.trim().replace(/\s+/gu, ' ').toUpperCase();
}

export function normalizeReferenceDisplay(reference: string): string {
  return reference.trim().replace(/\s+/gu, ' ');
}
