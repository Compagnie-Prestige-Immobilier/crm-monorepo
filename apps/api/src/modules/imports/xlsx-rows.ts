import { createReadStream } from 'node:fs';
import ExcelJS from 'exceljs';

import type { ImportColumn } from './import-adapter.js';
import { FIRST_DATA_ROW } from './imports.job.js';

export interface SheetRow {
  readonly rowNumber: number;
  readonly cells: Record<string, string>;
}

export interface SheetSource {
  readonly declaredDataRows: number | null;
  rows(): AsyncIterable<SheetRow>;
  close(): Promise<void>;
}

export interface ImportRowReader {
  open(storagePath: string, columns: readonly ImportColumn[]): Promise<SheetSource>;
}

export const IMPORT_ROW_READER = Symbol('IMPORT_ROW_READER');

export class UnreadableWorkbookError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'UnreadableWorkbookError';
  }
}

export function cellText(value: ExcelJS.CellValue): string {
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
  Object.values(cells).every((cell) => cell === '');

export class ExcelStreamRowReader implements ImportRowReader {
  async open(storagePath: string, columns: readonly ImportColumn[]): Promise<SheetSource> {
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

    const declared = (sheet as unknown as { dimensions?: { bottom?: number } | null }).dimensions;
    const bottom = typeof declared?.bottom === 'number' ? declared.bottom : null;
    const declaredDataRows =
      bottom !== null && bottom >= FIRST_DATA_ROW ? bottom - FIRST_DATA_ROW + 1 : null;

    return {
      declaredDataRows,
      rows: () => readRows(sheet, columns),
      close: async () => {
        file.destroy();
        await worksheets.return(undefined);
      },
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
