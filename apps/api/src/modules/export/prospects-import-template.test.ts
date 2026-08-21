import { PassThrough } from 'node:stream';

import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AnalyticsService } from '../analytics/analytics.service.js';
import { fakeWorkspace } from '../../workspaces/fake-workspace.js';
import {
  ENROLLMENT_METHOD_TOKENS,
  PROSPECTS_IMPORT_COLUMNS,
  PROSPECTS_IMPORT_SHEET_NAME,
  PROSPECT_IMPORT_HEADERS,
} from '../imports/prospects-import-template.js';
import { ExportService } from './export.service.js';

const BANQUES = ['CBAO', 'BHS', 'BNDE'];
const SYNDICATS = ['CHUES', 'SAES', 'UDEN'];

function makeExports(banques: string[], syndicats: string[]): ExportService {
  const prisma = {
    banque: { findMany: vi.fn(() => Promise.resolve(banques.map((shortName) => ({ shortName })))) },
    syndicat: { findMany: vi.fn(() => Promise.resolve(syndicats.map((sigle) => ({ sigle })))) },
  };
  return new ExportService(
    prisma as unknown as PrismaService,
    {} as unknown as AnalyticsService,
    fakeWorkspace(),
  );
}

/** La lecture est branchée avant l'écriture : le classeur n'est jamais tamponné en entier. */
async function build(banques = BANQUES, syndicats = SYNDICATS): Promise<ExcelJS.Workbook> {
  const stream = new PassThrough();
  const workbook = new ExcelJS.Workbook();
  const reading = workbook.xlsx.read(stream);

  await makeExports(banques, syndicats).writeProspectsImportTemplate(stream);
  return reading;
}

function sheetOf(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const found = workbook.getWorksheet(name);
  if (!found) throw new Error(`Feuille « ${name} » absente du classeur.`);
  return found;
}

const rankOf = (header: string): number =>
  PROSPECTS_IMPORT_COLUMNS.findIndex((column) => column.header === header) + 1;

describe('modèle d’import des prospects', () => {
  it('porte les colonnes du modèle, dans l’ordre, et rien d’autre', async () => {
    const sheet = sheetOf(await build(), PROSPECTS_IMPORT_SHEET_NAME);

    const headers = PROSPECTS_IMPORT_COLUMNS.map(
      (_, index) => sheet.getRow(1).getCell(index + 1).value,
    );

    expect(headers).toEqual(PROSPECTS_IMPORT_COLUMNS.map((column) => column.header));
    expect(sheet.getRow(1).getCell(PROSPECTS_IMPORT_COLUMNS.length + 1).value).toBeNull();
  });

  // Sans la ligne d'exemple, la saisie commencerait en ligne 2, que le lecteur saute.
  it('réserve la ligne 2 à l’exemple', async () => {
    const sheet = sheetOf(await build(), PROSPECTS_IMPORT_SHEET_NAME);

    expect(sheet.getRow(2).getCell(rankOf(PROSPECT_IMPORT_HEADERS.nom)).value).toBe(
      PROSPECTS_IMPORT_COLUMNS[0]?.sample,
    );
  });

  it('tire les listes des référentiels vivants, dans une feuille masquée', async () => {
    const lists = sheetOf(await build(), 'Listes');

    expect(lists.state).toBe('veryHidden');
    expect(lists.getColumn(1).values.slice(1)).toEqual(['Banques', ...BANQUES]);
    expect(lists.getColumn(2).values.slice(1)).toEqual(['Syndicats', ...SYNDICATS]);
    expect(lists.getColumn(3).values.slice(1)).toEqual([
      'Méthodes d’enrôlement',
      ...ENROLLMENT_METHOD_TOKENS,
    ]);
  });

  // Banque et Syndicat croisés sont le segment BDD : en texte libre, une variante
  // saisie à la main découpe une population unique en plusieurs segments.
  it.each([
    [PROSPECT_IMPORT_HEADERS.banque, 'A', BANQUES.length],
    [PROSPECT_IMPORT_HEADERS.syndicat, 'B', SYNDICATS.length],
    [PROSPECT_IMPORT_HEADERS.enrollmentMethod, 'C', ENROLLMENT_METHOD_TOKENS.length],
  ])('%s est une liste déroulante, pas du texte libre', async (header, letter, count) => {
    const sheet = sheetOf(await build(), PROSPECTS_IMPORT_SHEET_NAME);
    const column = rankOf(header);

    // `toMatchObject` : exceljs déclare `dataValidation` non nullable alors
    // qu'une cellule sans liste n'en porte aucune.
    expect(sheet.getCell(3, column).dataValidation).toMatchObject({
      type: 'list',
      formulae: [`Listes!$${letter}$2:$${letter}$${String(count + 1)}`],
    });
    expect(sheet.getCell(1_000, column).dataValidation).toMatchObject({ type: 'list' });
  });

  it('laisse les colonnes libres sans validation', async () => {
    const sheet = sheetOf(await build(), PROSPECTS_IMPORT_SHEET_NAME);

    expect(sheet.getCell(3, rankOf(PROSPECT_IMPORT_HEADERS.nom)).dataValidation).toBeUndefined();
    expect(sheet.getCell(3, rankOf(PROSPECT_IMPORT_HEADERS.phone)).dataValidation).toBeUndefined();
  });

  // `$A$2:$A$1` ferait ouvrir le fichier comme un classeur endommagé.
  it('n’écrit pas de plage à l’envers quand un référentiel est vide', async () => {
    const sheet = sheetOf(await build([], SYNDICATS), PROSPECTS_IMPORT_SHEET_NAME);

    expect(sheet.getCell(3, rankOf(PROSPECT_IMPORT_HEADERS.banque)).dataValidation).toBeUndefined();
    expect(sheet.getCell(3, rankOf(PROSPECT_IMPORT_HEADERS.syndicat)).dataValidation).toMatchObject(
      { type: 'list' },
    );
  });

  it('explique chaque colonne dans l’onglet Instructions', async () => {
    const help = sheetOf(await build(), 'Instructions');

    const explained = new Set<unknown>();
    help.eachRow((row) => explained.add(row.getCell(1).value));

    for (const column of PROSPECTS_IMPORT_COLUMNS) {
      expect(explained, `colonne ${column.header} non expliquée`).toContain(column.header);
    }
  });

  it('ne propose aucun référentiel désactivé', async () => {
    const prisma = {
      banque: { findMany: vi.fn(() => Promise.resolve([])) },
      syndicat: { findMany: vi.fn(() => Promise.resolve([])) },
    };
    const exports = new ExportService(
      prisma as unknown as PrismaService,
      {} as unknown as AnalyticsService,
      fakeWorkspace(),
    );

    const stream = new PassThrough();
    stream.resume();
    await exports.writeProspectsImportTemplate(stream);

    for (const call of [prisma.banque.findMany, prisma.syndicat.findMany]) {
      expect(call).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
    }
  });
});
