import { ConflictException } from '@nestjs/common';

import type { ImportRowError } from './import-adapter.js';

export const ProspectImportError = {
  NOM_REQUIRED: 'PROSPECT_IMPORT_NOM_REQUIRED',
  PRENOM_REQUIRED: 'PROSPECT_IMPORT_PRENOM_REQUIRED',
  PHONE_INVALID: 'PROSPECT_IMPORT_PHONE_INVALID',
  REPRESENTANT_PHONE_INVALID: 'PROSPECT_IMPORT_REPRESENTANT_PHONE_INVALID',
  REPRESENTANT_UNKNOWN: 'PROSPECT_IMPORT_REPRESENTANT_UNKNOWN',
  BANQUE_UNKNOWN: 'PROSPECT_IMPORT_BANQUE_UNKNOWN',
  SYNDICAT_UNKNOWN: 'PROSPECT_IMPORT_SYNDICAT_UNKNOWN',
  ENROLLMENT_METHOD_UNKNOWN: 'PROSPECT_IMPORT_ENROLLMENT_METHOD_UNKNOWN',
  DUPLICATE_IN_FILE: 'PROSPECT_IMPORT_DUPLICATE_IN_FILE',
  DUPLICATE_IN_DATABASE: 'PROSPECT_IMPORT_DUPLICATE_IN_DATABASE',
  ATTACHED_TO_OTHER_REPRESENTANT: 'PROSPECT_IMPORT_ATTACHED_TO_OTHER_REPRESENTANT',
  REFERENTIAL_AMBIGUOUS: 'PROSPECT_IMPORT_REFERENTIAL_AMBIGUOUS',
} as const;

export type ProspectImportErrorCode =
  (typeof ProspectImportError)[keyof typeof ProspectImportError];

export function rowError(input: {
  rowNumber: number;
  code: ProspectImportErrorCode;
  message: string;
  column?: string;
}): ImportRowError {
  return input.column === undefined
    ? { rowNumber: input.rowNumber, code: input.code, message: input.message }
    : {
        rowNumber: input.rowNumber,
        column: input.column,
        code: input.code,
        message: input.message,
      };
}

export function referentialAmbiguous(column: string, key: string): ConflictException {
  return new ConflictException({
    code: ProspectImportError.REFERENTIAL_AMBIGUOUS,
    message: `Le référentiel « ${column} » contient deux entrées qui se confondent sur « ${key} ». Corrigez le référentiel avant de relancer l’import.`,
    column,
  });
}
