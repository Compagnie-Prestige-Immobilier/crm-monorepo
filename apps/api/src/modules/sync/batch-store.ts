import { Injectable } from '@nestjs/common';
import { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Niveau 1 de l'idempotence : le lot.
 *
 * Le marqueur `IN_PROGRESS` est posé par une instruction AUTONOME, exécutée
 * AVANT la transaction de travail et donc validée indépendamment d'elle. C'est
 * l'erreur classique de ce motif : placer l'insertion dans la transaction de
 * travail: un rollback l'efface, le rejeu ne trouve plus de marqueur et
 * réapplique tout le lot une seconde fois.
 *
 * Le pendant de ce choix est qu'un lot dont le traitement échoue laisse un
 * marqueur `IN_PROGRESS` orphelin. D'où la reprise après 60 secondes, plus bas.
 */

/** Au-delà, un marqueur `IN_PROGRESS` est considéré comme abandonné. */
export const IN_PROGRESS_TIMEOUT_MS = 60_000;

export type BatchClaim =
  | { outcome: 'claimed' }
  /** Même clé, même corps, lot déjà terminé : on rejoue la réponse mémorisée. */
  | { outcome: 'replay'; httpStatus: number; response: unknown }
  /** Même clé, corps différent : bug client, on refuse. */
  | { outcome: 'payload_mismatch' }
  /** Un autre appel est en cours sur la même clé. */
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

    // Transaction implicite : une instruction seule est validée à part entière,
    // hors de toute transaction de travail. C'est exactement ce qu'on veut.
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
    // La ligne a disparu entre les deux instructions (purge des lots expirés) :
    // on retente une prise franche plutôt que de deviner.
    if (!existing) return this.claim(userId, key, hash, ttlDays);

    if (existing.status === 'COMPLETED') {
      if (existing.requestHash !== hash) return { outcome: 'payload_mismatch' };
      return {
        outcome: 'replay',
        httpStatus: existing.httpStatus ?? 200,
        response: existing.responseJson,
      };
    }

    // IN_PROGRESS. Reprise conditionnelle : le prédicat sur `createdAt` est
    // évalué par PostgreSQL au moment de l'UPDATE, donc deux repreneurs
    // simultanés ne peuvent pas réussir tous les deux — le second voit la date
    // déjà rafraîchie et repart avec 0 ligne.
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

  /** Mémorise la réponse. Hors transaction de travail, comme la prise du marqueur. */
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

  /**
   * Libère un marqueur dont le traitement s'est effondré, pour que le rejeu
   * immédiat du client ne bute pas 60 secondes sur un 409.
   */
  async release(userId: string, key: string): Promise<void> {
    await this.prisma.syncBatch.deleteMany({ where: { userId, key, status: 'IN_PROGRESS' } });
  }
}
