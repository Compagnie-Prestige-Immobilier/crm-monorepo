import { randomUUID } from 'node:crypto';
import { NotificationStatus, type Prisma } from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';

export const SENDING_LEASE_MS = 15 * 60_000;

export class DispatchClaim {
  private constructor(
    readonly notificationId: string,
    private readonly token: string,
    private readonly prisma: PrismaService,
  ) {}

  static async take(
    prisma: PrismaService,
    notificationId: string,
    now: Date,
  ): Promise<DispatchClaim | null> {
    const leaseExpired = new Date(now.getTime() - SENDING_LEASE_MS);
    const token = randomUUID();

    const claimed = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        OR: [
          { status: NotificationStatus.SCHEDULED, scheduledFor: { lte: now } },
          { status: NotificationStatus.SENDING, dispatchClaim: null },
          { status: NotificationStatus.SENDING, updatedAt: { lt: leaseExpired } },
        ],
      },
      data: { status: NotificationStatus.SENDING, dispatchClaim: token },
    });

    return claimed.count === 1 ? new DispatchClaim(notificationId, token, prisma) : null;
  }

  get fence(): Prisma.NotificationWhereInput {
    return {
      id: this.notificationId,
      status: NotificationStatus.SENDING,
      dispatchClaim: this.token,
    };
  }

  async renew(): Promise<boolean> {
    const renewed = await this.prisma.notification.updateMany({
      where: this.fence,
      data: { status: NotificationStatus.SENDING },
    });
    return renewed.count === 1;
  }
}
