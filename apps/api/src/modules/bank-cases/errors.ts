import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

/**
 * Erreurs métier du module, toutes typées par un `code` stable.
 *
 * Aucune de ces situations ne doit remonter en 500. Les invariants sont posés
 * DEUX FOIS — ici et en contrainte PostgreSQL — et ce n'est pas une redondance
 * inutile : la base est la vérité en cas de course, le service est ce qui
 * permet au client de savoir quoi corriger. Une contrainte qui remonte nue
 * produit « erreur interne » là où l'agent attend « ce numéro de dossier est
 * déjà pris, en voici le titulaire ».
 */

export const BankCaseError = {
  PROSPECT_NOT_FOUND: 'BANK_CASE_PROSPECT_NOT_FOUND',
  PROSPECT_NOT_ENROLLED: 'BANK_CASE_PROSPECT_NOT_ENROLLED',
  BANK_NOT_FOUND: 'BANK_CASE_BANK_NOT_FOUND',
  NOT_FOUND: 'BANK_CASE_NOT_FOUND',
  REFERENCE_CONFLICT: 'BANK_CASE_REFERENCE_CONFLICT',
  REV_CONFLICT: 'BANK_CASE_REV_CONFLICT',
  TERMINAL: 'BANK_CASE_TERMINAL',
  STAGE_NOT_FOUND: 'BANK_STAGE_NOT_FOUND',
  STAGE_INACTIVE: 'BANK_STAGE_INACTIVE',
  STAGE_NOT_NEXT: 'BANK_STAGE_NOT_NEXT',
  CASHED_NOT_LAST: 'BANK_STAGE_CASHED_NOT_LAST',
  AMOUNT_REQUIRED: 'BANK_CASE_AMOUNT_REQUIRED',
  AMOUNT_NOT_ALLOWED: 'BANK_CASE_AMOUNT_NOT_ALLOWED',
  REJECTION_REASON_REQUIRED: 'BANK_CASE_REJECTION_REASON_REQUIRED',
  REJECTION_REASON_NOT_ALLOWED: 'BANK_CASE_REJECTION_REASON_NOT_ALLOWED',
  REJECTION_REASON_NOT_FOUND: 'BANK_CASE_REJECTION_REASON_NOT_FOUND',
  REJECTION_DETAIL_REQUIRED: 'BANK_CASE_REJECTION_DETAIL_REQUIRED',
  NO_INITIAL_STAGE: 'BANK_WORKFLOW_NO_INITIAL_STAGE',
  NO_CASHED_STAGE: 'BANK_WORKFLOW_NO_CASHED_STAGE',
  STAGE_CODE_CONFLICT: 'BANK_STAGE_CODE_CONFLICT',
  STAGE_SYSTEM_IMMUTABLE: 'BANK_STAGE_SYSTEM_IMMUTABLE',
  STAGE_HAS_OPEN_CASES: 'BANK_STAGE_HAS_OPEN_CASES',
  STAGE_REORDER_INCOMPLETE: 'BANK_STAGE_REORDER_INCOMPLETE',
  STAGE_INITIAL_MUST_BE_FIRST: 'BANK_STAGE_INITIAL_MUST_BE_FIRST',
} as const;

export const caseNotFound = (): NotFoundException =>
  new NotFoundException({
    code: BankCaseError.NOT_FOUND,
    message: 'Dossier bancaire introuvable.',
  });

export const stageNotFound = (): NotFoundException =>
  new NotFoundException({ code: BankCaseError.STAGE_NOT_FOUND, message: 'Étape introuvable.' });

export const prospectNotFound = (): NotFoundException =>
  new NotFoundException({
    code: BankCaseError.PROSPECT_NOT_FOUND,
    message: 'Prospect introuvable ou supprimé.',
  });

/**
 * Hypothèse produit VERROUILLÉE : un dossier bancaire suit l'enrôlement. Le
 * message nomme le statut réellement rencontré, sans quoi l'agent ne peut pas
 * savoir s'il doit relancer la phase 2 ou s'il s'est trompé de personne.
 */
export const prospectNotEnrolled = (
  phase2Status: string,
  prospectId: string,
): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: BankCaseError.PROSPECT_NOT_ENROLLED,
    message: `Un dossier bancaire ne peut être ouvert que sur un prospect dont la méthode d’enrôlement est obtenue. Statut phase 2 actuel : ${phase2Status}.`,
    prospectId,
    phase2Status,
  });

export const bankNotFound = (bankId: string): BadRequestException =>
  new BadRequestException({
    code: BankCaseError.BANK_NOT_FOUND,
    message: 'Banque de traitement inconnue.',
    bankId,
  });

/** Porte l'identifiant du dossier existant : le client peut y renvoyer l'agent. */
export const referenceConflict = (existing: {
  id: string;
  reference: string;
  referenceKey: string;
  customerName: string;
  createdAt: Date;
}): ConflictException =>
  new ConflictException({
    code: BankCaseError.REFERENCE_CONFLICT,
    message: `La référence « ${existing.reference} » est déjà portée par un autre dossier.`,
    existing: {
      id: existing.id,
      reference: existing.reference,
      referenceKey: existing.referenceKey,
      customerName: existing.customerName,
      createdAt: existing.createdAt.toISOString(),
    },
  });

/**
 * Conflit de révision. Le corps EMBARQUE l'état courant : l'interface peut
 * montrer ce que l'autre agent a fait au lieu de demander un rechargement à
 * l'aveugle, et l'agent décide en connaissance de cause.
 */
export const revConflict = (current: { rev: number }): ConflictException =>
  new ConflictException({
    code: BankCaseError.REV_CONFLICT,
    message:
      'Le dossier a été modifié entre-temps par un autre utilisateur. Vérifiez l’état courant avant de réessayer.',
    currentRev: current.rev,
    current,
  });

export const terminalCase = (stageLabel: string): ConflictException =>
  new ConflictException({
    code: BankCaseError.TERMINAL,
    message: `Ce dossier est en étape terminale (${stageLabel}). Seul un administrateur peut le corriger, avec justification.`,
    stageLabel,
  });
