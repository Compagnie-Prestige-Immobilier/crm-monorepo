import type { Writable } from 'node:stream';

import ExcelJS from 'exceljs';

import { CPI_BURGUNDY_ARGB } from '../../common/brand.js';
import type { ImportColumn } from '../representants/import-template.js';
import { INSTRUCTIONS_SHEET_NAME, LISTS_SHEET_NAME } from '../representants/import-template.js';

interface TemplateDropdown {
  /** Rang de la colonne de saisie, 1 pour la première. */
  readonly column: number;
  readonly label: string;
  readonly values: readonly string[];
}

export interface ImportTemplateSpec {
  readonly sheetName: string;
  readonly columns: readonly ImportColumn[];
  readonly dropdowns: readonly TemplateDropdown[];
  readonly rules: readonly string[];
}

const SAMPLE_GREY = 'FF9A9A9A';
const SAMPLE_BACKGROUND = 'FFF3F3F3';

/** `dataValidation` est posée cellule par cellule : au-delà, le modèle vide pèse des mégaoctets. */
const LAST_VALIDATED_ROW = 1_000;

export const COLUMNS_BY_POSITION_RULE =
  'Ne modifiez ni l’ordre ni le nombre des colonnes : le fichier est relu par position, pas par le texte de l’en-tête.';

export const COLUMNS_BY_HEADER_RULE =
  'Les colonnes sont retrouvées par le TEXTE de leur en-tête, en ligne 1 : vous pouvez les déplacer, en intercaler d’autres, ou retirer une colonne facultative.';

export const COMMON_TEMPLATE_RULES: readonly string[] = [
  COLUMNS_BY_POSITION_RULE,
  'La ligne 2 est un exemple grisé : elle n’est JAMAIS lue à l’import. Laissez-la en place et commencez votre saisie en ligne 3.',
  'Les lignes entièrement vides sont ignorées, pas comptées en erreur.',
  'L’import se fait en deux temps : une simulation qui liste les erreurs ligne par ligne, puis l’application, qui écrit.',
];

/** `WorkbookWriter` en flux ne sait pas poser de validation par plage ; un modèle vide tient en RAM. */
export async function writeImportTemplate(
  stream: Writable,
  spec: ImportTemplateSpec,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CPI GO';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(spec.sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = spec.columns.map((column) => ({
    header: column.header,
    key: column.header,
    width: column.width,
  }));
  styleHeader(sheet, spec.columns.length);

  // Le lecteur d'import commence en ligne 3 (`FIRST_DATA_ROW`) : sans cette
  // ligne d'exemple, la première ligne saisie ne serait jamais lue.
  const sample = sheet.addRow(spec.columns.map((column) => column.sample));
  sample.font = { italic: true, color: { argb: SAMPLE_GREY } };
  sample.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SAMPLE_BACKGROUND } };

  const lists = workbook.addWorksheet(LISTS_SHEET_NAME);
  lists.state = 'veryHidden';

  spec.dropdowns.forEach((dropdown, index) => {
    lists.getColumn(index + 1).values = [dropdown.label, ...dropdown.values];

    // Un référentiel vide donnerait la plage `$A$2:$A$1`, qu'Excel signale en
    // ouvrant le fichier comme un classeur endommagé.
    if (dropdown.values.length === 0) return;

    const letter = String.fromCharCode(65 + index);
    applyListValidation(
      sheet,
      dropdown.column,
      `${LISTS_SHEET_NAME}!$${letter}$2:$${letter}$${String(dropdown.values.length + 1)}`,
    );
  });

  const help = workbook.addWorksheet(INSTRUCTIONS_SHEET_NAME);
  help.columns = [
    { header: 'Colonne', key: 'column', width: 22 },
    { header: 'Obligatoire', key: 'required', width: 14 },
    { header: 'À savoir', key: 'help', width: 90 },
  ];
  styleHeader(help, 3);
  for (const column of spec.columns) {
    help.addRow({
      column: column.header,
      required: column.required ? 'Oui' : 'Non',
      help: column.help,
    });
  }
  help.addRow({});
  const rules = help.addRow({ column: 'Règles générales' });
  rules.font = { bold: true, color: { argb: CPI_BURGUNDY_ARGB } };
  for (const line of spec.rules) {
    help.addRow({ help: line });
  }

  await workbook.xlsx.write(stream);
}

export function styleHeader(sheet: ExcelJS.Worksheet, columnCount: number): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CPI_BURGUNDY_ARGB } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };
  header.height = 22;
  for (let column = 1; column <= columnCount; column += 1) {
    header.getCell(column).border = {
      bottom: { style: 'thin', color: { argb: CPI_BURGUNDY_ARGB } },
    };
  }
  header.commit();
}

function applyListValidation(sheet: ExcelJS.Worksheet, column: number, formula: string): void {
  for (let row = 2; row <= LAST_VALIDATED_ROW; row += 1) {
    sheet.getCell(row, column).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      // La liste guide, elle n'interdit pas : le serveur reste seul juge.
      showErrorMessage: false,
    };
  }
}
