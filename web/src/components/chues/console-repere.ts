import { CALL_OUTCOME_LABELS, type CallOutcome, type Prospect } from '@/lib/data/console';
import { formatDateTime } from '@/lib/format';

/** Seule issue encore atteignable au clavier une fois le dossier ouvert. */
export const RAPPEL_KEY = '2';

/** Ce que l'appel a donné, avant tout : la personne était-elle joignable. */
export const ISSUES: readonly {
  key: string;
  label: string;
  outcome: CallOutcome | 'JOIGNABLE';
}[] = [
  { key: '1', label: 'Joignable', outcome: 'JOIGNABLE' },
  { key: RAPPEL_KEY, label: CALL_OUTCOME_LABELS.CALLBACK, outcome: 'CALLBACK' },
  { key: '3', label: CALL_OUTCOME_LABELS.UNREACHABLE, outcome: 'UNREACHABLE' },
  { key: '4', label: CALL_OUTCOME_LABELS.WRONG_NUMBER, outcome: 'WRONG_NUMBER' },
  { key: '5', label: 'Autre', outcome: 'OTHER' },
];

export const CARTE_CLAVIER: readonly (readonly [string, string])[] = [
  ['1', 'Joignable : ouvre le dossier et l’adhésion'],
  ['2', 'À rappeler, puis échéance'],
  ['3', 'Injoignable'],
  ['4', 'Mauvais numéro'],
  ['5', 'Autre, puis commentaire'],
  ['1 … 6', 'Échéance proposée, après 2'],
  ['0', 'Saisir une autre échéance, après 2'],
  ['Entrée', 'Valider'],
  ['Échap', 'Revenir en arrière, ou effacer la saisie en cours'],
  ['C', 'Copier le numéro'],
  ['N', 'Ajouter un prospect sur ce représentant'],
  ['R', 'Fiche du représentant'],
  ['?', 'Afficher cette carte'],
];

export function resumeDernierAppel(prospect: Prospect): string {
  const commentaire = prospect.lastComment === null ? '' : ` · « ${prospect.lastComment} »`;
  if (prospect.lastAttemptAt === null) return `Jamais appelée.${commentaire}`;
  const issue =
    prospect.lastOutcome === null
      ? ''
      : ` · ${CALL_OUTCOME_LABELS[prospect.lastOutcome as CallOutcome] ?? prospect.lastOutcome}`;
  return `Dernier appel : ${formatDateTime(prospect.lastAttemptAt)}${issue}${commentaire}`;
}
