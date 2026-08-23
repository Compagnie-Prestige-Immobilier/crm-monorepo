import type { Prisma } from '@crm/database';

import type { AuthenticatedUser } from './decorators/current-user.decorator.js';

/**
 * Journal des gestes d'administration et d'encadrement.
 *
 * `AuditLog` existait, complet, et n'était écrit que par la purge et l'export
 * de base : après coup, on ne pouvait répondre ni à « qui a promu ce compte »,
 * ni à « qui a repris les 300 fiches de ce commercial ». Ce helper est le seul
 * point d'écriture, pour que la question « est-ce tracé » ait une réponse à un
 * seul endroit.
 *
 * `tx` et non `prisma` : la trace appartient à la transaction du geste. Écrite
 * dehors, elle survivrait à un geste annulé, ou manquerait à un geste réussi.
 */
export interface AuditEntry {
  action: string;
  entity: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

export function audit(
  tx: AuditClient,
  user: Pick<AuthenticatedUser, 'id'>,
  entry: AuditEntry,
): Promise<unknown> {
  return tx.auditLog.create({
    data: {
      userId: user.id,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      ...(entry.before === undefined ? {} : { before: entry.before }),
      ...(entry.after === undefined ? {} : { after: entry.after }),
    },
  });
}

/** Les actions tracées, nommées une fois : un littéral en double se perd. */
export const AuditAction = {
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_ROLE_CHANGE: 'user.role_change',
  USER_SET_ACTIVE: 'user.set_active',
  USER_DELETE: 'user.delete',
  USER_RESET_PASSWORD: 'user.reset_password',
  PROSPECT_REASSIGN: 'prospect.reassign',
  PROSPECT_MERGE: 'prospect.merge',
  PROSPECT_DELETE: 'prospect.delete',
  JOURNEY_CLOSE: 'prospect_journey.close',
  PORTFOLIO_HANDOVER: 'portfolio.handover',
} as const;
