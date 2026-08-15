/**
 * Segmentation BDD1–BDD4 : définition UNIQUE et partagée.
 *
 * BDD1..BDD4 ne sont pas quatre bases physiques : ce sont quatre vues logiques
 * d'une base consolidée, obtenues en croisant deux axes binaires.
 *
 *                    │ banque CBAO │ banque ≠ CBAO
 *   ─────────────────┼─────────────┼───────────────
 *   syndicat CHUES   │    BDD1     │     BDD2
 *   syndicat ≠ CHUES │    BDD3     │     BDD4
 *
 * Tout ce qui segmente : listes, campagnes d'appels, statistiques, exports
 * Excel : doit passer par ce fichier. Une seconde définition ailleurs finirait
 * par diverger, et un classeur « BDD1 » ne contiendrait alors plus la même
 * population que le graphique « BDD1 » de la veille.
 *
 * Le segment n'est délibérément pas stocké sur `Prospect` : il dépend de deux
 * clés étrangères, donc une colonne dénormalisée se désynchroniserait dès qu'un
 * admin corrige la banque d'un prospect depuis le panel web.
 */
import type { BddSegment, CampaignScope, Prisma } from '@prisma/client';

/** Sigle du syndicat qui définit l'axe « CHUES » : voir `Syndicat.sigle`. */
export const CHUES_SIGLE = 'CHUES';

/** Nom court de la banque qui définit l'axe « CBAO » : voir `Banque.shortName`. */
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
  BDD1: 'BDD1 : CHUES / CBAO',
  BDD2: 'BDD2 : CHUES / autre banque',
  BDD3: 'BDD3 : autre syndicat / CBAO',
  BDD4: 'BDD4 : autre syndicat / autre banque',
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
 * contrainte de segment : les quatre segments réunis forment exactement la
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
 * active : sans cette dernière condition, deux campagnes créées coup sur coup
 * distribueraient le même numéro à deux commerciaux.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `demoEnabled` EST OBLIGATOIRE, ET SANS VALEUR PAR DÉFAUT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le tirage MATÉRIALISE ce qu'il sélectionne : chaque prospect retenu devient
 * une ligne de programme papier qu'un téléconseiller compose au téléphone. Une
 * fiche de démonstration qui entre ici n'est pas une ligne de trop dans un
 * tableau, c'est un faux numéro sur une feuille d'appels réelle, découvert par
 * la personne qui compose. Éteindre le mode démonstration ensuite ne retire pas
 * la tâche déjà écrite.
 *
 * Le paramètre n'a donc pas de valeur par défaut : un appelant qui l'oublie ne
 * compile pas, au lieu de tirer silencieusement dans le jeu de démonstration.
 */
export function eligibleForCampaignWhere(
  scope: CampaignScope,
  demoEnabled: boolean,
): Prisma.ProspectWhereInput {
  return {
    ...scopeWhere(scope),
    deletedAt: null,
    // UNE SEULE POPULATION, JAMAIS LES DEUX MÊLÉES.
    //
    // Ailleurs, `demoScope` ÉLARGIT quand le mode est allumé : les écrans
    // montrent le réel et le fictif ensemble, et c'est ce qu'on attend d'une
    // démonstration. Ici, non. Un tirage n'affiche pas, il MATÉRIALISE : il
    // écrit des tâches d'appel durables, et il exclut par la même occasion
    // chaque fiche retenue de toute campagne ultérieure.
    //
    // Élargir ici mélangeait donc les deux populations dans un même tirage,
    // puis marquait TOUTES les tâches `isDemo: true`. Une fois le mode éteint,
    // les vraies fiches ainsi tirées restaient bloquées par une tâche active
    // devenue invisible, sur une campagne elle-même invisible, et la purge de
    // démonstration ne pouvait rien y faire : elle ne supprime que les
    // identifiants inscrits au registre, et une campagne créée en cours de
    // route n'y figure jamais. Des fiches réelles disparaissaient du circuit
    // sans que rien ne le signale.
    //
    // Le mode choisit donc la population, il ne l'étend pas.
    isDemo: demoEnabled,
    phase2Status: 'PENDING',
    enrollmentMethod: null,
    // VOLONTAIREMENT NON BORNÉ PAR `isDemo`, contrairement au reste.
    //
    // Cette clause double l'index `call_tasks_one_active_per_prospect`, qui est
    // partiel sur `isActive = true` et NE CONNAÎT PAS `isDemo` : la base
    // n'admet qu'une seule tâche active par prospect, toutes populations
    // confondues. Restreindre la clause à une population la rendrait plus
    // étroite que la contrainte qu'elle sert à anticiper : une fiche portant
    // une tâche active de l'autre population passerait l'éligibilité, puis le
    // `createMany` se heurterait à l'index en plein tirage.
    //
    // La partition se fait déjà par `isDemo` ci-dessus, donc en régime normal
    // les deux formulations sélectionnent la même chose. La différence
    // n'apparaît que sur des lignes héritées d'un tirage antérieur mêlant les
    // deux populations : là, la version non bornée les écarte proprement au
    // lieu de provoquer un conflit d'unicité.
    callTasks: { none: { isActive: true } },
  };
}
