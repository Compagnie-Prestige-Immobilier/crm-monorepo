/**
 * Segmentation BDD1–BDD4 — définition UNIQUE et partagée.
 *
 * BDD1..BDD4 ne sont pas quatre bases physiques : ce sont quatre vues logiques
 * d'une base consolidée, obtenues en croisant deux axes binaires.
 *
 *                    │ banque CBAO │ banque ≠ CBAO
 *   ─────────────────┼─────────────┼───────────────
 *   syndicat CHUES   │    BDD1     │     BDD2
 *   syndicat ≠ CHUES │    BDD3     │     BDD4
 *
 * Tout ce qui segmente — listes, campagnes d'appels, statistiques, exports
 * Excel — doit passer par ce fichier. Une seconde définition ailleurs finirait
 * par diverger, et un classeur « BDD1 » ne contiendrait alors plus la même
 * population que le graphique « BDD1 » de la veille.
 *
 * Le segment n'est délibérément pas stocké sur `Prospect` : il dépend de deux
 * clés étrangères, donc une colonne dénormalisée se désynchroniserait dès qu'un
 * admin corrige la banque d'un prospect depuis le panel web.
 */
import type { BddSegment, CampaignScope, Prisma } from '@prisma/client';

/** Sigle du syndicat qui définit l'axe « CHUES » — voir `Syndicat.sigle`. */
export const CHUES_SIGLE = 'CHUES';

/** Nom court de la banque qui définit l'axe « CBAO » — voir `Banque.shortName`. */
export const CBAO_SHORT_NAME = 'CBAO';

export const ALL_SEGMENTS = ['BDD1', 'BDD2', 'BDD3', 'BDD4'] as const;

/** Les deux axes binaires dont dérive chaque segment. */
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

/** Libellés destinés à l'interface et aux onglets du classeur Excel. */
export const SEGMENT_LABELS: Readonly<Record<BddSegment, string>> = {
  BDD1: 'BDD1 — CHUES / CBAO',
  BDD2: 'BDD2 — CHUES / autre banque',
  BDD3: 'BDD3 — autre syndicat / CBAO',
  BDD4: 'BDD4 — autre syndicat / autre banque',
};

/**
 * Classe un prospect à partir des clés naturelles de son syndicat et de sa
 * banque. C'est la définition de référence ; `segmentWhere` en est la
 * traduction en filtre SQL et les deux sont vérifiées cohérentes par les tests.
 */
export function classifySegment(input: {
  syndicatSigle: string;
  banqueShortName: string;
}): BddSegment {
  const isChues = input.syndicatSigle === CHUES_SIGLE;
  const isCbao = input.banqueShortName === CBAO_SHORT_NAME;

  if (isChues) return isCbao ? 'BDD1' : 'BDD2';
  return isCbao ? 'BDD3' : 'BDD4';
}

/** Les axes d'un segment, exposés pour les tests et l'affichage. */
export function segmentAxes(segment: BddSegment): SegmentAxes {
  return SEGMENT_AXES[segment];
}

/**
 * Filtre Prisma correspondant à un segment.
 *
 * On filtre sur les relations plutôt que sur des identifiants résolus à
 * l'avance : le sigle et le nom court sont uniques en base et portent le sens
 * métier, alors qu'un identifiant résolu au démarrage deviendrait faux si un
 * admin renommait le référentiel. Les index `(syndicatId, banqueId)` et les
 * uniques sur `sigle` / `shortName` gardent la requête rapide.
 */
export function segmentWhere(segment: BddSegment): Prisma.ProspectWhereInput {
  const { isChues, isCbao } = SEGMENT_AXES[segment];

  return {
    syndicat: isChues ? { sigle: CHUES_SIGLE } : { sigle: { not: CHUES_SIGLE } },
    banque: isCbao ? { shortName: CBAO_SHORT_NAME } : { shortName: { not: CBAO_SHORT_NAME } },
  };
}

/**
 * Filtre correspondant au périmètre d'une campagne. `ALL` ne pose aucune
 * contrainte de segment — les quatre segments réunis forment exactement la
 * base, sans recouvrement ni trou.
 */
export function scopeWhere(scope: CampaignScope): Prisma.ProspectWhereInput {
  return scope === 'ALL' ? {} : segmentWhere(scope);
}

/**
 * Prospects éligibles à une campagne de phase 2.
 *
 * Un prospect est éligible s'il est actif, si sa phase 1 est complète (banque
 * et syndicat sont déjà obligatoires à la saisie, mais la condition est écrite
 * explicitement pour rester vraie si ces champs devenaient facultatifs), s'il
 * est encore en attente, s'il ne porte aucune méthode, et s'il n'a aucune tâche
 * active — sans cette dernière condition, deux campagnes créées coup sur coup
 * distribueraient le même numéro à deux commerciaux.
 */
export function eligibleForCampaignWhere(scope: CampaignScope): Prisma.ProspectWhereInput {
  return {
    ...scopeWhere(scope),
    deletedAt: null,
    phase2Status: 'PENDING',
    enrollmentMethod: null,
    callTasks: { none: { isActive: true } },
  };
}
