/** Ce que le tableur exécute au lieu de l'afficher, si la cellule commence ainsi. */
const FORMULA_START = /^[=+\-@\t\r]/u;

/**
 * Une cellule de classeur, protégée de l'injection de formule.
 *
 * Les guillemets CSV ne suffisent pas : le tableur les retire avant d'évaluer
 * la cellule. Seule l'apostrophe de tête, qu'il consomme sans l'afficher,
 * neutralise `=`, `+`, `-`, `@`, la tabulation et le retour chariot.
 */
function csvCell(value: string | number | null): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value).replace('.', ',');

  const guarded = FORMULA_START.test(value) ? `'${value}` : value;
  return /["\r\n;]/u.test(guarded) ? `"${guarded.replace(/"/gu, '""')}"` : guarded;
}

export function csvRows(rows: readonly (readonly (string | number | null)[])[]): string {
  return rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}

/** Le BOM est ce qui fait lire l'UTF-8 à Excel, qui sinon casse les accents. */
export function downloadCsv(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
