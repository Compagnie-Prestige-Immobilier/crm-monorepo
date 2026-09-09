import type { ServerResponse } from 'node:http';

import type ExcelJS from 'exceljs';

/** Pose dans LES DEUX etats : un en-tete absent ne distingue pas mode eteint et proxy filtrant. */
export const DEMO_MODE_HEADER = 'X-Demo-Mode';

const DEMO_FILENAME_SUFFIX = '-DEMONSTRATION';

const WARNING_TEXT =
  'ATTENTION : ce fichier provient de l’espace démo et contient des données fictives. Il ne doit servir à aucune décision ni à aucun reporting.';

const WARNING_RED = 'FFB00020';
const WARNING_BACKGROUND = 'FFFDECEE';

const CREATOR = 'CPI GO';
const CREATOR_DEMO = 'CPI GO (mode démonstration)';

export const demoFilenameSuffix = (demoEnabled: boolean): string =>
  demoEnabled ? DEMO_FILENAME_SUFFIX : '';

export function setDemoHeader(response: ServerResponse, demoEnabled: boolean): void {
  response.setHeader(DEMO_MODE_HEADER, demoEnabled ? 'true' : 'false');
}

/** Les metadonnees survivent a la suppression d'une feuille et au renommage du fichier. */
export function markWorkbook(
  workbook: ExcelJS.Workbook | ExcelJS.stream.xlsx.WorkbookWriter,
  demoEnabled: boolean,
): void {
  workbook.creator = demoEnabled ? CREATOR_DEMO : CREATOR;
  workbook.lastModifiedBy = workbook.creator;
  workbook.created = new Date();
  workbook.modified = workbook.created;
  if (demoEnabled) workbook.description = WARNING_TEXT;
}

/** En ligne 2, jamais 1 : le tri et le volet fige d'Excel prendraient la ligne 1 pour l'en-tete. */
export function writeDemoWarningRow(
  sheet: ExcelJS.Worksheet,
  demoEnabled: boolean,
  columnCount: number,
): void {
  if (!demoEnabled) return;

  const row = sheet.addRow([WARNING_TEXT]);
  row.font = { bold: true, color: { argb: WARNING_RED }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARNING_BACKGROUND } };
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 24;

  // Fusion tentee, pas exigee : WorkbookWriter la refuse sur certaines feuilles, et
  // l'avertissement sur une seule colonne vaut mieux que pas d'avertissement.
  if (columnCount > 1) {
    try {
      sheet.mergeCells(row.number, 1, row.number, columnCount);
    } catch {
      // Sans fusion le texte deborde sur les cellules vides voisines : lisible.
    }
  }

  row.commit();
}
