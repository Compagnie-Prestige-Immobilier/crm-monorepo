import { CallOutcome, Phase2Status } from '@crm/database';

import { CALL_OUTCOME_LABELS } from '../prospects/phase2-labels.js';

/**
 * Miroir de l'énumération Prisma `CallOutcomeEffect`. À remplacer par l'import
 * généré dès que `packages/database` porte le modèle.
 */
export const CallOutcomeEffect = {
  CLOSE_METHOD: 'CLOSE_METHOD',
  CLOSE_REFUSED: 'CLOSE_REFUSED',
  CLOSE_WRONG_NUMBER: 'CLOSE_WRONG_NUMBER',
  KEEP_OPEN: 'KEEP_OPEN',
  SCHEDULE_CALLBACK: 'SCHEDULE_CALLBACK',
} as const;

export type CallOutcomeEffect = (typeof CallOutcomeEffect)[keyof typeof CallOutcomeEffect];

export const CALL_OUTCOME_EFFECT_VALUES = Object.values(CallOutcomeEffect);

export interface OutcomeEffectRule {
  /** L'appel clôt la phase 2 du prospect : plus aucune tâche ne sera ouverte. */
  readonly closes: boolean;
  readonly phase2Status: Phase2Status | null;
  readonly requiresMethod: boolean;
  readonly acceptsCallbackAt: boolean;
}

export const OUTCOME_EFFECT_RULES: Readonly<Record<CallOutcomeEffect, OutcomeEffectRule>> = {
  [CallOutcomeEffect.CLOSE_METHOD]: {
    closes: true,
    phase2Status: Phase2Status.METHOD_OBTAINED,
    requiresMethod: true,
    acceptsCallbackAt: false,
  },
  [CallOutcomeEffect.CLOSE_REFUSED]: {
    closes: true,
    phase2Status: Phase2Status.REFUSED,
    requiresMethod: false,
    acceptsCallbackAt: false,
  },
  [CallOutcomeEffect.CLOSE_WRONG_NUMBER]: {
    closes: true,
    phase2Status: Phase2Status.WRONG_NUMBER,
    requiresMethod: false,
    acceptsCallbackAt: false,
  },
  [CallOutcomeEffect.KEEP_OPEN]: {
    closes: false,
    phase2Status: null,
    requiresMethod: false,
    acceptsCallbackAt: false,
  },
  [CallOutcomeEffect.SCHEDULE_CALLBACK]: {
    closes: false,
    phase2Status: null,
    requiresMethod: false,
    acceptsCallbackAt: true,
  },
};

const RULES_BY_NAME: Readonly<Record<string, OutcomeEffectRule | undefined>> = OUTCOME_EFFECT_RULES;

/** `effect` arrive de la base : un effet ajouté sans règle doit rompre, pas passer. */
export function outcomeEffectRule(effect: string): OutcomeEffectRule {
  const rule = RULES_BY_NAME[effect];
  if (rule === undefined) {
    throw new Error(`Effet d'issue non traité : ${effect}`);
  }
  return rule;
}

/**
 * Version de charge utile la plus ancienne encore déployée sur le parc. Un motif
 * créé depuis le panneau porte la SUIVANTE : aucun téléphone en place ne peut
 * l'émettre, et le lot mobile qui les fera apparaître passera en version 2.
 */
export const LEGACY_PAYLOAD_VERSION = 1;
export const NEW_REASON_PAYLOAD_VERSION = 2;

export interface SystemOutcomeReason {
  readonly code: CallOutcome;
  readonly label: string;
  readonly effect: CallOutcomeEffect;
  readonly requiresComment: boolean;
  readonly requiresCallback: boolean;
  readonly countsAsReached: boolean;
  readonly color: string;
  readonly sortOrder: number;
}

/**
 * Les six motifs ensemencés portent les codes de l'énumération `CallOutcome` À
 * L'IDENTIQUE : une tentative déjà remontée reste résoluble sans conversion.
 *
 * `CALLBACK` n'exige PAS de date alors que son effet en planifie une : les
 * versions installées proposent « À rappeler » sans date, et l'exiger mettrait
 * leur saisie en échec définitif à la remontée.
 */
export const SYSTEM_OUTCOME_REASONS: readonly SystemOutcomeReason[] = [
  {
    code: CallOutcome.METHOD_OBTAINED,
    label: CALL_OUTCOME_LABELS[CallOutcome.METHOD_OBTAINED],
    effect: CallOutcomeEffect.CLOSE_METHOD,
    requiresComment: false,
    requiresCallback: false,
    countsAsReached: true,
    color: 'success',
    sortOrder: 10,
  },
  {
    code: CallOutcome.CALLBACK,
    label: CALL_OUTCOME_LABELS[CallOutcome.CALLBACK],
    effect: CallOutcomeEffect.SCHEDULE_CALLBACK,
    requiresComment: false,
    requiresCallback: false,
    countsAsReached: true,
    color: 'info',
    sortOrder: 20,
  },
  {
    code: CallOutcome.UNREACHABLE,
    label: CALL_OUTCOME_LABELS[CallOutcome.UNREACHABLE],
    effect: CallOutcomeEffect.KEEP_OPEN,
    requiresComment: false,
    requiresCallback: false,
    countsAsReached: false,
    color: 'warning',
    sortOrder: 30,
  },
  {
    code: CallOutcome.REFUSED,
    label: CALL_OUTCOME_LABELS[CallOutcome.REFUSED],
    effect: CallOutcomeEffect.CLOSE_REFUSED,
    requiresComment: false,
    requiresCallback: false,
    countsAsReached: true,
    color: 'danger',
    sortOrder: 40,
  },
  {
    code: CallOutcome.WRONG_NUMBER,
    label: CALL_OUTCOME_LABELS[CallOutcome.WRONG_NUMBER],
    effect: CallOutcomeEffect.CLOSE_WRONG_NUMBER,
    requiresComment: false,
    requiresCallback: false,
    countsAsReached: false,
    color: 'danger',
    sortOrder: 50,
  },
  {
    code: CallOutcome.OTHER,
    label: CALL_OUTCOME_LABELS[CallOutcome.OTHER],
    effect: CallOutcomeEffect.KEEP_OPEN,
    requiresComment: true,
    requiresCallback: false,
    countsAsReached: true,
    color: 'neutral',
    sortOrder: 60,
  },
];
