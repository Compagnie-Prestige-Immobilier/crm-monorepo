import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { BankStageType } from '@crm/database';

import { BankCaseError } from './errors.js';
import { ZERO_XOF, isStrictlyPositive } from './money.js';

/**
 * Règles du workflow, en fonctions PURES.
 *
 * Elles ne connaissent ni Prisma ni HTTP : c'est ce qui permet de les
 * éprouver exhaustivement, chaque combinaison d'étape, de montant et de motif
 *, sans base de données, et c'est là que vivent les invariants financiers.
 *
 * La règle centrale : un montant n'existe QUE sur un encaissement, un motif
 * QUE sur un rejet, et un dossier ouvert ne porte ni l'un ni l'autre.
 */

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

/** Ce que la transition écrit sur le dossier. Trois champs, toujours les trois. */
export interface TransitionEffect {
  readonly amountXof: string | null;
  readonly rejectionReasonId: string | null;
  readonly rejectionDetail: string | null;
}

/** Code du motif « Autre » : le seul qui exige une précision libre. */
export const OTHER_REJECTION_CODE = 'AUTRE';

const byPosition = (left: WorkflowStage, right: WorkflowStage): number =>
  left.position - right.position || left.id.localeCompare(right.id);

export const activeOpenStages = (stages: readonly WorkflowStage[]): WorkflowStage[] =>
  stages.filter((stage) => stage.isActive && stage.type === BankStageType.OPEN).sort(byPosition);

/**
 * Étape ouverte suivante.
 *
 * Fondée sur la POSITION et non sur un chaînage stocké : réordonner le workflow
 * ne doit toucher que les transitions futures, jamais réécrire l'historique.
 * Une étape désactivée est simplement sautée, les dossiers qui y stationnent
 * restent lisibles et repartent vers la suivante encore active.
 */
export function nextOpenStage(
  stages: readonly WorkflowStage[],
  current: WorkflowStage,
): WorkflowStage | undefined {
  return activeOpenStages(stages).find((stage) => stage.position > current.position);
}

export const lastOpenStage = (stages: readonly WorkflowStage[]): WorkflowStage | undefined =>
  activeOpenStages(stages).at(-1);

export const stageOfType = (
  stages: readonly WorkflowStage[],
  type: BankStageType,
): WorkflowStage | undefined => stages.find((stage) => stage.type === type);

/**
 * Une étape ouverte peut-elle encore recevoir un encaissement ?
 *
 * Non : l'encaissement clôt le parcours, il ne se déclare qu'à la DERNIÈRE
 * étape ouverte active. Autrement dit un dossier « à traiter » ne peut pas
 * sauter la validation bancaire pour être déclaré encaissé.
 */
export function assertReachable(
  stages: readonly WorkflowStage[],
  current: WorkflowStage,
  target: WorkflowStage,
): void {
  if (!target.isActive) {
    throw new ConflictException({
      code: BankCaseError.STAGE_INACTIVE,
      message: `L’étape « ${target.label} » est désactivée : aucun dossier ne peut y être placé.`,
      stageId: target.id,
    });
  }

  if (target.id === current.id) {
    throw new UnprocessableEntityException({
      code: BankCaseError.STAGE_NOT_NEXT,
      message: 'Le dossier est déjà sur cette étape.',
      stageId: target.id,
    });
  }

  // Le rejet est atteignable depuis n'importe quelle étape ouverte : une banque
  // peut refuser un dossier à n'importe quel moment de son instruction.
  if (target.type === BankStageType.REJECTED) return;

  if (target.type === BankStageType.CASHED) {
    const last = lastOpenStage(stages);
    if (!last || last.id !== current.id) {
      throw new UnprocessableEntityException({
        code: BankCaseError.CASHED_NOT_LAST,
        message: `L’encaissement ne se déclare qu’à la dernière étape ouverte du flux (${last?.label ?? 'aucune'}).`,
        expectedStageId: last?.id ?? null,
        currentStageId: current.id,
      });
    }
    return;
  }

  const next = nextOpenStage(stages, current);
  if (!next || next.id !== target.id) {
    throw new UnprocessableEntityException({
      code: BankCaseError.STAGE_NOT_NEXT,
      message: next
        ? `Depuis « ${current.label} », la seule étape ouverte suivante est « ${next.label} ».`
        : `« ${current.label} » est la dernière étape ouverte du flux.`,
      expectedStageId: next?.id ?? null,
      currentStageId: current.id,
    });
  }
}

/**
 * Calcule les trois champs financiers d'une transition, ou refuse.
 *
 * Le montant d'un REJET n'est jamais lu depuis le client : il est forcé à zéro.
 * Un agent qui poste « rejeté, 1 200 000 » décrirait un encaissement rejeté,
 * ce qui n'existe pas, et cette valeur entrerait ensuite dans la somme
 * encaissée du tableau de bord.
 */
export function planTransitionEffect(
  target: WorkflowStage,
  input: TransitionInput,
  rejectionReasonCode: string | undefined,
): TransitionEffect {
  const detail = input.rejectionDetail?.trim();

  if (target.type === BankStageType.CASHED) {
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

  if (target.type === BankStageType.REJECTED) {
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
      // Zéro, et non le montant reçu : voir l'en-tête de la fonction.
      amountXof: ZERO_XOF,
      rejectionReasonId: input.rejectionReasonId,
      rejectionDetail: detail ?? null,
    };
  }

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
