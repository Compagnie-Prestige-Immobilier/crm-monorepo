export interface CallOutcomeReasonSeed {
  code: string;
  label: string;
  effect:
    'CLOSE_METHOD' | 'CLOSE_REFUSED' | 'CLOSE_WRONG_NUMBER' | 'KEEP_OPEN' | 'SCHEDULE_CALLBACK';
  requiresComment: boolean;
  requiresCallback: boolean;
  countsAsReached: boolean;
  color: string;
  sortOrder: number;
}

/**
 * Les codes reprennent `CallOutcome` A L'IDENTIQUE : une tentative deja remontee
 * se resout sans conversion. `minPayloadVersion` vaut 1 pour ces six seuls
 * motifs, les telephones en place savent les emettre.
 */
export const CALL_OUTCOME_REASONS: readonly CallOutcomeReasonSeed[] = [
  {
    code: 'METHOD_OBTAINED',
    label: 'Méthode obtenue',
    effect: 'CLOSE_METHOD',
    requiresComment: false,
    requiresCallback: false,
    countsAsReached: true,
    color: 'success',
    sortOrder: 10,
  },
  {
    code: 'CALLBACK',
    label: 'À rappeler',
    effect: 'SCHEDULE_CALLBACK',
    requiresComment: false,
    requiresCallback: false,
    countsAsReached: true,
    color: 'info',
    sortOrder: 20,
  },
  {
    code: 'UNREACHABLE',
    label: 'Injoignable',
    effect: 'KEEP_OPEN',
    requiresComment: false,
    requiresCallback: false,
    countsAsReached: false,
    color: 'warning',
    sortOrder: 30,
  },
  {
    code: 'REFUSED',
    label: 'Refus',
    effect: 'CLOSE_REFUSED',
    requiresComment: false,
    requiresCallback: false,
    countsAsReached: true,
    color: 'danger',
    sortOrder: 40,
  },
  {
    code: 'WRONG_NUMBER',
    label: 'Mauvais numéro',
    effect: 'CLOSE_WRONG_NUMBER',
    requiresComment: false,
    requiresCallback: false,
    countsAsReached: false,
    color: 'danger',
    sortOrder: 50,
  },
  {
    code: 'OTHER',
    label: 'Autre',
    effect: 'KEEP_OPEN',
    requiresComment: true,
    requiresCallback: false,
    countsAsReached: true,
    color: 'neutral',
    sortOrder: 60,
  },
];
