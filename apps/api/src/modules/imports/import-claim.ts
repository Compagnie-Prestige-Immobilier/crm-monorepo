import { randomUUID } from 'node:crypto';
import { ImportStatus, type Prisma } from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { IMPORT_CLOCK_SKEW_TOLERANCE_MS, IMPORT_LEASE_MS } from './imports.job.js';

export class ImportClaim {
  private constructor(
    readonly jobId: string,
    private readonly token: string,
    private readonly prisma: PrismaService,
  ) {}

  static async take(prisma: PrismaService, jobId: string, now: Date): Promise<ImportClaim | null> {
    const leaseExpired = new Date(now.getTime() - IMPORT_LEASE_MS);
    const clockJumpedBack = new Date(now.getTime() + IMPORT_CLOCK_SKEW_TOLERANCE_MS);
    const inFlight = [ImportStatus.queued, ImportStatus.running];
    const token = randomUUID();

    const claimed = await prisma.importJob.updateMany({
      where: {
        id: jobId,
        OR: [
          { status: ImportStatus.queued, claimedAt: null },
          { status: { in: inFlight }, claimedAt: { lt: leaseExpired } },
          { status: { in: inFlight }, claimedAt: { gt: clockJumpedBack } },
        ],
      },
      data: { status: ImportStatus.running, claimToken: token, claimedAt: now },
    });

    return claimed.count === 1 ? new ImportClaim(jobId, token, prisma) : null;
  }

  get fence(): Prisma.ImportJobWhereInput {
    return { id: this.jobId, claimToken: this.token };
  }

  async write(data: Prisma.ImportJobUpdateManyMutationInput, now: Date): Promise<boolean> {
    const written = await this.prisma.importJob.updateMany({
      where: this.fence,
      data: { ...data, claimedAt: now },
    });
    return written.count === 1;
  }

  async writeIn(
    tx: Prisma.TransactionClient,
    data: Prisma.ImportJobUpdateManyMutationInput,
    now: Date,
  ): Promise<boolean> {
    const written = await tx.importJob.updateMany({
      where: this.fence,
      data: { ...data, claimedAt: now },
    });
    return written.count === 1;
  }
}
