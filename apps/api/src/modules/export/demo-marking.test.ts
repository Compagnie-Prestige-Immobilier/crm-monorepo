import { PassThrough } from 'node:stream';

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import {
  DEMO_FILENAME_SUFFIX,
  DEMO_MODE_HEADER,
  demoFilenameSuffix,
  markWorkbook,
  setDemoHeader,
  writeDemoWarningRow,
} from './demo-marking.js';

async function roundTrip(demoEnabled: boolean): Promise<ExcelJS.Workbook> {
  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) =>
    sink.on('finish', () => {
      resolve();
    }),
  );

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: sink, useStyles: true });
  markWorkbook(workbook, demoEnabled);

  const sheet = workbook.addWorksheet('Prospects', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Nom', key: 'nom', width: 20 },
    { header: 'Téléphone', key: 'phone', width: 20 },
    { header: 'Banque', key: 'banque', width: 20 },
  ];
  writeDemoWarningRow(sheet, demoEnabled, 3);
  sheet.addRow({ nom: 'Ndiaye', phone: '+221771234567', banque: 'CBAO' }).commit();
  sheet.commit();
  await workbook.commit();
  await done;

  const read = new ExcelJS.Workbook();
  await read.xlsx.load(Buffer.concat(chunks) as unknown as Parameters<typeof read.xlsx.load>[0]);
  return read;
}

const cellText = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value ?? '');

describe('demoFilenameSuffix', () => {
  it('marque le nom de fichier, qui est la seule marque visible sans ouvrir', () => {
    expect(demoFilenameSuffix(true)).toBe(DEMO_FILENAME_SUFFIX);
    expect(demoFilenameSuffix(false)).toBe('');
  });
});

describe('setDemoHeader', () => {
  it('pose l’en-tête dans LES DEUX cas', () => {
    const seen: Record<string, string> = {};
    const response = {
      setHeader: (name: string, value: string) => {
        seen[name] = value;
      },
    } as unknown as Parameters<typeof setDemoHeader>[0];

    setDemoHeader(response, true);
    expect(seen[DEMO_MODE_HEADER]).toBe('true');

    setDemoHeader(response, false);
    expect(seen[DEMO_MODE_HEADER]).toBe('false');
  });
});

describe('classeur en mode démonstration', () => {
  it('LAISSE l’en-tête en ligne 1 : le tri et le volet figé en dépendent', async () => {
    const workbook = await roundTrip(true);
    const sheet = workbook.getWorksheet('Prospects');
    expect(sheet?.getRow(1).getCell(1).value).toBe('Nom');
  });

  it('écrit l’avertissement en ligne 2, en rouge', async () => {
    const workbook = await roundTrip(true);
    const sheet = workbook.getWorksheet('Prospects');
    const row = sheet?.getRow(2);

    expect(cellText(row?.getCell(1).value)).toContain('MODE DÉMONSTRATION');
    expect(row?.font.bold).toBe(true);
    expect(row?.font.color?.argb).toBe('FFB00020');
  });

  it('renseigne les métadonnées du classeur', async () => {
    const workbook = await roundTrip(true);
    expect(workbook.creator).toContain('démonstration');
    expect(cellText(workbook.description)).toContain('MODE DÉMONSTRATION');
  });

  it('repousse la première ligne de données en ligne 3', async () => {
    const workbook = await roundTrip(true);
    expect(workbook.getWorksheet('Prospects')?.getRow(3).getCell(1).value).toBe('Ndiaye');
  });
});

describe('classeur en mode normal', () => {
  it('ne porte AUCUNE trace de la mécanique de démonstration', async () => {
    const workbook = await roundTrip(false);
    const sheet = workbook.getWorksheet('Prospects');

    expect(sheet?.getRow(1).getCell(1).value).toBe('Nom');
    expect(sheet?.getRow(2).getCell(1).value).toBe('Ndiaye');
    expect(workbook.creator).toBe('CPI GO');
    expect(cellText(workbook.description)).not.toContain('DÉMONSTRATION');
  });
});
