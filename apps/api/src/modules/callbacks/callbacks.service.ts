import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ScheduledCallbackStatus } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';
import { dakarWallClock, inclusiveDateTo } from '../../common/date-bounds.js';
import { isAdmin, readsEveryone } from '../../common/scope.js';
import { shortCode } from '../../common/short-code.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import {
  CallbackScope,
  type CallbackDto,
  type CallbackListDto,
  type CallbackQueryDto,
} from './dto.js';

/** Une journée de travail au téléphone n'en compte pas davantage. */
const MAX_ROWS = 500;

/** Fin de la journée à Dakar, décalée de `plusDays`, aux bornes déjà en place. */
export function dakarDayEnd(now: Date, plusDays: number): Date {
  const { year, month, day } = dakarWallClock(now);
  const shifted = new Date(Date.UTC(year, month - 1, day + plusDays));
  return inclusiveDateTo(shifted.toISOString().slice(0, 10));
}

const CALLBACK_SELECT = {
  id: true,
  prospectId: true,
  scheduledAt: true,
  comment: true,
  assignedToId: true,
  campaignId: true,
  taskId: true,
  prospect: { select: { phoneE164: true } },
  assignedTo: { select: { fullName: true } },
} satisfies Prisma.ScheduledCallbackSelect;

type CallbackRow = Prisma.ScheduledCallbackGetPayload<{ select: typeof CALLBACK_SELECT }>;

const toDto = (row: CallbackRow, now: Date): CallbackDto => ({
  id: row.id,
  prospectId: row.prospectId,
  shortCode: shortCode(row.prospectId),
  phoneE164: row.prospect.phoneE164,
  scheduledAt: row.scheduledAt.toISOString(),
  comment: row.comment,
  assignedToId: row.assignedToId,
  assignedToName: row.assignedTo.fullName,
  campaignId: row.campaignId,
  taskId: row.taskId,
  overdue: row.scheduledAt.getTime() < now.getTime(),
});

@Injectable()
export class CallbacksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  /**
   * File des rappels encore dus. Le RETARD n'est pas un statut : un rappel de
   * la veille reste PENDING et remonte dans la journée courante, ce qui évite
   * un balayage nocturne pour une information que `scheduledAt` porte déjà.
   */
  async list(user: AuthenticatedUser, query: CallbackQueryDto): Promise<CallbackListDto> {
    const now = new Date();
    const scope = query.scope ?? CallbackScope.TODAY;
    const assignedToId = readsEveryone(user) ? query.assignedToId : user.id;

    const where: Prisma.ScheduledCallbackWhereInput = {
      ...demoScope(await this.demo.enabled()),
      status: ScheduledCallbackStatus.PENDING,
      ...(assignedToId === undefined ? {} : { assignedToId }),
      scheduledAt:
        scope === CallbackScope.OVERDUE
          ? { lt: now }
          : { lte: dakarDayEnd(now, scope === CallbackScope.WEEK ? 6 : 0) },
    };

    const rows = await this.prisma.scheduledCallback.findMany({
      where,
      select: CALLBACK_SELECT,
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: MAX_ROWS,
    });

    return { items: rows.map((row) => toDto(row, now)), serverTime: now.toISOString() };
  }

  /** Idempotent : un rappel déjà clos ou annulé est rendu tel quel. */
  async cancel(user: AuthenticatedUser, id: string): Promise<CallbackDto> {
    const now = new Date();
    const row = await this.prisma.scheduledCallback.findFirst({
      where: { id, ...demoScope(await this.demo.enabled()) },
      select: { ...CALLBACK_SELECT, status: true },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'CALLBACK_NOT_FOUND',
        message: 'Rappel introuvable.',
      });
    }

    if (!isAdmin(user) && row.assignedToId !== user.id) {
      throw new ForbiddenException({
        code: 'NOT_OWNER',
        message: 'Ce rappel a été promis par un autre téléconseiller.',
      });
    }

    if (row.status !== ScheduledCallbackStatus.PENDING) return toDto(row, now);

    await this.prisma.scheduledCallback.updateMany({
      where: { id, status: ScheduledCallbackStatus.PENDING },
      data: { status: ScheduledCallbackStatus.CANCELLED },
    });

    return toDto(row, now);
  }
}
