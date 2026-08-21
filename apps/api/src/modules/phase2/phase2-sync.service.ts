import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CallTaskStatus,
  Phase2Status,
  Prisma,
  ScheduledCallbackStatus,
  type EnrollmentMethod,
} from '@crm/database';

import { normalizeAttempt, systemReasonFor, type AttemptReason } from './attempt-rules.js';
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
}

const PROSPECT_STATE_SELECT = {
  id: true,
  phase2Status: true,
  enrollmentMethod: true,
  rev: true,
  updatedAt: true,
  enrollmentCapturedById: true,
  enrollmentCapturedAt: true,
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

const REASON_SELECT = {
  id: true,
  code: true,
  label: true,
  effect: true,
  requiresComment: true,
  requiresCallback: true,
  isActive: true,
} satisfies Prisma.CallOutcomeReasonSelect;

export const PHASE2_REASON_UNKNOWN = 'PHASE2_REASON_UNKNOWN';
export const PHASE2_REASON_INACTIVE = 'PHASE2_REASON_INACTIVE';
export const PHASE2_REASON_OUTCOME_MISMATCH = 'PHASE2_REASON_OUTCOME_MISMATCH';

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
    const attempt = normalizeAttempt(op, await this.resolveReason(tx, op));

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
          reasonId: attempt.reasonId,
          method: attempt.method,
          comment: attempt.comment,
          clientCreatedAt: new Date(op.clientCreatedAt),
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
          },
        ],
        skipDuplicates: true,
      });
    }

    if (!attempt.terminal || attempt.phase2Status === null) {
      return {
        status: CallAttemptApplyStatus.APPLIED,
        attemptId: op.id,
        taskId: activeTask?.id ?? null,
        taskStatus: activeTask ? CallTaskStatus.OPEN : null,
        state: toState(prospect),
      };
    }

    const completedAt = new Date();
    const nextStatus = attempt.phase2Status;

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

  /**
   * Un motif système absent de la table ne fait PAS échouer la remontée : la
   * règle compilée reste la référence et la tentative part sans `reasonId`.
   * Refuser ici condamnerait la file d'un téléphone hors ligne, définitivement.
   */
  private async resolveReason(
    tx: Phase2TransactionClient,
    op: CallAttemptOpDto,
  ): Promise<AttemptReason> {
    const claimed = op.reasonCode?.trim().toUpperCase() ?? '';
    const code = claimed === '' ? op.outcome : claimed;

    const row = await tx.callOutcomeReason.findUnique({ where: { code }, select: REASON_SELECT });

    if (row === null) {
      if (claimed === '') return systemReasonFor(op.outcome);
      throw new BadRequestException({
        code: PHASE2_REASON_UNKNOWN,
        message: `Motif d’issue inconnu : ${code}.`,
      });
    }

    if (claimed !== '') {
      if (!row.isActive) {
        throw new BadRequestException({
          code: PHASE2_REASON_INACTIVE,
          message: `Le motif « ${row.label} » a été retiré du référentiel.`,
        });
      }
      if (row.effect !== systemReasonFor(op.outcome).effect) {
        throw new BadRequestException({
          code: PHASE2_REASON_OUTCOME_MISMATCH,
          message: `Le motif « ${row.label} » ne produit pas l’issue ${op.outcome}.`,
        });
      }
    }

    return {
      id: row.id,
      code: row.code,
      label: row.label,
      effect: row.effect,
      requiresComment: row.requiresComment,
      requiresCallback: row.requiresCallback,
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
