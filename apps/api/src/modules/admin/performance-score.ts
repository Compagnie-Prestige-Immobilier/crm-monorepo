import { ApiProperty } from '@nestjs/swagger';

/**
 * Score de rendement d'un téléconseiller, sur la fenêtre mesurée.
 *
 * Il ne sort JAMAIS un nombre seul : ses parts accompagnent la note, et
 * l'écran les affiche. Une note opaque qui classe des gens finit par punir
 * une zone sans réseau ou un téléphone lent, sans que personne puisse le
 * montrer.
 *
 * Le retard de remontée n'entre pas dans le calcul : il mesure la liaison,
 * pas le travail.
 */

/** Cibles relevées sur une journée réelle du plateau, pas choisies au jugé. */
const TARGET_CALLS_PER_HOUR = 12;
const TARGET_REACH_RATE = 0.5;
const TARGET_QUALIFICATION_RATE = 0.6;

export interface ScoreInput {
  readonly activeSecondsInShifts: number;
  readonly shiftSecondsElapsed: number;
  readonly calls: number;
  readonly reached: number;
  readonly qualified: number;
  readonly repeatCalls: number;
  readonly deadSeconds: number;
}

export type ScoreKey =
  'assiduite' | 'regularite' | 'rythme' | 'contact' | 'qualification' | 'efficience';

/**
 * Les classes Swagger vivent ici, avec le calcul, et non dans le DTO d'un
 * écran : les comptes et l'activité rendent la même note, et deux schémas
 * jumeaux se seraient mis à diverger.
 */
export class ScorePart {
  @ApiProperty({
    enum: ['assiduite', 'regularite', 'rythme', 'contact', 'qualification', 'efficience'],
  })
  key!: ScoreKey;

  @ApiProperty() label!: string;

  @ApiProperty({ type: Number, description: 'Atteinte de la cible, de 0 à 1, plafonnée à 1.' })
  ratio!: number;

  @ApiProperty({ type: Number, description: 'Part de la note portée par ce critère.' })
  weight!: number;
}

export type ScoreReason = 'journee_non_commencee' | 'presence_non_mesuree' | 'aucun_appel';

export class PerformanceScore {
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Note de 0 à 100 sur la fenêtre mesurée. `null` quand rien ne peut être jugé : ' +
      '`reason` dit alors pourquoi, et l’écran affiche le motif au lieu d’un zéro.',
  })
  value!: number | null;

  @ApiProperty({
    enum: ['journee_non_commencee', 'presence_non_mesuree', 'aucun_appel'],
    nullable: true,
  })
  reason!: ScoreReason | null;

  @ApiProperty({
    type: () => [ScorePart],
    description: 'Le détail qui compose la note. Vide quand `value` est nulle.',
  })
  parts!: ScorePart[];
}

const WEIGHTS: Record<ScoreKey, number> = {
  assiduite: 0.2,
  regularite: 0.15,
  rythme: 0.25,
  contact: 0.2,
  qualification: 0.15,
  efficience: 0.05,
};

const LABELS: Record<ScoreKey, string> = {
  assiduite: 'Assiduité',
  regularite: 'Régularité',
  rythme: 'Rythme',
  contact: 'Contact',
  qualification: 'Qualification',
  efficience: 'Efficience',
};

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

const ratio = (numerator: number, denominator: number): number =>
  denominator <= 0 ? 0 : clamp(numerator / denominator);

/**
 * Une note absente vaut mieux qu'une note fausse : sans journée commencée,
 * sans présence mesurée ou sans un seul appel, `value` reste nulle et `reason`
 * dit laquelle des trois. Un téléphone qui porte une version trop ancienne
 * pour ouvrir la socket de présence, ou un plateau dont la campagne est
 * terminée, ne se retrouvent pas notés zéro.
 */
export function performanceScore(input: ScoreInput): PerformanceScore {
  const excuse = missingBasis(input);
  if (excuse !== null) return { value: null, reason: excuse, parts: [] };

  const activeHours = input.activeSecondsInShifts / 3600;

  const ratios: Record<ScoreKey, number> = {
    assiduite: ratio(input.activeSecondsInShifts, input.shiftSecondsElapsed),
    regularite: 1 - ratio(input.deadSeconds, input.activeSecondsInShifts),
    rythme: ratio(input.calls / activeHours, TARGET_CALLS_PER_HOUR),
    contact: ratio(input.reached / input.calls, TARGET_REACH_RATE),
    qualification:
      input.reached > 0 ? ratio(input.qualified / input.reached, TARGET_QUALIFICATION_RATE) : 0,
    efficience: 1 - ratio(input.repeatCalls, input.calls),
  };

  const parts = (Object.keys(WEIGHTS) as ScoreKey[]).map((key) => ({
    key,
    label: LABELS[key],
    ratio: ratios[key],
    weight: WEIGHTS[key],
  }));

  const value = parts.reduce((total, part) => total + part.ratio * part.weight, 0);
  return { value: Math.round(value * 100), reason: null, parts };
}

function missingBasis(input: ScoreInput): ScoreReason | null {
  if (input.shiftSecondsElapsed <= 0) return 'journee_non_commencee';
  if (input.activeSecondsInShifts <= 0) return 'presence_non_mesuree';
  if (input.calls <= 0) return 'aucun_appel';
  return null;
}
