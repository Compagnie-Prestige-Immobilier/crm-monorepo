import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import ExcelJS from 'exceljs';
import { Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
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

interface MockDb {
  representant: Record<'findMany' | 'createMany', MockFn>;
  departement: Record<'findMany', MockFn>;
  ief: Record<'findMany', MockFn>;
  $transaction: MockFn;
}

function prismaStub(): MockDb {
  const db: MockDb = {
    representant: { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn() },
    departement: { findMany: vi.fn().mockResolvedValue(DEPARTEMENTS) },
    ief: { findMany: vi.fn().mockResolvedValue(IEFS) },
    $transaction: vi.fn(),
  };
  // Le rappel de transaction interactive de Prisma est asynchrone à dessein.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  db.$transaction.mockImplementation((run: (tx: MockDb) => Promise<unknown>) => run(db));
  // `createMany` de Prisma est asynchrone à dessein, comme `$transaction`.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  db.representant.createMany.mockImplementation((args: { data: unknown[] }) =>
    Promise.resolve({ count: args.data.length }),
  );
  return db;
}

/**
 * Construit un classeur AU FORMAT EXACT DU MODÈLE téléchargé.
 *
 * Ligne 1 l'en-tête, ligne 2 l'exemple grisé, ligne 3 la première fiche. Le
 * gabarit doit être respecté ici, sinon le test valide un fichier que
 * l'utilisateur n'a aucun moyen de produire, et le décalage d'une ligne entre
 * le générateur de modèle et le lecteur passe inaperçu.
 */
async function workbookOf(rows: readonly (readonly string[])[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Représentants');
  sheet.addRow(IMPORT_COLUMNS.map((column) => column.header));
  sheet.addRow(IMPORT_COLUMNS.map((column) => column.sample));
  for (const row of rows) sheet.addRow([...row]);
  const written = await workbook.xlsx.writeBuffer();
  return Buffer.from(written);
}

/** Requête Fastify factice portant un seul fichier multipart. */
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
  service = new RepresentantsImportService(db as unknown as PrismaService, fakeDemoVisibility());
});

describe('normalizeKey', () => {
  it('rapproche les orthographes qu’un fichier rempli à la main produit', () => {
    // Refuser « SAINT-LOUIS » parce qu'il manque un tiret rendrait l'import
    // inutilisable sur exactement le genre de fichier qu'on lui destine.
    const expected = normalizeKey('Saint-Louis');
    for (const variant of ['SAINT-LOUIS', 'saint louis', 'Saint  Louis', 'Sáint-Loüis']) {
      expect(normalizeKey(variant)).toBe(expected);
    }
  });
});

describe('import : simulation', () => {
  it('N’ÉCRIT RIEN par défaut, même sur un fichier parfait', async () => {
    // `dryRun` vaut vrai par défaut : l'écriture doit être un acte explicite,
    // pas ce qui arrive quand on oublie un paramètre.
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

  it('numérote les erreurs sur la ligne DU FICHIER, en-tête compris', async () => {
    // Un index de tableau ferait chercher au mauvais endroit dans Excel.
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
    // Trancher en silence changerait le rattachement, dont dépend tout le
    // reporting terrain : mieux vaut le dire.
    const file = await workbookOf([
      ['Fatou Ndiaye', '+221771000001', 'Dakar', 'Saint-Louis Ville', ''],
    ]);

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.errors[0]?.code).toBe('IEF_DEPARTEMENT_MISMATCH');
  });

  it('détecte les doublons DANS LE FICHIER, sur la forme normalisée', async () => {
    // « 77 123 45 67 » et « +221771234567 » sont le même abonné : les compter
    // comme deux personnes est exactement l'erreur que la normalisation existe
    // pour empêcher.
    const file = await workbookOf([
      ['Fatou Ndiaye', '77 123 45 67', 'Dakar', '', ''],
      ['Fatou N. Ndiaye', '+221771234567', 'Dakar', '', ''],
    ]);

    const report = await service.import(ADMIN, requestWith(file), {});

    expect(report.valid).toBe(1);
    expect(report.duplicates).toBe(1);
    // C'est la SECONDE occurrence qui est rejetée : celle du haut du fichier
    // est celle que l'utilisateur reconnaît.
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

  /**
   * L'unicité du téléphone est GLOBALE : l'index partiel
   * `representants_phone_e164_active_key` ne connaît pas le mode démonstration.
   * Filtrer ce contrôle déclarait libre un numéro que la base refuse ensuite,
   * `skipDuplicates` écartait la ligne en silence, et le rapport annonçait des
   * créations qui n'avaient pas eu lieu.
   */
  it('cherche les doublons SANS portée de démonstration : l’unicité est globale', async () => {
    const file = await workbookOf([['Fatou Ndiaye', '+221771000001', 'Dakar', '', '']]);
    await service.import(ADMIN, requestWith(file), {});

    const args = (
      db.representant.findMany.mock.calls[0] as [{ where: Record<string, unknown> }]
    )[0];
    expect(args.where).toEqual({ phoneE164: { in: ['+221771000001'] }, deletedAt: null });
  });

  it('IGNORE les lignes vides au lieu de les compter en erreur', async () => {
    // Un classeur rempli à la main en porte toujours quelques-unes en fin de
    // fichier ; les compter ferait paraître l'import cassé.
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
    // Un import à moitié appliqué ne se rattrape pas : rejouer le fichier bute
    // sur les doublons de ce qui est déjà passé.
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
    // L'identifiant est un UUID v7 : l'ordre lexicographique doit rester
    // l'ordre temporel, comme pour les fiches nées sur mobile.
    expect(args.data[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
  });

  /**
   * `skipDuplicates` peut écarter une ligne retenue si un commercial saisit la
   * même fiche pendant l'import. Muet, l'écart contredit la promesse « tout ou
   * rien » de l'en-tête : le rapport annonçait « 2 valides, 2 créés » pour une
   * seule fiche réellement en base.
   */
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

  /**
   * Sans options, Prisma coupe à 5 s : une insertion de 5 000 lignes les
   * dépasse sur une base chargée, et l'utilisateur perd son import après avoir
   * attendu la lecture complète du classeur.
   */
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
  /**
   * Le défaut concret : `FIRST_DATA_ROW` valait 2, donc l'exemple grisé du
   * modèle était lu comme une fiche ordinaire, et l'onglet Instructions
   * autorisait à le laisser en place. Un classeur téléchargé puis rempli sans
   * supprimer la ligne 2 créait « Fatou Ndiaye » au 77 123 45 67, qui prenait
   * ce numéro dans l'index d'unicité.
   */
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

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * LE PLAFOND DE LIGNES, PRIS SUR SON BORD
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Le refus est écrit `rows.length >= IMPORT_MAX_ROWS` À L'INTÉRIEUR de la
   * boucle, avant l'empilement : il se déclenche donc quand on s'apprête à
   * ajouter la 5 001e. Un `>` au lieu d'un `>=`, ou un contrôle déplacé après
   * l'empilement, décale la frontière d'exactement une ligne, ce qu'aucun essai
   * mené loin du bord ne peut voir. Les deux cas ci-dessous encadrent la
   * frontière au plus près : 5 000 passe, 5 001 est refusé.
   */
  const lignesFactices = (count: number): string[][] =>
    Array.from({ length: count }, (_, index) => [
      `Fiche ${String(index)}`,
      // Numéros sénégalais distincts : un doublon n'a rien à voir avec le
      // plafond, mais il polluerait le rapport et brouillerait la lecture.
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

  /**
   * Un fichier SANS AUCUNE ligne de données n'est pas une faute : c'est le
   * modèle vierge, que les gens téléchargent puis renvoient par erreur. Il doit
   * rendre un rapport vide, et surtout n'ouvrir aucune transaction.
   */
  it('un fichier de zéro ligne rend un rapport vide sans rien écrire', async () => {
    const file = await workbookOf([]);

    const report = await service.import(ADMIN, requestWith(file), { dryRun: false });

    expect(report.totalRows).toBe(0);
    expect(report.errors).toEqual([]);
    expect(report.created).toBe(0);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  /** Un classeur sans la moindre feuille : ExcelJS le lit, il n'a rien à offrir. */
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

  /**
   * Le plafond de TAILLE est remis au parseur multipart et non vérifié après
   * coup : un envoi de 500 Mo était sinon intégralement matérialisé en mémoire
   * avant d'être refusé, ce qui fait de ce contrôle un moyen d'épuiser le
   * conteneur plutôt qu'une protection contre lui.
   */
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
