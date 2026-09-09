import { randomUUID } from 'node:crypto';
import { NotificationStatus, type Prisma } from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';

export const SENDING_LEASE_MS = 15 * 60_000;

/**
 * Bail d'expédition, posé sur TOUTE une vague par une seule écriture.
 *
 * Le jeton est commun à la vague, la vérification reste individuelle : `take`
 * ne dit pas ce qu'il a pris, c'est la relecture des envois qui le dit, et
 * `holding` resserre le bail sur ceux qui portent bien ce jeton. Chaque
 * écriture ultérieure le reporte dans son `where`, donc un expéditeur évincé
 * n'écrit plus rien, envoi par envoi.
 */
export class DispatchClaim {
  private constructor(
    private readonly prisma: PrismaService,
    readonly token: string,
    readonly notificationIds: readonly string[],
  ) {}

  static async take(
    prisma: PrismaService,
    notificationIds: readonly string[],
    now: Date,
  ): Promise<DispatchClaim> {
    const leaseExpired = new Date(now.getTime() - SENDING_LEASE_MS);
    const token = randomUUID();

    await prisma.notification.updateMany({
      where: {
        id: { in: [...notificationIds] },
        OR: [
          { status: NotificationStatus.SCHEDULED, scheduledFor: { lte: now } },
          { status: NotificationStatus.SENDING, dispatchClaim: null },
          { status: NotificationStatus.SENDING, updatedAt: { lt: leaseExpired } },
        ],
      },
      data: { status: NotificationStatus.SENDING, dispatchClaim: token },
    });

    return new DispatchClaim(prisma, token, []);
  }

  holding(notificationIds: readonly string[]): DispatchClaim {
    return new DispatchClaim(this.prisma, this.token, notificationIds);
  }

  get fence(): Prisma.NotificationWhereInput {
    return {
      id: { in: [...this.notificationIds] },
      status: NotificationStatus.SENDING,
      dispatchClaim: this.token,
    };
  }

  /** Faux dès qu'un seul envoi de la vague a changé de mains. */
  async renew(): Promise<boolean> {
    const renewed = await this.prisma.notification.updateMany({
      where: this.fence,
      data: { status: NotificationStatus.SENDING },
    });
    return renewed.count === this.notificationIds.length;
  }
}
