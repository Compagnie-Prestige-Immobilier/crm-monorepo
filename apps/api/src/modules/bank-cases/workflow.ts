import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { BankStageType } from '@crm/database';

import { BankCaseError } from './errors.js';
import { ZERO_XOF, isStrictlyPositive } from './money.js';

// Règles du workflow en fonctions PURES : un montant n'existe QUE sur un
// encaissement, un motif QUE sur un rejet, un dossier ouvert ne porte ni l'un ni l'autre.
export interface WorkflowStage {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly position: number;
  readonly type: BankStageType;
  readonly isActive: boolean;
  readonly isInitial: boolean;
  readonly isSystem: boolean;
}

export interface TransitionInput {
  readonly amountXof?: string | undefined;
  readonly rejectionReasonId?: string | undefined;
  readonly rejectionDetail?: string | undefined;
}

export interface TransitionEffect {
  readonly amountXof: string | null;
  readonly rejectionReasonId: string | null;
  readonly rejectionDetail: string | null;
}

/** Le seul motif de rejet qui exige une précision libre. */
const OTHER_REJECTION_CODE = 'AUTRE';

const byPosition = (left: WorkflowStage, right: WorkflowStage): number =>
  left.position - right.position || left.id.localeCompare(right.id);

const activeOpenStages = (stages: readonly WorkflowStage[]): WorkflowStage[] =>
  stages.filter((stage) => stage.isActive && stage.type === BankStageType.OPEN).sort(byPosition);

// Fondée sur la POSITION et non sur un chaînage stocké : réordonner le workflow
// ne touche que les transitions futures. Une étape désactivée est sautée.
function nextOpenStage(
  stages: readonly WorkflowStage[],
  current: WorkflowStage,
): WorkflowStage | undefined {
  return activeOpenStages(stages).find((stage) => stage.position > current.position);
}

const lastOpenStage = (stages: readonly WorkflowStage[]): WorkflowStage | undefined =>
  activeOpenStages(stages).at(-1);

function assertTargetActive(target: WorkflowStage): void {
  if (target.isActive) return;
  throw new ConflictException({
    code: BankCaseError.STAGE_INACTIVE,
    message: `L’étape « ${target.label} » est désactivée : aucun dossier ne peut y être placé.`,
    stageId: target.id,
  });
}

function assertTargetDistinct(current: WorkflowStage, target: WorkflowStage): void {
  if (target.id !== current.id) return;
  throw new UnprocessableEntityException({
    code: BankCaseError.STAGE_NOT_NEXT,
    message: 'Le dossier est déjà sur cette étape.',
    stageId: target.id,
  });
}

// L'encaissement ne se déclare qu'à la DERNIÈRE étape ouverte active.
function assertCashedReachable(stages: readonly WorkflowStage[], current: WorkflowStage): void {
  const last = lastOpenStage(stages);
  if (last?.id === current.id) return;
  throw new UnprocessableEntityException({
    code: BankCaseError.CASHED_NOT_LAST,
    message: `L’encaissement ne se déclare qu’à la dernière étape ouverte du flux (${last?.label ?? 'aucune'}).`,
    expectedStageId: last?.id ?? null,
    currentStageId: current.id,
  });
}

// Une étape ouverte ne s'atteint que depuis la précédente (par POSITION).
function assertOpenReachable(
  stages: readonly WorkflowStage[],
  current: WorkflowStage,
  target: WorkflowStage,
): void {
  const next = nextOpenStage(stages, current);
  if (next?.id === target.id) return;
  throw new UnprocessableEntityException({
    code: BankCaseError.STAGE_NOT_NEXT,
    message: next
      ? `Depuis « ${current.label} », la seule étape ouverte suivante est « ${next.label} ».`
      : `« ${current.label} » est la dernière étape ouverte du flux.`,
    expectedStageId: next?.id ?? null,
    currentStageId: current.id,
  });
}

// Fondée sur la POSITION et non sur un chaînage stocké : réordonner le workflow
// ne touche que les transitions futures. Une étape désactivée est sautée.
export function assertReachable(
  stages: readonly WorkflowStage[],
  current: WorkflowStage,
  target: WorkflowStage,
): void {
  assertTargetActive(target);
  assertTargetDistinct(current, target);

  // Une banque peut refuser à n'importe quel moment de l'instruction.
  if (target.type === BankStageType.REJECTED) return;

  if (target.type === BankStageType.CASHED) {
    assertCashedReachable(stages, current);
    return;
  }

  assertOpenReachable(stages, current, target);
}

function planCashedEffect(input: TransitionInput): TransitionEffect {
  if (input.amountXof === undefined) {
    throw new UnprocessableEntityException({
      code: BankCaseError.AMOUNT_REQUIRED,
      message: 'Un encaissement exige un montant.',
    });
  }
  if (!isStrictlyPositive(input.amountXof)) {
    throw new UnprocessableEntityException({
      code: BankCaseError.AMOUNT_REQUIRED,
      message: 'Le montant encaissé doit être strictement positif.',
    });
  }
  if (input.rejectionReasonId !== undefined) {
    throw new UnprocessableEntityException({
      code: BankCaseError.REJECTION_REASON_NOT_ALLOWED,
      message: 'Un encaissement ne porte pas de motif de rejet.',
    });
  }
  return { amountXof: input.amountXof, rejectionReasonId: null, rejectionDetail: null };
}

function planRejectedEffect(
  input: TransitionInput,
  rejectionReasonCode: string | undefined,
): TransitionEffect {
  const detail = input.rejectionDetail?.trim();
  if (input.rejectionReasonId === undefined) {
    throw new UnprocessableEntityException({
      code: BankCaseError.REJECTION_REASON_REQUIRED,
      message: 'Un rejet exige un motif.',
    });
  }
  if (rejectionReasonCode === OTHER_REJECTION_CODE && !detail) {
    throw new UnprocessableEntityException({
      code: BankCaseError.REJECTION_DETAIL_REQUIRED,
      message: 'Le motif « Autre » exige une précision : sans elle, la statistique est aveugle.',
    });
  }
  return {
    // Zéro, et non le montant reçu : « rejeté, 1 200 000 » entrerait sinon
    // dans la somme encaissée du tableau de bord.
    amountXof: ZERO_XOF,
    rejectionReasonId: input.rejectionReasonId,
    rejectionDetail: detail ?? null,
  };
}

function planOpenEffect(input: TransitionInput): TransitionEffect {
  if (input.amountXof !== undefined) {
    throw new UnprocessableEntityException({
      code: BankCaseError.AMOUNT_NOT_ALLOWED,
      message: 'Un dossier en cours d’instruction ne porte pas de montant.',
    });
  }
  if (input.rejectionReasonId !== undefined) {
    throw new UnprocessableEntityException({
      code: BankCaseError.REJECTION_REASON_NOT_ALLOWED,
      message: 'Un dossier en cours d’instruction ne porte pas de motif de rejet.',
    });
  }
  return { amountXof: null, rejectionReasonId: null, rejectionDetail: null };
}

// Un montant n'est accepté QUE vers un encaissement, un motif QUE vers un
// rejet, et le montant d'un rejet est forcé à zéro sans jamais être lu du client.
export function planTransitionEffect(
  target: WorkflowStage,
  input: TransitionInput,
  rejectionReasonCode: string | undefined,
): TransitionEffect {
  if (target.type === BankStageType.CASHED) return planCashedEffect(input);
  if (target.type === BankStageType.REJECTED) return planRejectedEffect(input, rejectionReasonCode);
  return planOpenEffect(input);
}
