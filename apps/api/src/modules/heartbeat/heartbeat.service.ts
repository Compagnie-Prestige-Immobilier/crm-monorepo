import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Ce que l'appareil déclare de lui-même. Les deux champs sont facultatifs POUR
 * TOUJOURS : un téléphone déjà déployé ne les enverra jamais, et une version
 * plus ancienne de l'application doit continuer à synchroniser.
 */
export interface HeartbeatSignal {
  readonly pendingOps?: number;
  readonly appVersion?: string;
}

@Injectable()
export class HeartbeatService {
  private readonly logger = new Logger(HeartbeatService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    userId: string,
    kind: 'pull' | 'push',
    signal: HeartbeatSignal,
    at: Date = new Date(),
  ): Promise<void> {
    const data = {
      ...(kind === 'pull' ? { lastPullAt: at } : { lastPushAt: at }),
      ...(signal.pendingOps === undefined ? {} : { pendingOps: signal.pendingOps }),
      ...(signal.appVersion === undefined ? {} : { appVersion: signal.appVersion }),
    };

    try {
      await this.prisma.agentHeartbeat.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
      await this.recordActivity(userId, at);
    } catch (error) {
      // La synchronisation hors ligne est la fonction vitale du mobile ; une
      // trace de présence ne doit jamais la faire échouer.
      this.logger.warn(
        `Battement de cœur non enregistré pour ${userId} : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async recordActivity(userId: string, at: Date = new Date()): Promise<void> {
    try {
      await this.prisma.$executeRaw`
      WITH signal AS (SELECT ${at}::timestamp AS "at"),
      precedent AS (
        SELECT MAX("lastSeenAt") AS "lastSeenAt"
        FROM "agent_activity_slots" WHERE "userId" = ${userId}
      )
      INSERT INTO "agent_activity_slots"
        ("userId", "slot", "firstSeenAt", "lastSeenAt", "activeSeconds")
      SELECT
        ${userId},
        date_trunc('hour', s."at"),
        s."at",
        s."at",
        -- Un écart qui enjambe une frontière d'heure est porté en entier par la
        -- tranche du nouveau signal : 90 secondes au plus, une fois par heure.
        CASE
          WHEN p."lastSeenAt" < s."at"
            AND s."at" - p."lastSeenAt" <= interval '90 seconds'
          THEN EXTRACT(EPOCH FROM (s."at" - p."lastSeenAt"))::int
          ELSE 0
        END
      FROM signal s CROSS JOIN precedent p
      ON CONFLICT ("userId", "slot") DO UPDATE SET
        "activeSeconds" = "agent_activity_slots"."activeSeconds" +
          CASE
            WHEN EXCLUDED."lastSeenAt" > "agent_activity_slots"."lastSeenAt"
              AND EXCLUDED."lastSeenAt" - "agent_activity_slots"."lastSeenAt" <= interval '90 seconds'
            THEN EXTRACT(EPOCH FROM (
              EXCLUDED."lastSeenAt" - "agent_activity_slots"."lastSeenAt"
            ))::int
            ELSE 0
          END,
        "lastSeenAt" = GREATEST(
          "agent_activity_slots"."lastSeenAt",
          EXCLUDED."lastSeenAt"
        )
    `;
    } catch (error) {
      // La socket de présence n'attend pas cette promesse : une erreur non
      // rattrapée ici arrête le processus, donc la synchronisation mobile.
      this.logger.warn(
        `Présence non enregistrée pour ${userId} : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
