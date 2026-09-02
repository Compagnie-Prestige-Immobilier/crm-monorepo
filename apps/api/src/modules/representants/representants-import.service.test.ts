import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import ExcelJS from 'exceljs';
import { Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { IMPORT_COLUMNS } from './import-template.js';
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  RepresentantsImportService,
  normalizeKey,
} from './representants-import.service.js';

type MockFn = ReturnType<typeof vi.fn>;

const ADMIN: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Admin CPI',
  role: Role.ADMIN,
};

const DEPARTEMENTS = [
  { id: 'dep-dakar', name: 'Dakar', code: 'DK' },
  { id: 'dep-sl', name: 'Saint-Louis', code: 'SL' },
];

const IEFS = [
  { id: 'ief-alm', name: 'Almadies', code: 'ALM', departementId: 'dep-dakar' },
  { id: 'ief-sl', name: 'Saint-Louis Ville', code: 'SLV', departementId: 'dep-sl' },
];

const USERS = [
  { id: 'user-khadim', username: 'khadim', email: 'khadim@cpi.sn', fullName: 'Khadim Diop' },
];

interface MockDb {
  representant: Record<'findMany' | 'createMany' | 'update', MockFn>;
  repCallAttempt: Record<'createMany', MockFn>;
  departement: Record<'findMany', MockFn>;
  ief: Record<'findMany', MockFn>;
  user: Record<'findMany', MockFn>;
  $transaction: MockFn;
}

function prismaStub(): MockDb {
  const db: MockDb = {
    representant: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    repCallAttempt: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    departement: { findMany: vi.fn().mockResolvedValue(DEPARTEMENTS) },
    ief: { findMany: vi.fn().mockResolvedValue(IEFS) },
    user: { findMany: vi.fn().mockResolvedValue(USERS) },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((run: (tx: MockDb) => Promise<unknown>) => run(db));
  db.representant.createMany.mockImplementation((args: { data: unknown[] }) =>
    Promise.resolve({ count: args.data.length }),
  );
  return db;
}

async function workbookOf(rows: readonly (readonly string[])[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Représentants');
  sheet.addRow(IMPORT_COLUMNS.map((column) => column.header));
  sheet.addRow(IMPORT_COLUMNS.map((column) => column.sample));
  for (const row of rows) sheet.addRow([...row]);
  const written = await workbook.xlsx.writeBuffer();
  return Buffer.from(written);
}

const requestWith = (buffer: Buffer, truncated = false): FastifyRequest =>
  ({
    file: () =>
      Promise.resolve({
        toBuffer: () => Promise.resolve(buffer),
        file: { truncated },
      }),
  }) as unknown as FastifyRequest;

let db: MockDb;
let service: RepresentantsImportService;

beforeEach(() => {
  db = prismaStub();
  service = new RepresentantsImportService(db as unknown as PrismaService);
});

describe('normalizeKey', () => {
  it('rapproche les orthographes qu’un fichier rempli à la main produit', () => {
    const expected = normalizeKey('Saint-Louis');
    for (const variant of ['SAINT-LOUIS', 'saint louis', 'Saint  Louis', 'Sáint-Loüis']) {
      expect(normalizeKey(variant)).toBe(expected);
    }
  });
});

describe('import : simulation', () => {
  it('N’ÉCRIT RIEN par défaut, même sur un fichier parfait', async () => {
    const file = await workbookOf([['Fatou Ndiaye', '77 123 45 67', 'Dakar', '', '']]);

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.dryRun).toBe(true);
    expect(report.valid).toBe(1);
    expect(report.created).toBe(0);
    expect(db.representant.createMany).not.toHaveBeenCalled();
  });

  it('NORMALISE le téléphone et rend la ligne prête à écrire', async () => {
    const file = await workbookOf([['Fatou Ndiaye', '00221 77 123 45 67', 'DK', 'ALM', 'Notes']]);

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.preview[0]).toMatchObject({
      line: 3,
      fullName: 'Fatou Ndiaye',
      phoneE164: '+221771234567',
      departementName: 'Dakar',
      iefName: 'Almadies',
      notes: 'Notes',
    });
  });

  it('porte l’établissement jusqu’à la ligne écrite', async () => {
    const file = await workbookOf([
      ['Fatou Ndiaye', '77 123 45 67', 'Dakar', '', '', 'Lycée Blaise Diagne'],
    ]);

    const report = await service.import(ADMIN, requestWith(file), { dryRun: false });

    expect(report.preview[0]).toMatchObject({ etablissement: 'Lycée Blaise Diagne' });
    expect(db.representant.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ etablissement: 'Lycée Blaise Diagne' })],
      }),
    );
  });

  it('rattache la fiche à son chargé de compte et enregistre l’appel déjà passé', async () => {
    const file = await workbookOf([
      [
        'Fatou Ndiaye',
        '77 123 45 67',
        'Dakar',
        '',
        'Injoignable',
        'Lycée Blaise Diagne',
        'Ambassadeur',
        'Même numéro',
        'khadim',
        '18/08/2026',
        'Injoignable',
      ],
    ]);
    // La relecture des fiches écrites doit rendre les identifiants que
    // `createMany` vient de recevoir : c'est elle qui décide à quelles fiches
    // les appels se rattachent.
    db.representant.createMany.mockImplementation((args: { data: { id: string }[] }) => {
      db.representant.findMany.mockResolvedValue(args.data.map((row) => ({ id: row.id })));
      return Promise.resolve({ count: args.data.length });
    });

    await service.import(ADMIN, requestWith(file), { dryRun: false });

    expect(db.representant.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            relationStatus: 'AMBASSADEUR',
            whatsappStatus: 'MEME_NUMERO',
            etablissement: 'Lycée Blaise Diagne',
            createdById: 'user-khadim',
          }),
        ],
      }),
    );
    expect(db.repCallAttempt.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          performedById: 'user-khadim',
          outcome: 'UNREACHABLE',
          clientCreatedAt: new Date(Date.UTC(2026, 7, 18)),
        }),
      ],
    });
  });

  it('complète une fiche existante SANS écraser ce qui a déjà été tranché', async () => {
    const file = await workbookOf([
      [
        'Fatou Ndiaye',
        '77 123 45 67',
        'Dakar',
        '',
        'Note du répertoire',
        'Lycée Blaise Diagne',
        'Refus',
        'Aucun',
        '',
        '18/08/2026',
        'Injoignable',
      ],
    ]);
    // La fiche a DÉJÀ été qualifiée ambassadeur et porte une note : seuls
    // l'établissement, le WhatsApp et l'appel manquent.
    db.representant.findMany.mockResolvedValue([
      {
        id: 'rep-1',
        phoneE164: '+221771234567',
        etablissement: null,
        notes: 'Qualifié en tournée',
        relationStatus: 'AMBASSADEUR',
        whatsappStatus: 'NON_DEMANDE',
        _count: { repCallAttempts: 0 },
      },
    ]);

    const report = await service.import(ADMIN, requestWith(file), {
      dryRun: false,
      enrichir: true,
    });

    expect(report.enrichable).toBe(1);
    expect(report.enriched).toBe(1);
    expect(db.representant.update).toHaveBeenCalledWith({
      where: { id: 'rep-1' },
      data: { etablissement: 'Lycée Blaise Diagne', whatsappStatus: 'AUCUN' },
    });
    expect(db.repCallAttempt.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ representantId: 'rep-1', outcome: 'UNREACHABLE' })],
    });
  });

  it('n’enrichit RIEN sans le drapeau : le doublon reste un refus', async () => {
    const file = await workbookOf([
      ['Fatou Ndiaye', '77 123 45 67', 'Dakar', '', '', 'Lycée Blaise Diagne'],
    ]);
    db.representant.findMany.mockResolvedValue([
      {
        id: 'rep-1',
        phoneE164: '+221771234567',
        etablissement: null,
        notes: null,
        relationStatus: 'INCONNU',
        whatsappStatus: 'NON_DEMANDE',
        _count: { repCallAttempts: 0 },
      },
    ]);

    const report = await service.import(ADMIN, requestWith(file), { dryRun: false });

    expect(report.enriched).toBe(0);
    expect(db.representant.update).not.toHaveBeenCalled();
    expect(report.errors[0]).toMatchObject({ code: 'DUPLICATE_IN_DATABASE' });
  });

  it('REFUSE « Autre » sans note, comme la contrainte de la base', async () => {
    const file = await workbookOf([
      ['Fatou Ndiaye', '77 123 45 67', 'Dakar', '', '', '', '', '', '', '18/08/2026', 'Autre'],
    ]);

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.valid).toBe(0);
    expect(report.errors[0]).toMatchObject({ code: 'CALL_COMMENT_REQUIRED' });
  });

  it('porte la note du fichier sur l’appel : la base l’exige sur « Autre »', async () => {
    const file = await workbookOf([
      [
        'Fatou Ndiaye',
        '77 123 45 67',
        'Dakar',
        '',
        'à rappeler',
        '',
        '',
        '',
        '',
        '18/08/2026',
        'Autre',
      ],
    ]);
    db.representant.createMany.mockImplementation((args: { data: { id: string }[] }) => {
      db.representant.findMany.mockResolvedValue(args.data.map((row) => ({ id: row.id })));
      return Promise.resolve({ count: args.data.length });
    });

    await service.import(ADMIN, requestWith(file), { dryRun: false });

    expect(db.repCallAttempt.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ outcome: 'OTHER', comment: 'à rappeler' })],
    });
  });

  it('REFUSE une issue d’appel sans date : elle ne s’enregistrerait nulle part', async () => {
    const file = await workbookOf([
      ['Fatou Ndiaye', '77 123 45 67', 'Dakar', '', '', '', '', '', '', '', 'Injoignable'],
    ]);

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.valid).toBe(0);
    expect(report.errors[0]).toMatchObject({ code: 'CALL_DATE_MISSING' });
  });

  it('numérote les erreurs sur la ligne DU FICHIER, en-tête compris', async () => {
    const file = await workbookOf([
      ['Fatou Ndiaye', '77 123 45 67', 'Dakar', '', ''],
      ['Moussa Sarr', 'pas-un-numero', 'Dakar', '', ''],
    ]);

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toMatchObject({ line: 4, code: 'PHONE_INVALID' });
  });

  it('rejette un nom trop court, un département inconnu, une IEF inconnue', async () => {
    const file = await workbookOf([
      ['X', '+221771000001', 'Dakar', '', ''],
      ['Moussa Sarr', '+221771000002', 'Kaolack', '', ''],
      ['Awa Fall', '+221771000003', 'Dakar', 'IEF Inexistante', ''],
    ]);

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.errors.map((error) => error.code)).toEqual([
      'NAME_INVALID',
      'DEPARTEMENT_UNKNOWN',
      'IEF_UNKNOWN',
    ]);
    expect(report.valid).toBe(0);
  });

  it('SIGNALE une IEF qui n’appartient pas au département déclaré', async () => {
    const file = await workbookOf([
      ['Fatou Ndiaye', '+221771000001', 'Dakar', 'Saint-Louis Ville', ''],
    ]);

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.errors[0]?.code).toBe('IEF_DEPARTEMENT_MISMATCH');
  });

  it('détecte les doublons DANS LE FICHIER, sur la forme normalisée', async () => {
    const file = await workbookOf([
      ['Fatou Ndiaye', '77 123 45 67', 'Dakar', '', ''],
      ['Fatou N. Ndiaye', '+221771234567', 'Dakar', '', ''],
    ]);

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.valid).toBe(1);
    expect(report.duplicates).toBe(1);
    expect(report.errors[0]).toMatchObject({ line: 4, code: 'DUPLICATE_IN_FILE' });
  });

  it('détecte les doublons CONTRE LA BASE, en une seule requête', async () => {
    db.representant.findMany.mockResolvedValue([{ phoneE164: '+221771234567' }]);
    const file = await workbookOf([
      ['Fatou Ndiaye', '77 123 45 67', 'Dakar', '', ''],
      ['Moussa Sarr', '77 123 45 68', 'Dakar', '', ''],
    ]);

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.valid).toBe(1);
    expect(report.duplicates).toBe(1);
    expect(report.errors[0]?.code).toBe('DUPLICATE_IN_DATABASE');
    expect(db.representant.findMany).toHaveBeenCalledTimes(1);
  });

  it('cherche les doublons SANS portée de démonstration : l’unicité est globale', async () => {
    const file = await workbookOf([['Fatou Ndiaye', '+221771000001', 'Dakar', '', '']]);
    await service.import(ADMIN, requestWith(file), {});

    const args = (
      db.representant.findMany.mock.calls[0] as [{ where: Record<string, unknown> }]
    )[0];
    expect(args.where).toEqual({ phoneE164: { in: ['+221771000001'] }, deletedAt: null });
  });

  it('IGNORE les lignes vides au lieu de les compter en erreur', async () => {
    const file = await workbookOf([
      ['Fatou Ndiaye', '+221771000001', 'Dakar', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
    ]);

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.totalRows).toBe(1);
    expect(report.rejected).toBe(0);
  });
});

describe('import : application', () => {
  it('écrit les lignes retenues dans UNE SEULE transaction', async () => {
    const file = await workbookOf([
      ['Fatou Ndiaye', '+221771000001', 'Dakar', 'Almadies', ''],
      ['Moussa Sarr', 'pas-un-numero', 'Dakar', '', ''],
      ['Awa Fall', '+221771000003', 'Saint-Louis', '', 'Rappeler'],
    ]);

    const report = await service.import(ADMIN, requestWith(file), { dryRun: false });

    expect(report.dryRun).toBe(false);
    expect(report.created).toBe(2);
    expect(db.$transaction).toHaveBeenCalledTimes(1);

    const args = (
      db.representant.createMany.mock.calls[0] as [
        { data: Record<string, unknown>[]; skipDuplicates: boolean },
      ]
    )[0];
    expect(args.skipDuplicates).toBe(true);
    expect(args.data).toHaveLength(2);
    expect(args.data[0]).toMatchObject({
      fullName: 'Fatou Ndiaye',
      phoneE164: '+221771000001',
      departementId: 'dep-dakar',
      iefId: 'ief-alm',
      createdById: ADMIN.id,
    });
    expect(args.data[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
  });

  it('SIGNALE les lignes écartées à l’écriture au lieu de les perdre', async () => {
    db.representant.createMany.mockResolvedValue({ count: 1 });
    const file = await workbookOf([
      ['Fatou Ndiaye', '+221771000001', 'Dakar', '', ''],
      ['Awa Fall', '+221771000003', 'Dakar', '', ''],
    ]);

    const report = await service.import(ADMIN, requestWith(file), { dryRun: false });

    expect(report.valid).toBe(2);
    expect(report.created).toBe(1);
    expect(report.errors.map((error) => error.code)).toContain('SKIPPED_ON_WRITE');
  });

  it('ne signale rien quand tout ce qui était retenu est écrit', async () => {
    const file = await workbookOf([['Fatou Ndiaye', '+221771000001', 'Dakar', '', '']]);
    const report = await service.import(ADMIN, requestWith(file), { dryRun: false });

    expect(report.created).toBe(1);
    expect(report.errors).toEqual([]);
  });

  it('relève les délais de la transaction d’écriture', async () => {
    const file = await workbookOf([['Fatou Ndiaye', '+221771000001', 'Dakar', '', '']]);
    await service.import(ADMIN, requestWith(file), { dryRun: false });

    const options = (db.$transaction.mock.calls[0] as [unknown, unknown])[1] as {
      timeout: number;
      maxWait: number;
    };
    expect(options.timeout).toBeGreaterThanOrEqual(60_000);
    expect(options.maxWait).toBeGreaterThanOrEqual(15_000);
  });

  it('n’ouvre aucune transaction quand rien n’est retenu', async () => {
    const file = await workbookOf([['X', 'pas-un-numero', 'Nulle part', '', '']]);
    const report = await service.import(ADMIN, requestWith(file), { dryRun: false });

    expect(report.created).toBe(0);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('import : la ligne d’exemple du modèle', () => {
  it('n’est JAMAIS importée : un modèle vierge ne produit aucune ligne', async () => {
    const file = await workbookOf([]);

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.totalRows).toBe(0);
    expect(report.valid).toBe(0);
    expect(report.errors).toEqual([]);
  });

  it('n’empêche pas la lecture de la première fiche réelle, en ligne 3', async () => {
    const file = await workbookOf([['Moussa Sarr', '+221771000009', 'Dakar', '', '']]);

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.valid).toBe(1);
    expect(report.preview[0]).toMatchObject({ line: 3, fullName: 'Moussa Sarr' });
  });
});

describe('import : refus de fichier', () => {
  it('refuse une requête sans fichier', async () => {
    const request = { file: () => Promise.resolve(undefined) } as unknown as FastifyRequest;
    await expect(service.import(ADMIN, request, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un fichier tronqué par le plafond de taille', async () => {
    const file = await workbookOf([['Fatou Ndiaye', '+221771000001', 'Dakar', '', '']]);
    await expect(service.import(ADMIN, requestWith(file, true), {})).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  const lignesFactices = (count: number): string[][] =>
    Array.from({ length: count }, (_, index) => [
      `Fiche ${String(index)}`,
      `+2217${String(70000000 + index)}`,
      'Dakar',
      '',
      '',
    ]);

  it('accepte EXACTEMENT le plafond de lignes', async () => {
    const file = await workbookOf(lignesFactices(IMPORT_MAX_ROWS));

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.totalRows).toBe(IMPORT_MAX_ROWS);
    expect(report.errors).toEqual([]);
  }, 60_000);

  it('refuse à la PREMIÈRE ligne au-delà du plafond', async () => {
    const file = await workbookOf(lignesFactices(IMPORT_MAX_ROWS + 1));

    const error = await service
      .import(ADMIN, requestWith(file), {})
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as { response: { code: string; maxRows: number } }).response).toMatchObject({
      code: 'REPRESENTANT_IMPORT_TOO_MANY_ROWS',
      maxRows: IMPORT_MAX_ROWS,
    });
  }, 60_000);

  it('un fichier de zéro ligne rend un rapport vide sans rien écrire', async () => {
    const file = await workbookOf([]);

    const report = await service.import(ADMIN, requestWith(file), { dryRun: false });

    expect(report.totalRows).toBe(0);
    expect(report.errors).toEqual([]);
    expect(report.created).toBe(0);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('refuse un classeur dépourvu de feuille', async () => {
    const workbook = new ExcelJS.Workbook();
    const vide = Buffer.from(await workbook.xlsx.writeBuffer());

    const error = await service
      .import(ADMIN, requestWith(vide), {})
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as { response: { code: string } }).response.code).toBe(
      'REPRESENTANT_IMPORT_SHEET_MISSING',
    );
  });

  it('refuse un fichier qui n’est pas un classeur lisible', async () => {
    await expect(
      service.import(ADMIN, requestWith(Buffer.from('ceci n’est pas un xlsx')), {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('borne le flux multipart AVANT de le matérialiser', async () => {
    const buffer = await workbookOf([['Fatou Ndiaye', '+221771000001', 'Dakar', '', '']]);
    const file = vi.fn().mockResolvedValue({
      toBuffer: () => Promise.resolve(buffer),
      file: { truncated: false },
    });

    await service.import(ADMIN, { file } as unknown as FastifyRequest, {});

    const limits = (file.mock.calls[0] as [{ limits: { fileSize: number; files: number } }])[0];
    expect(limits.limits.fileSize).toBe(IMPORT_MAX_BYTES);
    expect(limits.limits.files).toBe(1);
  });

  it('traite un flux coupé par le parseur comme un dépassement de taille', async () => {
    const request = {
      file: () => Promise.reject(new Error('request file too large')),
    } as unknown as FastifyRequest;

    await expect(service.import(ADMIN, request, {})).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  it('refuse un classeur au delà du plafond de lignes', async () => {
    const rows = Array.from({ length: 5_001 }, (_, index) => [
      `Personne ${String(index)}`,
      `+2217710${String(index).padStart(5, '0')}`,
      'Dakar',
      '',
      '',
    ]);
    const file = await workbookOf(rows);

    const error = await service
      .import(ADMIN, requestWith(file), {})
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as { response: { code: string } }).response.code).toBe(
      'REPRESENTANT_IMPORT_TOO_MANY_ROWS',
    );
  }, 30_000);
});
