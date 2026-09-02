import { PassThrough } from 'node:stream';

import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AnalyticsService } from '../analytics/analytics.service.js';
import { fakeWorkspace } from '../../workspaces/fake-workspace.js';
import {
  FONCTIONNAIRE_CHOICES,
  GRAND_PUBLIC_IMPORT_COLUMNS,
  GRAND_PUBLIC_IMPORT_HEADERS,
  GRAND_PUBLIC_SHEET_NAME,
  MODE_EPARGNE_CHOICES,
  TYPE_CONTRAT_CHOICES,
} from '../imports/prospects-grand-public-template.js';
import { ExportService } from './export.service.js';
import { COLUMNS_BY_POSITION_RULE } from './import-template.workbook.js';

const BANQUES = ['CBAO', 'BHS'];
const SYNDICATS = ['CHUES', 'SAES'];
const CANAUX = ['TikTok', 'Bouche à oreille', 'Parrainage'];
const EMPLOYEURS = ['Ministère de l’Éducation nationale', 'Sonatel'];
const PAYS = ['Italie', 'France'];

const H = GRAND_PUBLIC_IMPORT_HEADERS;

function makeExports(canaux = CANAUX): { exports: ExportService; prisma: FakePrisma } {
  const prisma = {
    banque: { findMany: vi.fn(() => Promise.resolve(BANQUES.map((shortName) => ({ shortName })))) },
    syndicat: { findMany: vi.fn(() => Promise.resolve(SYNDICATS.map((sigle) => ({ sigle })))) },
    canalProvenance: { findMany: vi.fn(() => Promise.resolve(canaux.map((label) => ({ label })))) },
    employeur: { findMany: () => Promise.resolve(EMPLOYEURS.map((label) => ({ label }))) },
    pays: { findMany: () => Promise.resolve(PAYS.map((label) => ({ label }))) },
  };
  return {
    exports: new ExportService(
      prisma as unknown as PrismaService,
      {} as unknown as AnalyticsService,
      fakeWorkspace(),
    ),
    prisma,
  };
}

interface FakePrisma {
  banque: { findMany: ReturnType<typeof vi.fn> };
  syndicat: { findMany: ReturnType<typeof vi.fn> };
  canalProvenance: { findMany: ReturnType<typeof vi.fn> };
  employeur: { findMany: () => Promise<{ label: string }[]> };
  pays: { findMany: () => Promise<{ label: string }[]> };
}

async function build(canaux = CANAUX): Promise<ExcelJS.Workbook> {
  const stream = new PassThrough();
  const workbook = new ExcelJS.Workbook();
  const reading = workbook.xlsx.read(stream);

  await makeExports(canaux).exports.writeProspectsGrandPublicImportTemplate(stream);
  return reading;
}

function sheetOf(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const found = workbook.getWorksheet(name);
  if (!found) throw new Error(`Feuille « ${name} » absente du classeur.`);
  return found;
}

const rankOf = (header: string): number =>
  GRAND_PUBLIC_IMPORT_COLUMNS.findIndex((column) => column.header === header) + 1;

describe('modèle d’import des prospects Grand Public', () => {
  it('porte les colonnes du métier, dans l’ordre, et rien d’autre', async () => {
    const sheet = sheetOf(await build(), GRAND_PUBLIC_SHEET_NAME);

    const headers = GRAND_PUBLIC_IMPORT_COLUMNS.map(
      (_, index) => sheet.getRow(1).getCell(index + 1).value,
    );

    expect(headers).toEqual(GRAND_PUBLIC_IMPORT_COLUMNS.map((column) => column.header));
    expect(sheet.getRow(1).getCell(GRAND_PUBLIC_IMPORT_COLUMNS.length + 1).value).toBeNull();
  });

  it.each([
    [H.syndicat, 'A', SYNDICATS.length],
    [H.banque, 'B', BANQUES.length],
    [H.fonctionnaire, 'C', FONCTIONNAIRE_CHOICES.length],
    [H.canal, 'D', CANAUX.length],
    [H.employeur, 'E', EMPLOYEURS.length],
    [H.typeContrat, 'F', TYPE_CONTRAT_CHOICES.length],
    [H.modeEpargne, 'G', MODE_EPARGNE_CHOICES.length],
    [H.paysResidence, 'H', PAYS.length],
  ])('%s se choisit dans une liste, il ne se tape pas', async (header, letter, count) => {
    const sheet = sheetOf(await build(), GRAND_PUBLIC_SHEET_NAME);

    expect(sheet.getCell(3, rankOf(header)).dataValidation).toMatchObject({
      type: 'list',
      formulae: [`Listes!$${letter}$2:$${letter}$${String(count + 1)}`],
    });
  });

  it('tire les canaux du référentiel VIVANT, sans jamais proposer un canal éteint', async () => {
    const { exports, prisma } = makeExports();
    const stream = new PassThrough();
    stream.resume();
    await exports.writeProspectsGrandPublicImportTemplate(stream);

    expect(prisma.canalProvenance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );

    const lists = sheetOf(await build(), 'Listes');
    expect(lists.getColumn(4).values.slice(1)).toEqual(['Canaux de provenance', ...CANAUX]);
  });

  it('n’écrit pas de plage à l’envers quand aucun canal n’est actif', async () => {
    const sheet = sheetOf(await build([]), GRAND_PUBLIC_SHEET_NAME);

    expect(sheet.getCell(3, rankOf(H.canal)).dataValidation).toBeUndefined();
    expect(sheet.getCell(3, rankOf(H.banque)).dataValidation).toMatchObject({ type: 'list' });
  });

  it('laisse le nom, le téléphone et la profession en texte libre', async () => {
    const sheet = sheetOf(await build(), GRAND_PUBLIC_SHEET_NAME);

    for (const header of [H.nom, H.phone, H.profession]) {
      expect(sheet.getCell(3, rankOf(header)).dataValidation, header).toBeUndefined();
    }
  });

  // Les colonnes sont retrouvées par leur en-tête : promettre l'inverse ferait
  // renoncer à retirer une colonne facultative dont on n'a pas la donnée.
  it('annonce la lecture par en-tête, et jamais la lecture par position', async () => {
    const help = sheetOf(await build(), 'Instructions');

    const lignes: unknown[] = [];
    help.eachRow((row) => lignes.push(row.getCell(3).value));

    expect(lignes).not.toContain(COLUMNS_BY_POSITION_RULE);
    expect(lignes.some((ligne) => typeof ligne === 'string' && ligne.includes('TEXTE'))).toBe(true);
  });

  it('dit dans les Instructions que seuls le nom et le téléphone sont exigés', async () => {
    const help = sheetOf(await build(), 'Instructions');

    const obligatoires = new Map<unknown, unknown>();
    help.eachRow((row) => obligatoires.set(row.getCell(1).value, row.getCell(2).value));

    expect(obligatoires.get(H.nom)).toBe('Oui');
    expect(obligatoires.get(H.phone)).toBe('Oui');
    for (const header of [H.prenom, H.profession, H.syndicat, H.banque, H.canal]) {
      expect(obligatoires.get(header), header).toBe('Non');
    }
  });

  it('explique comment « Fonctionnaire » et le type se composent', async () => {
    const help = sheetOf(await build(), 'Instructions');

    const aide = new Map<unknown, unknown>();
    help.eachRow((row) => aide.set(row.getCell(1).value, row.getCell(3).value));

    expect(String(aide.get(H.fonctionnaire))).toMatch(/FONCTIONNAIRE/);
    expect(String(aide.get(H.fonctionnaire))).toMatch(/type reste vide/);
  });
});
