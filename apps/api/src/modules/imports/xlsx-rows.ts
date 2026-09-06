import { createReadStream } from 'node:fs';
import ExcelJS from 'exceljs';

import { normalizeKey } from '../representants/representants-import.service.js';
import type { ImportColumn, SheetLayout } from './import-adapter.js';
import { FIRST_DATA_ROW } from './imports.job.js';

/**
 * Clé réservée portant le nom de l'onglet, quand le classeur en compte
 * plusieurs. `parseRow` ne reçoit qu'un numéro de ligne, et douze onglets ont
 * tous une ligne 27 : sans le nom, un refus est introuvable.
 */
export const SHEET_CELL = '#feuille';

interface SheetRow {
  readonly rowNumber: number;
  readonly cells: Record<string, string>;
}

export interface SheetSource {
  readonly declaredDataRows: number | null;
  rows(): AsyncIterable<SheetRow>;
  close(): Promise<void>;
}

export interface ImportRowReader {
  open(
    storagePath: string,
    columns: readonly ImportColumn[],
    layout?: SheetLayout,
  ): Promise<SheetSource>;
}

export const IMPORT_ROW_READER = Symbol('IMPORT_ROW_READER');

export class UnreadableWorkbookError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'UnreadableWorkbookError';
  }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('result' in value) return cellText(value.result);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => part.text)
        .join('')
        .trim();
    }
  }
  return '';
}

export const isBlankRow = (cells: Record<string, string>): boolean =>
  Object.entries(cells).every(([key, cell]) => key === SHEET_CELL || cell === '');

export class ExcelStreamRowReader implements ImportRowReader {
  async open(
    storagePath: string,
    columns: readonly ImportColumn[],
    layout?: SheetLayout,
  ): Promise<SheetSource> {
    const file = createReadStream(storagePath);
    const workbook = new ExcelJS.stream.xlsx.WorkbookReader(file, {
      worksheets: 'emit',
      sharedStrings: 'cache',
      styles: 'ignore',
      hyperlinks: 'ignore',
      entries: 'ignore',
    });

    const worksheets = workbook[Symbol.asyncIterator]();
    let first;
    try {
      first = await worksheets.next();
    } catch (error) {
      file.destroy();
      throw new UnreadableWorkbookError(
        `Le fichier n’est pas un classeur Excel lisible (.xlsx). ${String(error)}`,
      );
    }

    if (first.done === true) {
      file.destroy();
      throw new UnreadableWorkbookError('Le classeur ne contient aucune feuille.');
    }

    const sheet = first.value;
    const close = async (): Promise<void> => {
      file.destroy();
      await worksheets.return(undefined);
    };

    // Plusieurs onglets : le dénominateur de l'avancement ne se connaît qu'en
    // les ayant tous traversés, c'est-à-dire trop tard pour servir de jauge.
    if (layout !== undefined) {
      return {
        declaredDataRows: null,
        rows: () => projectSheets(sheetsFrom(sheet, worksheets), columns, layout),
        close,
      };
    }

    const declared = (sheet as unknown as { dimensions?: { bottom?: number } | null }).dimensions;
    const bottom = typeof declared?.bottom === 'number' ? declared.bottom : null;
    const declaredDataRows =
      bottom !== null && bottom >= FIRST_DATA_ROW ? bottom - FIRST_DATA_ROW + 1 : null;

    return {
      declaredDataRows,
      rows: () => readRows(sheet, columns),
      close,
    };
  }
}

async function* readRows(
  sheet: ExcelJS.stream.xlsx.WorksheetReader,
  columns: readonly ImportColumn[],
): AsyncIterable<SheetRow> {
  for await (const row of sheet) {
    const rowNumber = row.number;
    if (rowNumber < FIRST_DATA_ROW) continue;

    const cells: Record<string, string> = {};
    columns.forEach((column, index) => {
      cells[column.header] = cellText(row.getCell(index + 1).value);
    });

    yield { rowNumber, cells };
  }
}

type Worksheets = AsyncIterator<ExcelJS.stream.xlsx.WorksheetReader>;

/** Ce que la projection multi-onglets demande d'une feuille, et rien de plus. */
interface RowLike {
  readonly number: number;
  readonly cellCount: number;
  getCell(index: number): { readonly value: ExcelJS.CellValue };
}

interface SheetLike extends AsyncIterable<RowLike> {
  readonly name?: string;
}

async function* sheetsFrom(first: SheetLike, rest: Worksheets): AsyncIterable<SheetLike> {
  let sheet = first;
  for (;;) {
    yield sheet;
    const next = await rest.next();
    if (next.done === true) return;
    sheet = next.value;
  }
}

async function* projectSheets(
  sheets: AsyncIterable<SheetLike>,
  columns: readonly ImportColumn[],
  layout: SheetLayout,
): AsyncIterable<SheetRow> {
  const names: string[] = [];
  let matched = 0;

  for await (const sheet of sheets) {
    const name = sheet.name ?? '';
    names.push(name);
    if (!layout.sheetPattern.test(name)) {
      await drain(sheet);
      continue;
    }
    matched += 1;
    yield* projectRows(sheet, columns, layout, name);
  }

  // Sans ce refus, un onglet renommé rendrait un rapport à zéro ligne, qui a
  // l'air d'un fichier vide et n'en est pas un.
  if (matched === 0) {
    throw new UnreadableWorkbookError(
      `Aucun onglet de ce classeur ne porte de données à importer. Onglets trouvés : ${names.join(', ')}.`,
    );
  }
}

/** Le lecteur en flux avance feuille par feuille : sauter les lignes d'un onglet le bloquerait. */
async function drain(sheet: SheetLike): Promise<void> {
  const rows = sheet[Symbol.asyncIterator]();
  for (;;) {
    const next = await rows.next();
    if (next.done === true) return;
  }
}

async function* projectRows(
  sheet: SheetLike,
  columns: readonly ImportColumn[],
  layout: SheetLayout,
  sheetName: string,
): AsyncIterable<SheetRow> {
  let mapping: (number | null)[] | null = null;

  for await (const row of sheet) {
    const rowNumber = row.number;
    if (rowNumber < layout.headerRow) continue;

    if (rowNumber === layout.headerRow) {
      mapping = mapHeaders(row, columns, layout, sheetName);
      continue;
    }

    if (mapping === null) {
      throw new UnreadableWorkbookError(
        `L’onglet « ${sheetName} » n’a pas de ligne ${String(layout.headerRow)} : ses colonnes sont introuvables.`,
      );
    }

    // La ligne 2 d'un modèle engendré porte l'exemple grisé, jamais des données.
    if (rowNumber < FIRST_DATA_ROW) continue;

    const at = mapping;
    const cells: Record<string, string> = { [SHEET_CELL]: sheetName };
    columns.forEach((column, index) => {
      const source = at[index];
      cells[column.header] = source == null ? '' : cellText(row.getCell(source).value);
    });

    yield { rowNumber, cells };
  }
}

/**
 * Les colonnes sont retrouvées par leur en-tête, ONGLET PAR ONGLET.
 *
 * Un classeur tenu à la main gagne des colonnes en cours de route : dans celui
 * de l'accueil, le mois d'août en compte deux de plus que les autres, déclarées
 * en toutes lettres sur sa propre ligne d'en-tête. Une position figée y lirait
 * le téléphone sous « ENTREPRISE » et perdrait le mois entier.
 */
function mapHeaders(
  row: RowLike,
  columns: readonly ImportColumn[],
  layout: SheetLayout,
  sheetName: string,
): (number | null)[] {
  const found = new Map<string, number>();
  for (let index = 1; index <= row.cellCount; index += 1) {
    const key = normalizeKey(cellText(row.getCell(index).value));
    if (key !== '' && !found.has(key)) found.set(key, index);
  }

  return columns.map((column) => {
    const index = [column.header, ...(column.aliases ?? [])]
      .map((label) => found.get(normalizeKey(label)))
      .find((rank) => rank !== undefined);

    // Une colonne facultative absente n'est pas un classeur illisible : ses
    // cellules se lisent vides, et une cellule vide est une information qu'on
    // n'a pas.
    if (index === undefined) {
      if (!column.required) return null;
      throw new UnreadableWorkbookError(
        `Onglet « ${sheetName} » : la colonne « ${column.header} » est introuvable en ligne ${String(layout.headerRow)}.`,
      );
    }
    return index;
  });
}
