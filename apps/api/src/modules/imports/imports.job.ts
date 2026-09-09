import { ImportStatus } from '@crm/database';

import type { ImportRowError } from './import-adapter.js';

export const FIRST_DATA_ROW = 3;

export const MAX_REPORTED_ERRORS = 200;

export const IMPORT_LEASE_MS = 10 * 60_000;

export const IMPORT_CLOCK_SKEW_TOLERANCE_MS = 5 * 60_000;

const isInFlight = (status: ImportStatus): boolean =>
  status === ImportStatus.queued || status === ImportStatus.running;

export interface ImportLeaseView {
  readonly status: ImportStatus;
  readonly claimedAt: Date | null;
  readonly createdAt: Date;
}

export function isClaimable(job: ImportLeaseView, now: Date): boolean {
  if (!isInFlight(job.status)) return false;
  if (job.claimedAt === null) return true;

  const age = now.getTime() - job.claimedAt.getTime();

  if (!Number.isFinite(age)) return true;

  if (age > IMPORT_LEASE_MS) return true;

  return age < -IMPORT_CLOCK_SKEW_TOLERANCE_MS;
}

export function chunkOf<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) throw new RangeError('La taille de tranche doit être strictement positive.');
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

export const resumeSkip = (processedRows: number): number =>
  Number.isFinite(processedRows) && processedRows > 0 ? Math.floor(processedRows) : 0;

export const exceedsCeiling = (rows: number | null, maxRows: number): boolean =>
  rows !== null && Number.isFinite(rows) && rows > maxRows;

export function boundErrors(
  current: readonly ImportRowError[],
  incoming: readonly ImportRowError[],
  max = MAX_REPORTED_ERRORS,
): ImportRowError[] {
  if (current.length >= max) return [...current];
  return [...current, ...incoming].slice(0, max);
}
