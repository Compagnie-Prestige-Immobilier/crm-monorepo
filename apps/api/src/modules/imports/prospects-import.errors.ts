import { ConflictException } from '@nestjs/common';

import type { ImportRowError } from './import-adapter.js';

/**
 * Codes de refus de l'import prospects, tous stables.
 *
 * Un code d'erreur d'import n'est pas un détail d'affichage : il finit dans un
 * rapport téléchargé, recopié dans un ticket, et cité au téléphone par la
 * personne qui a rempli le classeur. Le renommer casse toute la chaîne. Le
 * libellé français peut être réécrit à volonté, le code jamais.
 *
 * Les codes sont préfixés `PROSPECT_IMPORT_` et non `IMPORT_` : le moteur
 * générique portera un jour d'autres adaptateurs, et deux familles de codes
 * homonymes rendraient impossible de savoir quel import a refusé la ligne.
 */
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
  NOT_PREPARED: 'PROSPECT_IMPORT_NOT_PREPARED',
} as const;

export type ProspectImportErrorCode =
  (typeof ProspectImportError)[keyof typeof ProspectImportError];

/**
 * Fabrique d'erreur de ligne.
 *
 * `column` est OPTIONNELLE dans le contrat, et `exactOptionalPropertyTypes`
 * interdit de lui passer `undefined` explicitement : la clé doit être absente,
 * pas présente et vide. D'où la construction conditionnelle plutôt qu'un objet
 * littéral unique, qui ne compilerait pas.
 */
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

/**
 * Le référentiel lui-même est inexploitable : deux entrées tombent sur la même
 * clé de rapprochement.
 *
 * On échoue TOUT LE TRAVAIL au lieu de trancher. Rapprocher au hasard entre
 * deux banques homonymes assignerait des prospects à l'une ou à l'autre selon
 * l'ordre de lecture, donc à un segment BDD ou à un autre : une population
 * unique se retrouverait coupée en deux sans que rien ne le signale, et
 * personne ne remonterait jamais de la statistique fausse jusqu'au doublon de
 * référentiel qui l'a produite.
 */
export function referentialAmbiguous(column: string, key: string): ConflictException {
  return new ConflictException({
    code: ProspectImportError.REFERENTIAL_AMBIGUOUS,
    message: `Le référentiel « ${column} » contient deux entrées qui se confondent sur « ${key} ». Corrigez le référentiel avant de relancer l’import.`,
    column,
  });
}

/**
 * `parseRow` a été appelée avant `prepare`.
 *
 * C'est une faute d'enchaînement du moteur, pas une faute de l'utilisateur :
 * elle ne doit surtout pas se déguiser en 150 000 lignes refusées, qui
 * enverraient l'exploitant relire son classeur pendant qu'un défaut de code
 * reste invisible. On lève.
 */
export function notPrepared(): Error {
  return new Error(
    `${ProspectImportError.NOT_PREPARED}: parseRow appelée avant prepare, les référentiels ne sont pas chargés.`,
  );
}
