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
  type Projet,
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
  projet: Projet;
  rev: number;
  updatedAt: Date;
}

/** L'état de phase 2 vit sur le PARCOURS ; la fiche ne porte plus que sa révision. */
interface JourneyState {
  id: string;
  phase2Status: Phase2Status;
  enrollmentMethod: EnrollmentMethod | null;
  enrollmentCapturedById: string | null;
  enrollmentCapturedAt: Date | null;
}

const PROSPECT_STATE_SELECT = {
  id: true,
  projet: true,
  rev: true,
  updatedAt: true,
} satisfies Prisma.ProspectSelect;

const JOURNEY_STATE_SELECT = {
  id: true,
  phase2Status: true,
  enrollmentMethod: true,
  enrollmentCapturedById: true,
  enrollmentCapturedAt: true,
} satisfies Prisma.ProspectJourneySelect;

const toState = (row: ProspectState, journey: JourneyState): ProspectPhase2StateDto => ({
  prospectId: row.id,
  phase2Status: journey.phase2Status,
  enrollmentMethod: journey.enrollmentMethod,
  rev: row.rev,
  updatedAt: row.updatedAt.toISOString(),
  capturedById: journey.enrollmentCapturedById,
  capturedAt: journey.enrollmentCapturedAt?.toISOString() ?? null,
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
        state: toState(current, await this.loadJourney(tx, op.prospectId, current.projet)),
      };
    }

    const prospect = await this.loadProspect(tx, op.prospectId);

    const activeTask = await tx.callTask.findFirst({
      where: { prospectId: op.prospectId, isActive: true },
      select: { id: true, campaignId: true, campaign: { select: { projet: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // La phase 2 est un état du PARCOURS. Portée par la fiche, elle rendait un
    // prospect refusé en CHUES définitivement inappelable en Grand Public : la
    // campagne le tirait quand même et chaque tentative revenait en 409, ce qui
    // bloquait sur le téléphone toute la partition de file de ce prospect.
    //
    // Le projet vient de la CAMPAGNE qui a confié la tâche ; sans tâche, c'est
    // le projet d'entrée de la fiche.
    const projet = activeTask?.campaign.projet ?? prospect.projet;
    const journey = await this.loadJourney(tx, op.prospectId, projet);
    if (journey.phase2Status !== Phase2Status.PENDING) {
      throw alreadyCompleted(toState(prospect, journey));
    }

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
        state: toState(current, await this.loadJourney(tx, op.prospectId, projet)),
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
        state: toState(prospect, journey),
      };
    }

    const completedAt = new Date();
    const nextStatus = attempt.phase2Status;

    // Compare-and-swap sur le PARCOURS : c'est lui qui arbitre désormais « la
    // première transition terminale validée gagne ».
    const applied = await tx.prospectJourney.updateMany({
      where: { id: journey.id, phase2Status: Phase2Status.PENDING },
      data: {
        phase2Status: nextStatus,
        enrollmentMethod: attempt.method,
        enrollmentCapturedAt: completedAt,
        enrollmentCapturedById: userId,
      },
    });

    if (applied.count === 0) {
      const relu = await this.loadProspect(tx, op.prospectId);
      throw alreadyCompleted(toState(relu, await this.loadJourney(tx, op.prospectId, projet)));
    }

    // La fiche reste le REFLET du parcours d'entrée : le contrat de
    // synchronisation l'expose encore et un APK déployé le lit. Elle n'est plus
    // l'autorité.
    if (projet === prospect.projet) {
      await tx.prospect.updateMany({
        where: { id: op.prospectId },
        data: {
          phase2Status: nextStatus,
          enrollmentMethod: attempt.method,
          enrollmentCapturedAt: completedAt,
          enrollmentCapturedById: userId,
          rev: { increment: 1 },
        },
      });
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
      state: toState(
        await this.loadProspect(tx, op.prospectId),
        await this.loadJourney(tx, op.prospectId, projet),
      ),
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

  /**
   * Le parcours est ouvert à la volée s'il n'existe pas : une fiche importée
   * sans parcours doit rester appelable, et refuser ici transformerait une
   * lacune de données en échec définitif sur le téléphone.
   */
  private async loadJourney(
    tx: Phase2TransactionClient,
    prospectId: string,
    projet: Projet,
  ): Promise<JourneyState> {
    return tx.prospectJourney.upsert({
      where: { prospectId_projet: { prospectId, projet } },
      create: { prospectId, projet },
      update: {},
      select: JOURNEY_STATE_SELECT,
    });
  }
}
