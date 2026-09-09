import { Injectable } from '@nestjs/common';
import { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';

const IN_PROGRESS_TIMEOUT_MS = 60_000;

export type BatchClaim =
  | { outcome: 'claimed' }
  | { outcome: 'replay'; httpStatus: number; response: unknown }
  | { outcome: 'payload_mismatch' }
  | { outcome: 'in_progress' };

interface BatchRow {
  requestHash: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  httpStatus: number | null;
  responseJson: Prisma.JsonValue | null;
}

@Injectable()
export class SyncBatchStore {
  constructor(private readonly prisma: PrismaService) {}

  async claim(userId: string, key: string, hash: string, ttlDays: number): Promise<BatchClaim> {
    const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);

    const inserted = await this.prisma.$executeRaw`
      INSERT INTO "sync_batches" ("idempotency_key", "userId", "requestHash", "status", "createdAt", "expiresAt")
      VALUES (${key}, ${userId}, ${hash}, 'IN_PROGRESS'::"BatchStatus", now(), ${expiresAt})
      ON CONFLICT ("userId", "idempotency_key") DO NOTHING
    `;
    if (inserted === 1) return { outcome: 'claimed' };

    const rows = await this.prisma.$queryRaw<BatchRow[]>`
      SELECT "requestHash", "status", "httpStatus", "responseJson"
      FROM "sync_batches"
      WHERE "userId" = ${userId} AND "idempotency_key" = ${key}
    `;
    const existing = rows[0];
    if (!existing) return this.claim(userId, key, hash, ttlDays);

    if (existing.status === 'COMPLETED') {
      if (existing.requestHash !== hash) return { outcome: 'payload_mismatch' };
      return {
        outcome: 'replay',
        httpStatus: existing.httpStatus ?? 200,
        response: existing.responseJson,
      };
    }

    const reclaimed = await this.prisma.$executeRaw`
      UPDATE "sync_batches"
      SET "requestHash" = ${hash}, "createdAt" = now(), "responseJson" = NULL, "httpStatus" = NULL
      WHERE "userId" = ${userId}
        AND "idempotency_key" = ${key}
        AND "status" = 'IN_PROGRESS'::"BatchStatus"
        AND "createdAt" < now() - make_interval(secs => ${IN_PROGRESS_TIMEOUT_MS / 1000}::double precision)
    `;
    return reclaimed === 1 ? { outcome: 'claimed' } : { outcome: 'in_progress' };
  }

  async complete(
    userId: string,
    key: string,
    httpStatus: number,
    response: unknown,
  ): Promise<void> {
    await this.prisma.syncBatch.updateMany({
      where: { userId, key },
      data: {
        status: 'COMPLETED',
        httpStatus,
        responseJson: response as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  }

  async release(userId: string, key: string): Promise<void> {
    await this.prisma.syncBatch.deleteMany({ where: { userId, key, status: 'IN_PROGRESS' } });
  }
}
