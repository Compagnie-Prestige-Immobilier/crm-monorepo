import type { ImportKind, ImportMode, Prisma } from '@crm/database';

import type { ImportColumn } from '../representants/import-template.js';

export type PrismaTransactionClient = Prisma.TransactionClient;

export type { ImportColumn };

export interface ImportRowError {
  rowNumber: number;
  column?: string;
  code: string;
  message: string;
}

export type ParsedRow<T> = { ok: true; row: T } | { ok: false; error: ImportRowError };

export interface ChunkOutcome {
  created: number;
  skipped: number;
  errors: readonly ImportRowError[];
}

export interface ImportRunContext {
  readonly jobId: string;
  readonly mode: ImportMode;
  readonly requestedById: string;
  readonly tx: PrismaTransactionClient;
}

export interface ImportAdapter<TRow> {
  readonly kind: ImportKind;
  readonly maxRows: number;
  readonly templateColumns: readonly ImportColumn[];
  parseRow(cells: Record<string, string>, rowNumber: number): ParsedRow<TRow>;
  prepare(ctx: ImportRunContext): Promise<void>;
  writeChunk(rows: readonly TRow[], ctx: ImportRunContext): Promise<ChunkOutcome>;
}

export const IMPORT_ADAPTERS = Symbol('IMPORT_ADAPTERS');
