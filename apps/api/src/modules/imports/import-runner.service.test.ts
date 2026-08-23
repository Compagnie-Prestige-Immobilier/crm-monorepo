import { ImportKind, ImportMode, ImportStatus } from '@crm/database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { IMPORT_COLUMNS } from '../representants/import-template.js';
import type { ChunkOutcome, ImportAdapter, ParsedRow } from './import-adapter.js';
import { ImportRunnerService } from './import-runner.service.js';
import { DEPARTEMENT_DAKAR, fakeJob, FakeImportPrisma } from './fake-import-prisma.js';
import { ImportsService } from './imports.service.js';
import { RepresentantsImportAdapter } from './representants.adapter.js';
import type { ImportRowReader, SheetRow, SheetSource } from './xlsx-rows.js';

const HEADERS = IMPORT_COLUMNS.map((column) => column.header);

const sheetRow = (rowNumber: number, values: readonly string[]): SheetRow => ({
  rowNumber,
  cells: Object.fromEntries(HEADERS.map((header, index) => [header, values[index] ?? ''])),
});

const validRows = (count: number): SheetRow[] =>
  Array.from({ length: count }, (_, index) =>
    sheetRow(3 + index, [
      `Représentant ${String(index + 1)}`,
      `77 123 45 ${String(60 + index).padStart(2, '0')}`,
      'Dakar',
      '',
      '',
    ]),
  );

class FakeRowReader implements ImportRowReader {
  pulled = 0;
  closed = 0;

  constructor(
    private readonly rows: readonly SheetRow[],
    private readonly declaredDataRows: number | null = null,
  ) {}

  open(): Promise<SheetSource> {
    return Promise.resolve({
      declaredDataRows: this.declaredDataRows,
      rows: () => this.iterate(),
      close: () => {
        this.closed += 1;
        return Promise.resolve();
      },
    });
  }

  private async *iterate(): AsyncIterable<SheetRow> {
    for (const row of this.rows) {
      this.pulled += 1;
      await Promise.resolve();
      yield row;
    }
  }
}

class TinyAdapter implements ImportAdapter<{ rowNumber: number }> {
  readonly kind = ImportKind.REPRESENTANTS;
  readonly templateColumns = IMPORT_COLUMNS;
  prepared = 0;
  written: number[] = [];

  constructor(readonly maxRows: number) {}

  parseRow(_cells: Record<string, string>, rowNumber: number): ParsedRow<{ rowNumber: number }> {
    return { ok: true, row: { rowNumber } };
  }

  prepare(): Promise<void> {
    this.prepared += 1;
    return Promise.resolve();
  }

  writeChunk(rows: readonly { rowNumber: number }[]): Promise<ChunkOutcome> {
    this.written.push(...rows.map((row) => row.rowNumber));
    return Promise.resolve({ created: rows.length, skipped: 0, errors: [] });
  }
}

const runnerOn = (
  prisma: FakeImportPrisma,
  reader: ImportRowReader,
  adapters: readonly unknown[],
): ImportRunnerService =>
  new ImportRunnerService(
    prisma as unknown as PrismaService,
    adapters as unknown as readonly ImportAdapter<unknown>[],
    reader,
  );

const NOW = new Date('2026-08-16T10:00:00.000Z');

describe('moteur d’import', () => {
  let prisma: FakeImportPrisma;
  let adapter: RepresentantsImportAdapter;

  beforeEach(() => {
    process.env.IMPORTS_CHUNK_SIZE = '2';
    prisma = new FakeImportPrisma();
    adapter = new RepresentantsImportAdapter();
  });

  afterEach(() => {
    delete process.env.IMPORTS_CHUNK_SIZE;
  });

  it('écrit toutes les lignes valides, une transaction par tranche', async () => {
    prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));
    const reader = new FakeRowReader(validRows(5));

    const outcome = await runnerOn(prisma, reader, [adapter]).run('job-1', NOW);

    expect(outcome).toEqual({ result: 'succeeded', created: 5, processed: 5 });
    expect(prisma.representants).toHaveLength(5);
    expect(prisma.transactions).toBe(3);

    const job = prisma.jobs[0];
    expect(job?.status).toBe(ImportStatus.succeeded);
    expect(job?.processedRows).toBe(5);
    expect(job?.createdRows).toBe(5);
    expect(job?.totalRows).toBe(5);
    expect(job?.finishedAt).not.toBeNull();
  });

  it('en simulation, ne crée RIEN et annonce ce qui serait créé', async () => {
    prisma.jobs.push(fakeJob({ mode: ImportMode.DRY_RUN }));

    const outcome = await runnerOn(prisma, new FakeRowReader(validRows(3)), [adapter]).run(
      'job-1',
      NOW,
    );

    expect(outcome).toEqual({ result: 'succeeded', created: 3, processed: 3 });
    expect(prisma.representants).toHaveLength(0);
    expect(prisma.jobs[0]?.createdRows).toBe(3);
  });

  describe('reprise d’un travail mort', () => {
    it('ne recrée AUCUNE des lignes déjà comptées', async () => {
      prisma.jobs.push(
        fakeJob({
          status: ImportStatus.running,
          mode: ImportMode.APPLY,
          processedRows: 2,
          createdRows: 2,
          claimToken: 'jeton-du-mort',
          claimedAt: new Date(NOW.getTime() - 30 * 60_000),
          startedAt: new Date(NOW.getTime() - 31 * 60_000),
        }),
      );

      const rows = validRows(5);
      const reader = new FakeRowReader(rows);
      const outcome = await runnerOn(prisma, reader, [adapter]).run('job-1', NOW);

      expect(outcome).toEqual({ result: 'succeeded', created: 5, processed: 5 });

      expect(prisma.representants).toHaveLength(3);
      const ecrits = prisma.representants.map((row) => row.phoneE164);
      expect(ecrits).not.toContain('+221771234560');
      expect(ecrits).not.toContain('+221771234561');
      expect(ecrits).toContain('+221771234562');

      expect(prisma.jobs[0]?.createdRows).toBe(5);
      expect(prisma.jobs[0]?.processedRows).toBe(5);
    });

    it('ne touche pas à un travail dont le bail court encore', async () => {
      prisma.jobs.push(
        fakeJob({
          status: ImportStatus.running,
          claimToken: 'jeton-vivant',
          claimedAt: new Date(NOW.getTime() - 60_000),
        }),
      );

      const reader = new FakeRowReader(validRows(4));
      const outcome = await runnerOn(prisma, reader, [adapter]).run('job-1', NOW);

      expect(outcome).toEqual({ result: 'busy' });
      expect(reader.pulled).toBe(0);
      expect(prisma.representants).toHaveLength(0);
      expect(prisma.jobs[0]?.claimToken).toBe('jeton-vivant');
    });
  });

  describe('reprise après un échec en cours de fichier', () => {
    it('repart de la tranche interrompue, sans rejouer les précédentes', async () => {
      process.env.IMPORTS_CHUNK_SIZE = '1';
      prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));
      const rows = validRows(5);

      prisma.onBeforeTransaction = (index) => {
        if (index === 3) throw new Error('la base s’est dérobée');
      };

      const casse = await runnerOn(prisma, new FakeRowReader(rows), [adapter]).run('job-1', NOW);

      expect(casse).toEqual({ result: 'failed', code: 'IMPORT_FAILED' });
      expect(prisma.representants).toHaveLength(2);
      expect(prisma.jobs[0]?.processedRows).toBe(2);

      const service = new ImportsService(
        prisma as unknown as PrismaService,
        {
          run: () => Promise.resolve({ result: 'busy' as const }),
        } as unknown as ImportRunnerService,
        { save: () => Promise.reject(new Error('inutile')), remove: () => Promise.resolve() },
      );
      await service.apply('job-1', NOW);
      expect(prisma.jobs[0]?.processedRows).toBe(2);

      prisma.onBeforeTransaction = () => undefined;
      const reprise = await runnerOn(prisma, new FakeRowReader(rows), [adapter]).run('job-1', NOW);

      expect(reprise).toEqual({ result: 'succeeded', created: 5, processed: 5 });
      expect(prisma.representants).toHaveLength(5);
      expect(prisma.jobs[0]?.status).toBe(ImportStatus.succeeded);
      // Rejouer les deux premières lignes les aurait comptées en doublons.
      expect(prisma.jobs[0]?.skippedRows).toBe(0);
      expect(prisma.jobs[0]?.errorRows).toBe(0);
    });
  });

  describe('plafond de lignes', () => {
    it('refuse dès l’en-tête, SANS lire une seule ligne', async () => {
      prisma.jobs.push(fakeJob({}));
      const reader = new FakeRowReader(validRows(3), 50_001);

      const outcome = await runnerOn(prisma, reader, [adapter]).run('job-1', NOW);

      expect(outcome).toEqual({ result: 'failed', code: 'IMPORT_TOO_MANY_ROWS' });
      expect(reader.pulled).toBe(0);
      expect(reader.closed).toBe(1);
      expect(prisma.jobs[0]?.status).toBe(ImportStatus.failed);
      expect(prisma.jobs[0]?.failureCode).toBe('IMPORT_TOO_MANY_ROWS');
    });

    it('accepte un classeur exactement au plafond', async () => {
      prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));
      const reader = new FakeRowReader(validRows(3), 50_000);

      const outcome = await runnerOn(prisma, reader, [adapter]).run('job-1', NOW);

      expect(outcome.result).toBe('succeeded');
    });

    it('refuse à la première ligne au-delà du plafond, même sans en-tête déclaré', async () => {
      prisma.jobs.push(fakeJob({}));
      const petit = new TinyAdapter(3);
      const reader = new FakeRowReader(validRows(10), null);

      const outcome = await runnerOn(prisma, reader, [petit]).run('job-1', NOW);

      expect(outcome).toEqual({ result: 'failed', code: 'IMPORT_TOO_MANY_ROWS' });
      expect(reader.pulled).toBe(4);
    });
  });

  describe('jeton de fencing', () => {
    it('la tranche est ANNULÉE, pas seulement ignorée', async () => {
      prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));

      prisma.onBeforeTransaction = (index) => {
        if (index === 2) {
          const job = prisma.jobs[0];
          if (job) job.claimToken = 'jeton-du-repreneur';
        }
      };

      const outcome = await runnerOn(prisma, new FakeRowReader(validRows(5)), [adapter]).run(
        'job-1',
        NOW,
      );

      expect(outcome).toEqual({ result: 'lost' });

      expect(prisma.representants).toHaveLength(2);
      expect(prisma.committedChunks).toBe(1);

      expect(prisma.jobs[0]?.claimToken).toBe('jeton-du-repreneur');
      expect(prisma.jobs[0]?.createdRows).toBe(2);
      expect(prisma.jobs[0]?.status).not.toBe(ImportStatus.succeeded);
    });

    it('l’état final ne s’écrit pas non plus sans le jeton', async () => {
      prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));

      prisma.onBeforeTransaction = (index) => {
        if (index === 1) {
          const job = prisma.jobs[0];
          if (job) job.claimToken = 'jeton-du-repreneur';
        }
      };

      const outcome = await runnerOn(prisma, new FakeRowReader(validRows(1)), [adapter]).run(
        'job-1',
        NOW,
      );

      expect(outcome).toEqual({ result: 'lost' });
      expect(prisma.representants).toHaveLength(0);
      expect(prisma.jobs[0]?.status).not.toBe(ImportStatus.succeeded);
      expect(prisma.jobs[0]?.finishedAt).toBeNull();
    });
  });

  describe('doublons et refus', () => {
    it('rejette la SECONDE occurrence d’un numéro, à travers les tranches', async () => {
      prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));
      const rows = [
        sheetRow(3, ['Fatou Ndiaye', '77 123 45 60', 'Dakar', '', '']),
        sheetRow(4, ['Awa Fall', '77 123 45 61', 'Dakar', '', '']),
        sheetRow(5, ['F. Ndiaye', '+221 77 123 45 60', 'Dakar', '', '']),
      ];

      await runnerOn(prisma, new FakeRowReader(rows), [adapter]).run('job-1', NOW);

      expect(prisma.representants).toHaveLength(2);
      const job = prisma.jobs[0];
      expect(job?.skippedRows).toBe(1);
      const report = job?.report as { errors: { code: string; rowNumber: number }[] };
      expect(report.errors).toContainEqual(
        expect.objectContaining({ code: 'DUPLICATE_IN_FILE', rowNumber: 5 }),
      );
    });

    it('rejette un numéro déjà présent en base', async () => {
      prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));
      prisma.representants.push({
        id: 'rep-existant',
        fullName: 'Déjà là',
        phoneE164: '+221771234560',
        departementId: DEPARTEMENT_DAKAR.id,
        iefId: null,
        notes: null,
        createdById: 'com-1',
        clientCreatedAt: NOW,
        deletedAt: null,
      });

      await runnerOn(prisma, new FakeRowReader(validRows(2)), [adapter]).run('job-1', NOW);

      expect(prisma.representants).toHaveLength(2);
      expect(prisma.jobs[0]?.skippedRows).toBe(1);
      expect(prisma.jobs[0]?.createdRows).toBe(1);
    });

    it('compte les lignes refusées à l’analyse sans arrêter l’import', async () => {
      prisma.jobs.push(fakeJob({ mode: ImportMode.APPLY }));
      const rows = [
        sheetRow(3, ['Fatou Ndiaye', 'pas un numéro', 'Dakar', '', '']),
        sheetRow(4, ['A', '77 123 45 61', 'Dakar', '', '']),
        sheetRow(5, ['Awa Fall', '77 123 45 62', 'Département inventé', '', '']),
        sheetRow(6, ['Moussa Sy', '77 123 45 63', 'Dakar', '', '']),
      ];

      await runnerOn(prisma, new FakeRowReader(rows), [adapter]).run('job-1', NOW);

      const job = prisma.jobs[0];
      expect(job?.status).toBe(ImportStatus.succeeded);
      expect(job?.errorRows).toBe(3);
      expect(job?.createdRows).toBe(1);
      expect(job?.processedRows).toBe(4);
    });
  });

  it('échoue proprement quand aucun adaptateur ne connaît l’entité', async () => {
    prisma.jobs.push(fakeJob({}));

    const outcome = await runnerOn(prisma, new FakeRowReader(validRows(1)), []).run('job-1', NOW);

    expect(outcome).toEqual({ result: 'failed', code: 'IMPORT_ADAPTER_MISSING' });
    expect(prisma.jobs[0]?.status).toBe(ImportStatus.failed);
  });

  it('ne fait rien d’un travail qui n’existe pas', async () => {
    const outcome = await runnerOn(prisma, new FakeRowReader([]), [adapter]).run('absent', NOW);
    expect(outcome).toEqual({ result: 'skipped', reason: 'IMPORT_JOB_ABSENT' });
  });
});
