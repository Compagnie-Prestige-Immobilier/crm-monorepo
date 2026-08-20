import { PassThrough } from 'node:stream';

import ExcelJS from 'exceljs';
import { Prisma } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BankCasesExportService } from './bank-cases-export.service.js';
import type { BankCaseAnalyticsService } from './bank-cases-analytics.service.js';
import type { BankCaseFilterDto } from './dto.js';
import {
  AGENT,
  AGENT_BIS,
  FakePrisma,
  REASON_INCOMPLET,
  STAGE_A_TRAITER,
  STAGE_ENCAISSE,
  STAGE_EN_TRAITEMENT,
} from './fake-prisma.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

class ExportFakePrisma extends FakePrisma {
  lastAfter: string | undefined;

  filterPredicate: (row: { id: string }) => boolean = () => true;

  override $queryRaw(...args: unknown[]): Promise<never[]> {
    void args;
    const ids = this.cases
      .filter((row) => row.deletedAt === null)
      .filter((row) => this.filterPredicate(row))
      .map((row) => ({ id: row.id }))
      .sort((left, right) => left.id.localeCompare(right.id));
    return Promise.resolve(ids as unknown as never[]);
  }
}

const stubAnalytics = (): BankCaseAnalyticsService =>
  ({
    totals: vi.fn().mockResolvedValue({
      total: 3,
      aTraiter: 1,
      enTraitement: 1,
      encaisses: 1,
      rejetes: 0,
      totalAmountCashed: '1200000',
      rejectionRate: 0,
      meanDelayHours: 12.5,
    }),
    byStage: vi.fn().mockResolvedValue([
      {
        stageId: STAGE_A_TRAITER.id,
        code: 'A_TRAITER',
        label: 'À traiter',
        color: 'info',
        type: 'OPEN',
        cases: 1,
        share: 33.3,
      },
      {
        stageId: STAGE_ENCAISSE.id,
        code: 'ENCAISSE',
        label: 'Encaissé',
        color: 'success',
        type: 'CASHED',
        cases: 1,
        share: 33.3,
      },
    ]),
    byBank: vi.fn().mockResolvedValue([
      {
        banqueId: 'bnq-cbao',
        label: 'CBAO',
        cases: 2,
        cashed: 1,
        rejected: 0,
        amountXof: '1200000',
        share: 66.7,
        meanProcessingHours: 12.5,
      },
      {
        banqueId: 'bnq-bhs',
        label: 'BHS',
        cases: 1,
        cashed: 0,
        rejected: 0,
        amountXof: '0',
        share: 33.3,
        meanProcessingHours: null,
      },
    ]),
    byRejectionReason: vi.fn().mockResolvedValue([]),
  }) as unknown as BankCaseAnalyticsService;

let db: ExportFakePrisma;

beforeEach(() => {
  db = new ExportFakePrisma();

  db.addCase({
    id: 'case-001',
    reference: 'BNK 2026-001',
    referenceKey: 'BNK 2026-001',
    customerName: 'Awa Diop',
    customerPhoneE164: '+221771234567',
    currentStageId: STAGE_A_TRAITER.id,
  });
  db.addCase({
    id: 'case-002',
    reference: 'BNK 2026-002',
    referenceKey: 'BNK 2026-002',
    customerName: 'Modou Sarr',
    customerPhoneE164: '+221770000002',
    processingBankId: 'bnq-bhs',
    currentStageId: STAGE_EN_TRAITEMENT.id,
    updatedById: AGENT_BIS.id,
  });
  db.addCase({
    id: 'case-003',
    reference: 'BNK 2026-003',
    referenceKey: 'BNK 2026-003',
    customerName: 'Fatou Ba',
    customerPhoneE164: '+221770000003',
    currentStageId: STAGE_ENCAISSE.id,
    amountXof: new Prisma.Decimal('1200000'),
    updatedById: AGENT.id,
  });

  db.transitions.push(
    {
      id: 'trs-1',
      caseId: 'case-003',
      fromStageId: null,
      toStageId: STAGE_A_TRAITER.id,
      performedById: AGENT.id,
      amountXof: null,
      rejectionReasonId: null,
      rejectionDetail: null,
      comment: null,
      correctionReason: null,
      createdAt: new Date('2026-08-01T09:00:00.000Z'),
    },
    {
      id: 'trs-2',
      caseId: 'case-003',
      fromStageId: STAGE_A_TRAITER.id,
      toStageId: STAGE_ENCAISSE.id,
      performedById: AGENT.id,
      amountXof: new Prisma.Decimal('1200000'),
      rejectionReasonId: null,
      rejectionDetail: null,
      comment: 'Virement reçu',
      correctionReason: null,
      createdAt: new Date('2026-08-02T09:00:00.000Z'),
    },
    {
      id: 'trs-3',
      caseId: 'case-001',
      fromStageId: STAGE_A_TRAITER.id,
      toStageId: STAGE_A_TRAITER.id,
      performedById: AGENT.id,
      amountXof: null,
      rejectionReasonId: REASON_INCOMPLET.id,
      rejectionDetail: null,
      comment: null,
      correctionReason: 'Correction du montant saisi',
      createdAt: new Date('2026-08-03T09:00:00.000Z'),
    },
  );
});

async function build(
  filter: BankCaseFilterDto = {},
  predicate?: (row: { id: string }) => boolean,
): Promise<ExcelJS.Workbook> {
  if (predicate) db.filterPredicate = predicate;
  const service = new BankCasesExportService(db.asService(), stubAnalytics(), fakeDemoVisibility());

  const stream = new PassThrough();
  const workbook = new ExcelJS.Workbook();
  const reading = workbook.xlsx.read(stream);
  await service.write(filter, stream);
  return reading;
}

function sheetOf(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const found = workbook.getWorksheet(name);
  if (!found) throw new Error(`Feuille « ${name} » absente du classeur.`);
  return found;
}

const text = (value: ExcelJS.CellValue): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

function column(sheet: ExcelJS.Worksheet, header: string): string[] {
  const headers = sheet.getRow(1).values as ExcelJS.CellValue[];
  const index = headers.findIndex((value) => text(value) === header);
  if (index < 1) throw new Error(`Colonne « ${header} » absente de « ${sheet.name} ».`);

  const values: string[] = [];
  sheet.eachRow((row, number) => {
    if (number > 1) values.push(text(row.getCell(index).value));
  });
  return values;
}

describe('structure du classeur', () => {
  it('contient EXACTEMENT les trois feuilles Dossiers, Historique et Synthèse', async () => {
    const workbook = await build();
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Dossiers',
      'Historique',
      'Synthèse',
    ]);
  });

  it('fige l’en-tête et pose l’autofiltre sur les deux feuilles de données', async () => {
    const workbook = await build();
    for (const name of ['Dossiers', 'Historique']) {
      const sheet = sheetOf(workbook, name);
      expect(sheet.views[0]?.state).toBe('frozen');
      expect(sheet.autoFilter).toBeTruthy();
      expect(sheet.getRow(1).font.bold).toBe(true);
      expect(sheet.getRow(1).fill).toMatchObject({ fgColor: { argb: 'FF630210' } });
    }
  });
});

describe('feuille Dossiers', () => {
  it('écrit une ligne par dossier, avec les libellés résolus', async () => {
    const sheet = sheetOf(await build(), 'Dossiers');

    expect(column(sheet, 'Référence')).toEqual(['BNK 2026-001', 'BNK 2026-002', 'BNK 2026-003']);
    expect(column(sheet, 'Client')).toEqual(['Awa Diop', 'Modou Sarr', 'Fatou Ba']);
    expect(column(sheet, 'Étape')).toEqual(['À traiter', 'En traitement banque', 'Encaissé']);
    expect(column(sheet, 'Banque de traitement')).toEqual([
      'Compagnie Bancaire de l’Afrique Occidentale',
      'Banque de l’Habitat du Sénégal',
      'Compagnie Bancaire de l’Afrique Occidentale',
    ]);
    expect(column(sheet, 'Créé par')).toEqual(['Fatou Ndiaye', 'Fatou Ndiaye', 'Fatou Ndiaye']);
    expect(column(sheet, 'Dernier agent')).toEqual(['', 'Ibrahima Fall', 'Fatou Ndiaye']);
  });

  it('écrit le montant en cellule numérique, avec le format FCFA', async () => {
    const sheet = sheetOf(await build(), 'Dossiers');
    const headers = sheet.getRow(1).values as ExcelJS.CellValue[];
    const index = headers.findIndex((value) => text(value) === 'Montant');

    expect(sheet.getRow(4).getCell(index).value).toBe(1200000);
    expect(sheet.getColumn(index).style.numFmt).toBe('#,##0" FCFA"');
    expect(sheet.getRow(2).getCell(index).value).toBeNull();
  });

  it('écrit les dates en cellules date, pas en texte', async () => {
    const sheet = sheetOf(await build(), 'Dossiers');
    const headers = sheet.getRow(1).values as ExcelJS.CellValue[];
    const index = headers.findIndex((value) => text(value) === 'Créé le');

    expect(sheet.getRow(2).getCell(index).value).toBeInstanceOf(Date);
    expect(sheet.getColumn(index).style.numFmt).toBe('dd/mm/yyyy hh:mm');
  });
});

describe('feuille Historique', () => {
  it('reprend toutes les transitions des dossiers exportés', async () => {
    const sheet = sheetOf(await build(), 'Historique');

    expect(column(sheet, 'Référence')).toEqual(['BNK 2026-001', 'BNK 2026-003', 'BNK 2026-003']);
    expect(column(sheet, 'Étape source')).toEqual(['À traiter', 'Ouverture', 'À traiter']);
    expect(column(sheet, 'Commentaire')).toEqual(['', '', 'Virement reçu']);
  });

  it('expose la justification des corrections dans sa propre colonne', async () => {
    const sheet = sheetOf(await build(), 'Historique');
    expect(column(sheet, 'Justification de correction')).toEqual([
      'Correction du montant saisi',
      '',
      '',
    ]);
  });
});

describe('feuille Synthèse', () => {
  it('reprend les agrégats du tableau de bord et le décompte réellement exporté', async () => {
    const sheet = sheetOf(await build(), 'Synthèse');
    const libelles = column(sheet, 'Indicateur');
    const valeurs = column(sheet, 'Valeur');
    const at = (libelle: string): string => valeurs[libelles.indexOf(libelle)] ?? '';

    expect(at('Dossiers exportés')).toBe('3');
    expect(at('Dossiers (total filtré)')).toBe('3');
    expect(at('Encaissés')).toBe('1');
    expect(at('Montant encaissé')).toBe('1200000');
    expect(at('Délai moyen de traitement (h)')).toBe('12.5');

    for (const section of [
      'Vue d’ensemble',
      'Par étape',
      'Par banque de traitement',
      'Montant encaissé par banque',
      'Par motif de rejet',
    ]) {
      expect(libelles).toContain(section);
    }
    expect(libelles).toContain('Aucun rejet');
  });

  it('un délai moyen indisponible s’écrit « n/d » et non zéro', async () => {
    const analytics = stubAnalytics();
    vi.spyOn(analytics, 'totals').mockResolvedValue({
      total: 0,
      aTraiter: 0,
      enTraitement: 0,
      encaisses: 0,
      rejetes: 0,
      totalAmountCashed: '0',
      rejectionRate: 0,
      meanDelayHours: null,
    });
    const service = new BankCasesExportService(db.asService(), analytics, fakeDemoVisibility());

    const stream = new PassThrough();
    const workbook = new ExcelJS.Workbook();
    const reading = workbook.xlsx.read(stream);
    await service.write({}, stream);
    const sheet = sheetOf(await reading, 'Synthèse');

    const libelles = column(sheet, 'Indicateur');
    const valeurs = column(sheet, 'Valeur');
    expect(valeurs[libelles.indexOf('Délai moyen de traitement (h)')]).toBe('n/d');
  });
});

describe('filtrage', () => {
  it('fige le mode démonstration pour les lignes et la synthèse', async () => {
    const analytics = stubAnalytics();
    const totals = vi.spyOn(analytics, 'totals');
    const byStage = vi.spyOn(analytics, 'byStage');
    const byBank = vi.spyOn(analytics, 'byBank');
    const byRejectionReason = vi.spyOn(analytics, 'byRejectionReason');
    const enabled = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const service = new BankCasesExportService(db.asService(), analytics, {
      enabled,
    } as never);

    const stream = new PassThrough();
    const workbook = new ExcelJS.Workbook();
    const reading = workbook.xlsx.read(stream);
    await service.write({}, stream);
    await reading;

    expect(enabled).toHaveBeenCalledTimes(1);
    expect(totals).toHaveBeenCalledWith({}, false);
    expect(byStage).toHaveBeenCalledWith({}, false);
    expect(byBank).toHaveBeenCalledWith({}, false);
    expect(byRejectionReason).toHaveBeenCalledWith({}, false);
  });

  it('n’exporte QUE les dossiers retenus par le filtre, historique compris', async () => {
    const workbook = await build({ banqueId: 'bnq-bhs' }, (row) => row.id === 'case-002');

    expect(column(sheetOf(workbook, 'Dossiers'), 'Référence')).toEqual(['BNK 2026-002']);
    expect(column(sheetOf(workbook, 'Historique'), 'Référence')).toEqual([]);
  });

  it('un filtre qui ne retient rien produit tout de même les trois feuilles', async () => {
    const workbook = await build({ search: 'introuvable' }, () => false);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Dossiers',
      'Historique',
      'Synthèse',
    ]);
    expect(column(sheetOf(workbook, 'Dossiers'), 'Référence')).toEqual([]);
  });
});
