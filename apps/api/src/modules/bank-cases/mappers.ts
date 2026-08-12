import { BankStageType } from '@crm/database';
import type { BankCaseStage, BankRejectionReason, Prisma } from '@crm/database';

import { moneyToString } from './money.js';
import type {
  BankCaseDto,
  BankCaseStageDto,
  BankCaseTransitionDto,
  BankRejectionReasonDto,
} from './dto.js';

export const BANK_CASE_INCLUDE = {
  currentStage: true,
  processingBank: { select: { id: true, name: true } },
  rejectionReason: true,
  createdBy: { select: { id: true, fullName: true } },
  updatedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.BankCaseInclude;

export const BANK_TRANSITION_INCLUDE = {
  fromStage: true,
  toStage: true,
  rejectionReason: true,
  performedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.BankCaseTransitionInclude;

export type BankCaseRow = Prisma.BankCaseGetPayload<{ include: typeof BANK_CASE_INCLUDE }>;
export type BankTransitionRow = Prisma.BankCaseTransitionGetPayload<{
  include: typeof BANK_TRANSITION_INCLUDE;
}>;

export const isTerminalStage = (stage: Pick<BankCaseStage, 'type'>): boolean =>
  stage.type !== BankStageType.OPEN;

export function toStageDto(stage: BankCaseStage): BankCaseStageDto {
  return {
    id: stage.id,
    code: stage.code,
    label: stage.label,
    position: stage.position,
    color: stage.color,
    type: stage.type,
    isActive: stage.isActive,
    isInitial: stage.isInitial,
    isSystem: stage.isSystem,
  };
}

export function toReasonDto(reason: BankRejectionReason): BankRejectionReasonDto {
  return {
    id: reason.id,
    code: reason.code,
    label: reason.label,
    sortOrder: reason.sortOrder,
    isActive: reason.isActive,
  };
}

export function toBankCaseDto(row: BankCaseRow): BankCaseDto {
  return {
    id: row.id,
    reference: row.reference,
    referenceKey: row.referenceKey,
    prospectId: row.prospectId,
    customerName: row.customerName,
    customerPhoneE164: row.customerPhoneE164,
    processingBankId: row.processingBankId,
    processingBankName: row.processingBank.name,
    currentStage: toStageDto(row.currentStage),
    amountXof: moneyToString(row.amountXof),
    rejectionReason: row.rejectionReason ? toReasonDto(row.rejectionReason) : null,
    rejectionDetail: row.rejectionDetail,
    rev: row.rev,
    isTerminal: isTerminalStage(row.currentStage),
    createdById: row.createdById,
    createdByName: row.createdBy.fullName,
    updatedById: row.updatedById,
    updatedByName: row.updatedBy?.fullName ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTransitionDto(row: BankTransitionRow): BankCaseTransitionDto {
  return {
    id: row.id,
    caseId: row.caseId,
    fromStage: row.fromStage ? toStageDto(row.fromStage) : null,
    toStage: toStageDto(row.toStage),
    performedById: row.performedById,
    performedByName: row.performedBy.fullName,
    amountXof: moneyToString(row.amountXof),
    rejectionReason: row.rejectionReason ? toReasonDto(row.rejectionReason) : null,
    rejectionDetail: row.rejectionDetail,
    comment: row.comment,
    correctionReason: row.correctionReason,
    createdAt: row.createdAt.toISOString(),
  };
}
