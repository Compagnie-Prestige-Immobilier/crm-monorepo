import { Injectable } from '@nestjs/common';
import { Role } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  PRESENCE_ONLINE_WINDOW_MINUTES,
  countByPresence,
  lastSeenAt,
  presenceOf,
  type ActivitySignals,
} from './presence.js';
import type { SupervisedUserDto, SupervisionDto } from './supervision.dto.js';

/**
 * Supervision des comptes.
 *
 * AUCUNE colonne n'a été ajoutée à `users` pour cet écran, et c'est délibéré.
 * Un `lastRequestAt` sur `users` coûterait une écriture par appel d'API sur la
 * table la plus lue de la base. Le battement de cœur vit donc dans sa propre
 * table, étroite et sans index secondaire (voir `agent_heartbeats`).
 *
 * Six agrégats, six requêtes. Aucune boucle par utilisateur : sur cinquante
 * comptes, un `findMany` par compte ferait trois cents allers-retours pour un
 * écran qui se rafraîchit toutes les quinze secondes.
 */

/**
 * Les deux rôles supervisés. L'ADMIN se supervise dans le miroir, et le
 * SUPERVISEUR avec lui : la présence se lit sur des lots de synchronisation et
 * des tentatives d'appel, qu'aucun des deux ne produit.
 */
const SUPERVISED_ROLES: readonly Role[] = [Role.COMMERCIAL, Role.BANQUE_FINANCE];

/** Durée de vie d'une famille de jetons : au-delà, un compte est dormant quoi qu'il arrive. */
const ACTIVITY_WINDOW_DAYS = 31;

/** `{ userId → date }`, à partir d'un `groupBy` Prisma. */
function toDateMap<K extends string>(
  rows: readonly ({ [key in K]: string } & { _max: { [key: string]: Date | null } })[],
  key: K,
  field: string,
): Map<string, Date> {
  const map = new Map<string, Date>();
  for (const row of rows) {
    const value = row._max[field];
    if (value instanceof Date) map.set(row[key], value);
  }
  return map;
}

/** La plus tardive de deux dates, l'une ou l'autre pouvant manquer. */
function latest(a: Date | undefined, b: Date | undefined): Date | null {
  if (a === undefined) return b ?? null;
  if (b === undefined) return a;
  return a > b ? a : b;
}

const optionalDate = (value: Date | null | undefined): Date | undefined => value ?? undefined;
const isoOrNull = (value: Date | null | undefined): string | null => value?.toISOString() ?? null;

@Injectable()
export class SupervisionService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<SupervisionDto> {
    const now = new Date();
    const since = new Date(now.getTime() - ACTIVITY_WINDOW_DAYS * 86_400_000);

    const [users, sessions, syncs, calls, transitions, heartbeats] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: { in: [...SUPERVISED_ROLES] },
          deletedAt: null,
        },
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          departement: { select: { name: true } },
        },
        orderBy: [{ fullName: 'asc' }],
      }),

      /**
       * Familles de jetons ENCORE VIVANTES. Le filtre porte les deux
       * conditions : `revokedAt: null` élimine les jetons déjà tournés ou
       * révoqués, `expiresAt` élimine les familles mortes de vieillesse, un
       * compte inactif depuis trente et un jours garderait sinon une ligne non
       * révoquée et serait annoncé « en session ».
       */
      this.prisma.refreshToken.groupBy({
        by: ['userId'],
        where: { revokedAt: null, expiresAt: { gt: now } },
        _max: { createdAt: true },
        _count: { _all: true },
      }),

      this.prisma.syncBatch.groupBy({
        by: ['userId'],
        _max: { createdAt: true },
      }),

      this.prisma.callAttempt.groupBy({
        by: ['performedById'],
        where: { createdAt: { gte: since } },
        _max: { createdAt: true },
      }),

      this.prisma.bankCaseTransition.groupBy({
        by: ['performedById'],
        where: { createdAt: { gte: since } },
        _max: { createdAt: true },
      }),

      // Une ligne par compte, jamais davantage : la table entière tient dans la
      // liste ci-dessus, et la filtrer coûterait plus que la lire.
      this.prisma.agentHeartbeat.findMany({
        select: {
          userId: true,
          lastPullAt: true,
          lastPushAt: true,
          pendingOps: true,
          appVersion: true,
        },
      }),
    ]);

    const tokenAt = toDateMap(sessions, 'userId', 'createdAt');
    const sessionCounts = new Map(sessions.map((row) => [row.userId, row._count._all]));
    const syncAt = toDateMap(syncs, 'userId', 'createdAt');
    const callAt = toDateMap(calls, 'performedById', 'createdAt');
    const transitionAt = toDateMap(transitions, 'performedById', 'createdAt');
    const beatOf = new Map(heartbeats.map((row) => [row.userId, row]));

    const rows = users.map((user): SupervisedUserDto => {
      const beat = beatOf.get(user.id) ?? {
        lastPushAt: null,
        lastPullAt: null,
        pendingOps: null,
        appVersion: null,
      };
      const departement = user.departement ?? { name: null };
      const pushedAt = latest(syncAt.get(user.id), optionalDate(beat.lastPushAt));

      const signals: ActivitySignals = {
        isActive: user.isActive,
        hasLiveSession: tokenAt.has(user.id),
        lastLoginAt: user.lastLoginAt,
        lastTokenAt: tokenAt.get(user.id) ?? null,
        // Un pull ne laisse aucune autre trace : sans lui, un appareil ouvert
        // qui n'a rien à remonter passe pour absent pendant des heures.
        lastSyncAt: latest(optionalDate(pushedAt), optionalDate(beat.lastPullAt)),
        // Un téléconseiller écrit des tentatives d'appel, un agent des
        // transitions de dossier. On prend la plus récente des deux plutôt que
        // de brancher sur le rôle : un compte peut changer de rôle, son
        // historique ne change pas.
        lastWriteAt: latest(callAt.get(user.id), transitionAt.get(user.id)),
      };

      return {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        departementName: departement.name,
        presence: presenceOf(signals, now),
        hasLiveSession: signals.hasLiveSession,
        sessionCount: sessionCounts.get(user.id) ?? 0,
        lastSeenAt: isoOrNull(lastSeenAt(signals)),
        lastLoginAt: isoOrNull(signals.lastLoginAt),
        lastSyncAt: isoOrNull(pushedAt),
        lastPullAt: isoOrNull(beat.lastPullAt),
        pendingOps: beat.pendingOps,
        appVersion: beat.appVersion,
        lastWriteAt: isoOrNull(signals.lastWriteAt),
      };
    });

    const counts = countByPresence(rows.map((row) => row.presence));

    return {
      observedAt: now.toISOString(),
      onlineWindowMinutes: PRESENCE_ONLINE_WINDOW_MINUTES,
      teleconseillers: rows.filter((row) => row.role === Role.COMMERCIAL),
      finances: rows.filter((row) => row.role === Role.BANQUE_FINANCE),
      counts: { online: counts.ONLINE, recent: counts.RECENT, away: counts.AWAY },
    };
  }
}
