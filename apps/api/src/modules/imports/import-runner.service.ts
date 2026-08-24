import { Inject, Injectable, Logger } from '@nestjs/common';
import { ImportStatus, type ImportJob, type Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  IMPORT_ADAPTERS,
  ImportAdapterFailure,
  type ImportAdapter,
  type ImportRowError,
  type ImportRunContext,
} from './import-adapter.js';
import { ImportClaim } from './import-claim.js';
import { readImportsEnv } from './imports.env.js';
import {
  boundErrors,
  exceedsCeiling,
  isClaimable,
  MAX_REPORTED_ERRORS,
  resumeSkip,
} from './imports.job.js';
import {
  IMPORT_ROW_READER,
  isBlankRow,
  UnreadableWorkbookError,
  type ImportRowReader,
  type SheetSource,
} from './xlsx-rows.js';

export type ImportRunOutcome =
  | { readonly result: 'skipped'; readonly reason: string }
  | { readonly result: 'busy' }
  | { readonly result: 'lost' }
  | { readonly result: 'succeeded'; readonly created: number; readonly processed: number }
  | { readonly result: 'failed'; readonly code: string };

const CHUNK_TRANSACTION_TIMEOUT_MS = 60_000;
const CHUNK_TRANSACTION_MAX_WAIT_MS = 15_000;

class LostLeaseError extends Error {
  constructor() {
    super('Le bail a été repris par un autre travailleur.');
    this.name = 'LostLeaseError';
  }
}

class ImportRunFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ImportRunFailure';
  }
}

type AnyImportAdapter = ImportAdapter<unknown>;

interface Totals {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errorRows: number;
  errors: ImportRowError[];
}

@Injectable()
export class ImportRunnerService {
  private readonly logger = new Logger(ImportRunnerService.name);
  private readonly config = readImportsEnv();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IMPORT_ADAPTERS) private readonly adapters: readonly AnyImportAdapter[],
    @Inject(IMPORT_ROW_READER) private readonly reader: ImportRowReader,
  ) {}

  async run(jobId: string, now = new Date()): Promise<ImportRunOutcome> {
    const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
    if (job === null) return { result: 'skipped', reason: 'IMPORT_JOB_ABSENT' };
    if (!isClaimable(job, now)) return { result: 'busy' };

    const claim = await ImportClaim.take(this.prisma, jobId, now);
    if (claim === null) return { result: 'busy' };

    const adapter = this.adapters.find((candidate) => candidate.kind === job.kind);
    if (adapter === undefined) {
      return this.fail(
        claim,
        'IMPORT_ADAPTER_MISSING',
        `Aucun adaptateur n’est enregistré pour « ${job.kind} ».`,
      );
    }

    let source: SheetSource | null = null;
    try {
      source = await this.openSource(job, adapter);
      return await this.consume(job, adapter, claim, source);
    } catch (error) {
      if (error instanceof LostLeaseError) return { result: 'lost' };
      if (error instanceof ImportRunFailure) {
        return await this.fail(claim, error.code, error.message);
      }
      if (error instanceof ImportAdapterFailure) {
        return await this.fail(claim, error.code, error.message);
      }
      if (error instanceof UnreadableWorkbookError) {
        return await this.fail(claim, 'IMPORT_FILE_UNREADABLE', error.reason);
      }
      this.logger.error(`Import ${jobId} : échec inattendu. ${String(error)}`);
      return await this.fail(claim, 'IMPORT_FAILED', String(error));
    } finally {
      await source?.close();
    }
  }

  private async openSource(job: ImportJob, adapter: AnyImportAdapter): Promise<SheetSource> {
    const source = await this.reader.open(job.storagePath, adapter.templateColumns, adapter.layout);

    if (exceedsCeiling(source.declaredDataRows, adapter.maxRows)) {
      await source.close();
      throw new ImportRunFailure(
        'IMPORT_TOO_MANY_ROWS',
        `Le fichier dépasse le plafond de ${String(adapter.maxRows)} lignes. Découpez-le.`,
      );
    }

    return source;
  }

  private async consume(
    job: ImportJob,
    adapter: AnyImportAdapter,
    claim: ImportClaim,
    source: SheetSource,
  ): Promise<ImportRunOutcome> {
    const chunkSize = this.config.IMPORTS_CHUNK_SIZE;
    const skip = resumeSkip(job.processedRows);

    const totals: Totals = {
      processed: skip,
      created: job.createdRows,
      updated: job.updatedRows,
      skipped: job.skippedRows,
      errorRows: job.errorRows,
      errors: reportedErrors(job.report),
    };

    const started = new Date();
    if (
      !(await claim.write(
        {
          status: ImportStatus.running,
          startedAt: job.startedAt ?? started,
          totalRows: source.declaredDataRows,
        },
        started,
      ))
    ) {
      throw new LostLeaseError();
    }

    const run = await adapter.prepare(this.contextOn(job, this.prisma));

    let seen = 0;
    let pendingConsumed = 0;
    let buffer: unknown[] = [];

    const flush = async (): Promise<void> => {
      if (pendingConsumed === 0) return;
      await this.writeChunk(job, adapter, claim, buffer, pendingConsumed, totals, run);
      buffer = [];
      pendingConsumed = 0;
    };

    for await (const raw of source.rows()) {
      if (isBlankRow(raw.cells)) continue;

      seen += 1;

      if (exceedsCeiling(seen, adapter.maxRows)) {
        throw new ImportRunFailure(
          'IMPORT_TOO_MANY_ROWS',
          `Le fichier dépasse le plafond de ${String(adapter.maxRows)} lignes. Découpez-le.`,
        );
      }

      if (seen <= skip) continue;

      const parsed = adapter.parseRow(raw.cells, raw.rowNumber, run);
      if (parsed.ok) {
        buffer.push(parsed.row);
      } else {
        totals.errorRows += 1;
        totals.errors = boundErrors(totals.errors, [parsed.error]);
      }

      pendingConsumed += 1;
      if (pendingConsumed >= chunkSize) await flush();
    }

    await flush();

    const finished = new Date();
    const report = buildReport(job, totals, seen);
    if (
      !(await claim.write(
        {
          status: ImportStatus.succeeded,
          processedRows: totals.processed,
          createdRows: totals.created,
          updatedRows: totals.updated,
          skippedRows: totals.skipped,
          errorRows: totals.errorRows,
          totalRows: seen,
          report,
          finishedAt: finished,
        },
        finished,
      ))
    ) {
      throw new LostLeaseError();
    }

    return { result: 'succeeded', created: totals.created, processed: totals.processed };
  }

  private async writeChunk(
    job: ImportJob,
    adapter: AnyImportAdapter,
    claim: ImportClaim,
    rows: readonly unknown[],
    consumed: number,
    totals: Totals,
    run: unknown,
  ): Promise<void> {
    const processed = totals.processed + consumed;

    const outcome = await this.prisma.$transaction(
      async (tx) => {
        const chunk = await adapter.writeChunk(rows, this.contextOn(job, tx), run);

        const written = await claim.writeIn(
          tx,
          {
            status: ImportStatus.running,
            processedRows: processed,
            createdRows: totals.created + chunk.created,
            updatedRows: totals.updated + (chunk.updated ?? 0),
            skippedRows: totals.skipped + chunk.skipped,
            errorRows: totals.errorRows + chunk.errors.length,
          },
          new Date(),
        );
        if (!written) throw new LostLeaseError();

        return chunk;
      },
      { timeout: CHUNK_TRANSACTION_TIMEOUT_MS, maxWait: CHUNK_TRANSACTION_MAX_WAIT_MS },
    );

    totals.processed = processed;
    totals.created += outcome.created;
    totals.updated += outcome.updated ?? 0;
    totals.skipped += outcome.skipped;
    totals.errorRows += outcome.errors.length;
    totals.errors = boundErrors(totals.errors, outcome.errors);
  }

  private contextOn(job: ImportJob, tx: Prisma.TransactionClient): ImportRunContext {
    return {
      jobId: job.id,
      mode: job.mode,
      requestedById: job.requestedById,
      tx,
    };
  }

  private async fail(claim: ImportClaim, code: string, message: string): Promise<ImportRunOutcome> {
    const now = new Date();
    await claim.write(
      {
        status: ImportStatus.failed,
        failureCode: code,
        failureMsg: message.slice(0, 2_000),
        finishedAt: now,
      },
      now,
    );
    return { result: 'failed', code };
  }
}

function reportedErrors(report: Prisma.JsonValue | null): ImportRowError[] {
  if (report === null || typeof report !== 'object' || Array.isArray(report)) return [];
  const errors = (report as Record<string, unknown>).errors;
  if (!Array.isArray(errors)) return [];

  return errors.flatMap((entry): ImportRowError[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.code !== 'string' || typeof row.message !== 'string') return [];
    return [
      {
        rowNumber: typeof row.rowNumber === 'number' ? row.rowNumber : 0,
        ...(typeof row.column === 'string' ? { column: row.column } : {}),
        code: row.code,
        message: row.message,
      },
    ];
  });
}

function buildReport(job: ImportJob, totals: Totals, totalRows: number): Prisma.InputJsonValue {
  return {
    mode: job.mode,
    kind: job.kind,
    totalRows,
    processedRows: totals.processed,
    createdRows: totals.created,
    updatedRows: totals.updated,
    skippedRows: totals.skipped,
    errorRows: totals.errorRows,
    truncated: totals.errorRows > totals.errors.length,
    maxReportedErrors: MAX_REPORTED_ERRORS,
    errors: totals.errors.map((error) => ({
      rowNumber: error.rowNumber,
      ...(error.column === undefined ? {} : { column: error.column }),
      code: error.code,
      message: error.message,
    })),
  };
}
