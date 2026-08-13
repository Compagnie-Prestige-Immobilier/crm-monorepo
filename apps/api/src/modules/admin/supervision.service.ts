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
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';

/**
 * Supervision des comptes.
 *
 * AUCUNE colonne n'a été ajoutée au schéma pour cet écran, et c'est délibéré.
 * Une colonne `lastRequestAt` écrite à chaque requête coûterait une écriture
 * par appel d'API sur la table la plus lue de la base, pour une information que
 * les traces existantes portent déjà (voir `presence.ts`).
 *
 * Cinq agrégats, cinq requêtes. Aucune boucle par utilisateur : sur cinquante
 * comptes, un `findMany` par compte ferait deux cent cinquante allers-retours
 * pour un écran qui se rafraîchit toutes les quinze secondes.
 */

/** Les deux rôles supervisés. L'ADMIN se supervise dans le miroir. */
const SUPERVISED_ROLES: readonly Role[] = [Role.COMMERCIAL, Role.BANQUE_FINANCE];

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

@Injectable()
export class SupervisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async overview(): Promise<SupervisionDto> {
    const now = new Date();

    const [users, sessions, syncs, calls, transitions] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: { in: [...SUPERVISED_ROLES] },
          deletedAt: null,
          ...demoScope(await this.demo.enabled()),
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
       * révoqués, `expiresAt` élimine les familles mortes de vieillesse — un
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
        _max: { createdAt: true },
      }),

      this.prisma.bankCaseTransition.groupBy({
        by: ['performedById'],
        _max: { createdAt: true },
      }),
    ]);

    const tokenAt = toDateMap(sessions, 'userId', 'createdAt');
    const sessionCounts = new Map(sessions.map((row) => [row.userId, row._count._all]));
    const syncAt = toDateMap(syncs, 'userId', 'createdAt');
    const callAt = toDateMap(calls, 'performedById', 'createdAt');
    const transitionAt = toDateMap(transitions, 'performedById', 'createdAt');

    const rows = users.map((user): SupervisedUserDto => {
      const signals: ActivitySignals = {
        isActive: user.isActive,
        hasLiveSession: tokenAt.has(user.id),
        lastLoginAt: user.lastLoginAt,
        lastTokenAt: tokenAt.get(user.id) ?? null,
        lastSyncAt: syncAt.get(user.id) ?? null,
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
        departementName: user.departement?.name ?? null,
        presence: presenceOf(signals, now),
        hasLiveSession: signals.hasLiveSession,
        sessionCount: sessionCounts.get(user.id) ?? 0,
        lastSeenAt: lastSeenAt(signals)?.toISOString() ?? null,
        lastLoginAt: signals.lastLoginAt?.toISOString() ?? null,
        lastSyncAt: signals.lastSyncAt?.toISOString() ?? null,
        lastWriteAt: signals.lastWriteAt?.toISOString() ?? null,
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
