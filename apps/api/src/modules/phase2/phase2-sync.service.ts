import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CallTaskStatus,
  Phase2Status,
  Prisma,
  ScheduledCallbackStatus,
  type EnrollmentMethod,
} from '@crm/database';

import { PHASE2_STATUS_FOR_OUTCOME, isTerminalOutcome, normalizeAttempt } from './attempt-rules.js';
import {
  CallAttemptApplyStatus,
  type CallAttemptOpDto,
  type CallAttemptResultDto,
  type ProspectPhase2StateDto,
} from './dto.js';

export type Phase2TransactionClient = Prisma.TransactionClient;

interface ProspectState {
  id: string;
  phase2Status: Phase2Status;
  enrollmentMethod: EnrollmentMethod | null;
  rev: number;
  updatedAt: Date;
  enrollmentCapturedById: string | null;
  enrollmentCapturedAt: Date | null;
  isDemo: boolean;
}

const PROSPECT_STATE_SELECT = {
  id: true,
  phase2Status: true,
  enrollmentMethod: true,
  rev: true,
  updatedAt: true,
  enrollmentCapturedById: true,
  enrollmentCapturedAt: true,
  isDemo: true,
} satisfies Prisma.ProspectSelect;

const toState = (row: ProspectState): ProspectPhase2StateDto => ({
  prospectId: row.id,
  phase2Status: row.phase2Status,
  enrollmentMethod: row.enrollmentMethod,
  rev: row.rev,
  updatedAt: row.updatedAt.toISOString(),
  capturedById: row.enrollmentCapturedById,
  capturedAt: row.enrollmentCapturedAt?.toISOString() ?? null,
});

const alreadyCompleted = (state: ProspectPhase2StateDto): ConflictException =>
  new ConflictException({
    code: 'PHASE2_ALREADY_COMPLETED',
    message:
      'Ce prospect a déjà été traité par un autre appel. Votre saisie est conservée localement comme conflit ; seul un administrateur peut corriger le dossier.',
    state,
  });

@Injectable()
export class Phase2SyncService {
  async applyCallAttempt(
    tx: Phase2TransactionClient,
    userId: string,
    op: CallAttemptOpDto,
  ): Promise<CallAttemptResultDto> {
    const attempt = normalizeAttempt(op);

    const known = await tx.callAttempt.findUnique({
      where: { id: op.id },
      select: { id: true, taskId: true, task: { select: { status: true } } },
    });

    if (known) {
      const current = await this.loadProspect(tx, op.prospectId);
      return {
        status: CallAttemptApplyStatus.DUPLICATE,
        attemptId: known.id,
        taskId: known.taskId,
        taskStatus: known.task?.status ?? null,
        state: toState(current),
      };
    }

    const prospect = await this.loadProspect(tx, op.prospectId);
    if (prospect.phase2Status !== Phase2Status.PENDING) {
      throw alreadyCompleted(toState(prospect));
    }

    const activeTask = await tx.callTask.findFirst({
      where: { prospectId: op.prospectId, isActive: true },
      select: { id: true, campaignId: true },
      orderBy: { createdAt: 'asc' },
    });

    const inserted = await tx.callAttempt.createMany({
      data: [
        {
          id: op.id,
          prospectId: op.prospectId,
          taskId: activeTask?.id ?? null,
          campaignId: activeTask?.campaignId ?? null,
          performedById: userId,
          outcome: attempt.outcome,
          method: attempt.method,
          comment: attempt.comment,
          clientCreatedAt: new Date(op.clientCreatedAt),
          isDemo: prospect.isDemo,
        },
      ],
      skipDuplicates: true,
    });

    if (inserted.count === 0) {
      const current = await this.loadProspect(tx, op.prospectId);
      return {
        status: CallAttemptApplyStatus.DUPLICATE,
        attemptId: op.id,
        taskId: activeTask?.id ?? null,
        taskStatus: null,
        state: toState(current),
      };
    }

    if (attempt.callbackAt) {
      // L'index unique partiel n'admet qu'un seul rappel PENDING par prospect :
      // sans cette dépose, l'insertion échouerait sur un appel réel.
      await tx.scheduledCallback.updateMany({
        where: { prospectId: op.prospectId, status: ScheduledCallbackStatus.PENDING },
        data: { status: ScheduledCallbackStatus.SUPERSEDED },
      });
      await tx.scheduledCallback.createMany({
        data: [
          {
            prospectId: op.prospectId,
            taskId: activeTask?.id ?? null,
            campaignId: activeTask?.campaignId ?? null,
            assignedToId: userId,
            scheduledAt: attempt.callbackAt,
            comment: attempt.comment,
            sourceAttemptId: op.id,
            isDemo: prospect.isDemo,
          },
        ],
        skipDuplicates: true,
      });
    }

    if (!attempt.terminal || !isTerminalOutcome(attempt.outcome)) {
      return {
        status: CallAttemptApplyStatus.APPLIED,
        attemptId: op.id,
        taskId: activeTask?.id ?? null,
        taskStatus: activeTask ? CallTaskStatus.OPEN : null,
        state: toState(prospect),
      };
    }

    const completedAt = new Date();
    const nextStatus = PHASE2_STATUS_FOR_OUTCOME[attempt.outcome];

    const applied = await tx.prospect.updateMany({
      where: { id: op.prospectId, phase2Status: Phase2Status.PENDING },
      data: {
        phase2Status: nextStatus,
        enrollmentMethod: attempt.method,
        enrollmentCapturedAt: completedAt,
        enrollmentCapturedById: userId,
        rev: { increment: 1 },
      },
    });

    if (applied.count === 0) {
      throw alreadyCompleted(toState(await this.loadProspect(tx, op.prospectId)));
    }

    await tx.callTask.updateMany({
      where: { prospectId: op.prospectId, isActive: true },
      data: { status: CallTaskStatus.DONE, isActive: false, completedAt },
    });

    await tx.scheduledCallback.updateMany({
      where: { prospectId: op.prospectId, status: ScheduledCallbackStatus.PENDING },
      data: { status: ScheduledCallbackStatus.DONE, closedAttemptId: op.id },
    });

    return {
      status: CallAttemptApplyStatus.APPLIED,
      attemptId: op.id,
      taskId: activeTask?.id ?? null,
      taskStatus: activeTask ? CallTaskStatus.DONE : null,
      state: toState(await this.loadProspect(tx, op.prospectId)),
    };
  }

  private async loadProspect(
    tx: Phase2TransactionClient,
    prospectId: string,
  ): Promise<ProspectState> {
    const row = await tx.prospect.findFirst({
      where: { id: prospectId, deletedAt: null },
      select: PROSPECT_STATE_SELECT,
    });

    if (!row) {
      throw new NotFoundException({
        code: 'PHASE2_PROSPECT_NOT_FOUND',
        message: 'Prospect introuvable ou supprimé.',
      });
    }
    return row;
  }
}
