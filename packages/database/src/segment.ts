/**
 * Définition UNIQUE de la segmentation BDD1–BDD4 : listes, statistiques et
 * exports doivent tous passer par ici, sans quoi deux « BDD1 » divergeraient.
 *
 * Le segment n'est pas stocké sur `Prospect` : il dépend de deux clés étrangères,
 * donc une colonne dénormalisée se désynchroniserait dès qu'un admin corrige la
 * banque d'un prospect.
 */
import { type BddSegment, type Prisma } from '@prisma/client';

/** Clé naturelle de l'axe « CHUES » : voir `Syndicat.sigle`. */
export const CHUES_SIGLE = 'CHUES';

/** Clé naturelle de l'axe « CBAO » : voir `Banque.shortName`. */
export const CBAO_SHORT_NAME = 'CBAO';

export const ALL_SEGMENTS = ['BDD1', 'BDD2', 'BDD3', 'BDD4'] as const;

interface SegmentAxes {
  readonly isChues: boolean;
  readonly isCbao: boolean;
}

const SEGMENT_AXES: Readonly<Record<BddSegment, SegmentAxes>> = {
  BDD1: { isChues: true, isCbao: true },
  BDD2: { isChues: true, isCbao: false },
  BDD3: { isChues: false, isCbao: true },
  BDD4: { isChues: false, isCbao: false },
};

export const SEGMENT_LABELS: Readonly<Record<BddSegment, string>> = {
  BDD1: 'BDD1 : CHUES / CBAO',
  BDD2: 'BDD2 : CHUES / autre banque',
  BDD3: 'BDD3 : autre syndicat / CBAO',
  BDD4: 'BDD4 : autre syndicat / autre banque',
};

/**
 * Le segment se calcule sur DEUX axes. Il en manque un, il n'y a pas de segment.
 *
 * Rendre `BDD4` par defaut serait le pire choix : « autre syndicat / autre
 * banque » est une reponse, et une fiche Grand Public ou une fiche dont la
 * question n'a pas ete posee se retrouverait comptee dans un segment CHUES,
 * dans les listes, les campagnes et les exports.
 */
export function classifySegment(input: {
  syndicatSigle: string | null;
  banqueShortName: string | null;
}): BddSegment | null {
  if (input.syndicatSigle === null || input.banqueShortName === null) return null;

  const isChues = input.syndicatSigle === CHUES_SIGLE;
  const isCbao = input.banqueShortName === CBAO_SHORT_NAME;

  if (isChues) return isCbao ? 'BDD1' : 'BDD2';
  return isCbao ? 'BDD3' : 'BDD4';
}

export function segmentAxes(segment: BddSegment): SegmentAxes {
  return SEGMENT_AXES[segment];
}

/**
 * Filtre sur les relations et non sur des identifiants résolus à l'avance : un id
 * mis en cache deviendrait faux si un admin renommait le référentiel.
 */
export function segmentWhere(segment: BddSegment): Prisma.ProspectWhereInput {
  const { isChues, isCbao } = SEGMENT_AXES[segment];

  return {
    syndicat: isChues ? { sigle: CHUES_SIGLE } : { sigle: { not: CHUES_SIGLE } },
    banque: isCbao ? { shortName: CBAO_SHORT_NAME } : { shortName: { not: CBAO_SHORT_NAME } },
  };
}
