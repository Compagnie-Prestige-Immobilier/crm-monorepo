import type { components } from '@crm/api-client';

import type {
  Catalogue,
  DonneesSource,
  EquipeLigne,
  Forme,
} from '@/components/accueil/tableau-de-bord/sources';
import type {
  ChiffresActivite,
  ChiffresBanques,
  ChiffresCampagne,
  ChiffresDelais,
  ChiffresEntonnoir,
  ChiffresMethodes,
  ChiffresRendement,
  ChiffresTotaux,
} from '@/lib/data/chiffres';
import { formatDecimal, formatNumber } from '@/lib/format';
import { formatXof } from '@/lib/money';
import type { Role } from '@/lib/types';

export type ChiffreSource = components['schemas']['DashboardSource'];

/** Une requête, et les cartes qui en vivent. Rien d'autre n'est lancé. */
export type Jeu =
  'activite' | 'entonnoir' | 'delais' | 'rendement' | 'methodes' | 'banques' | 'campagne';

export interface Jeux {
  activite?: ChiffresActivite;
  entonnoir?: ChiffresEntonnoir;
  delais?: ChiffresDelais;
  rendement?: ChiffresRendement;
  methodes?: ChiffresMethodes;
  banques?: ChiffresBanques;
  campagne?: ChiffresCampagne;
}

export interface SourceChiffre {
  label: string;
  forme: Forme;
  jeu: Jeu;
  description: string;
  groupe: string;
  /** `null` tant que le jeu n'est pas arrivé : la carte montre son squelette. */
  extraire: (jeux: Jeux) => DonneesSource | null;
}

const taux = (valeur: number | null): string =>
  valeur === null ? 'Sans objet' : `${formatDecimal(valeur)} %`;

/** Même arrondi que le serveur : un taux d'équipe se relit sur les sommes. */
const part = (valeur: number, total: number): number | null =>
  total === 0 ? null : Math.round((valeur / total) * 1000) / 10;

const scalaire = (libelle: string, valeur: number): DonneesSource => ({
  forme: 'scalaire',
  donnee: { libelle, valeur },
});

/**
 * Un taux se range dans une tuile, pas dans une valeur brute : la jauge et la
 * tuile lisent `valeur`, `affichage` porte le pourcentage et `libelle` le
 * dénominateur qui le rend vrai. Sans dénominateur, la tuile dit « Sans objet »
 * et non « 0 % ».
 */
const scalaireTaux = (
  valeur: number | null,
  libelle: string,
  sansDenominateur: string,
): DonneesSource => ({
  forme: 'scalaire',
  donnee: {
    libelle: valeur === null ? sansDenominateur : libelle,
    valeur: valeur ?? 0,
    affichage: taux(valeur),
  },
});

const joignables = (t: ChiffresTotaux): number => t.calls - t.unreachable - t.wrongNumber;

const COLONNES_CHUES = [
  'Appels',
  'Contact',
  'Rendez-vous',
  'Qualification',
  'Prospects notés',
  'Adhésions',
] as const;

const COLONNES_GRAND_PUBLIC = ['Appels', 'Joignabilité', 'Prospects notés', 'Adhésions'] as const;

type Cumul = Pick<
  ChiffresTotaux,
  | 'repCalls'
  | 'repReached'
  | 'repCallback'
  | 'repQuestioned'
  | 'repQualified'
  | 'calls'
  | 'unreachable'
  | 'wrongNumber'
  | 'prospectsCreated'
  | 'methodObtained'
>;

const CUMUL_VIDE: Cumul = {
  repCalls: 0,
  repReached: 0,
  repCallback: 0,
  repQuestioned: 0,
  repQualified: 0,
  calls: 0,
  unreachable: 0,
  wrongNumber: 0,
  prospectsCreated: 0,
  methodObtained: 0,
};

function cellules(cumul: Cumul, chues: boolean): EquipeLigne['cellules'] {
  const textes = chues
    ? [
        formatNumber(cumul.repCalls),
        taux(part(cumul.repReached, cumul.repCalls)),
        taux(part(cumul.repCallback, cumul.repCalls)),
        taux(part(cumul.repQualified, cumul.repQuestioned)),
        formatNumber(cumul.prospectsCreated),
        formatNumber(cumul.methodObtained),
      ]
    : [
        formatNumber(cumul.calls),
        taux(part(joignables(cumul as ChiffresTotaux), cumul.calls)),
        formatNumber(cumul.prospectsCreated),
        formatNumber(cumul.methodObtained),
      ];
  const colonnes = chues ? COLONNES_CHUES : COLONNES_GRAND_PUBLIC;
  return textes.map((texte, index) => ({ cle: colonnes[index] ?? String(index), texte }));
}

/**
 * Les lignes se somment par téléconseiller sur la fenêtre demandée, y compris
 * `repQuestioned` : un représentant n'est attribué qu'une fois, à qui a obtenu
 * sa dernière réponse. Le pied reprend `totals`, calculé par le serveur.
 */
function tableauEquipe(activite: ChiffresActivite, chues: boolean): DonneesSource {
  const cumul = new Map<string, Cumul>();
  for (const ligne of activite.items) {
    const courant = cumul.get(ligne.teleconseillerId) ?? { ...CUMUL_VIDE };
    for (const cle of Object.keys(CUMUL_VIDE) as (keyof Cumul)[]) courant[cle] += ligne[cle];
    cumul.set(ligne.teleconseillerId, courant);
  }

  return {
    forme: 'equipe',
    donnee: {
      colonnes: [...(chues ? COLONNES_CHUES : COLONNES_GRAND_PUBLIC)],
      lignes: activite.teleconseillers.map((personne) => ({
        id: personne.id,
        nom: personne.fullName,
        cellules: cellules(cumul.get(personne.id) ?? CUMUL_VIDE, chues),
      })),
      pied: { id: 'equipe', nom: 'Équipe', cellules: cellules(activite.totals, chues) },
    },
  };
}

/**
 * Le catalogue de l'écran « Chiffres ». Une entrée par carte, et rien qui ne
 * soit pas une carte : tout ce qui s'affiche se déplace et se retire.
 */
export const SOURCES_CHIFFRES = {
  'taux-de-contact': {
    label: 'Taux de contact',
    forme: 'scalaire',
    jeu: 'activite',
    description: 'La part des appels aux représentants où quelqu’un a décroché.',
    groupe: 'Qualification',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaireTaux(
            activite.totals.repContactRate,
            `${formatNumber(activite.totals.repReached)} joints sur ${formatNumber(activite.totals.repCalls)} appels`,
            'Aucun appel sur la période',
          ),
  },
  'a-rappeler': {
    label: 'Taux de rendez-vous',
    forme: 'scalaire',
    jeu: 'activite',
    description: 'La part des appels aux représentants qui finissent par un rappel promis.',
    groupe: 'Qualification',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaireTaux(
            activite.totals.repCallbackRate,
            `${formatNumber(activite.totals.repCallback)} rendez-vous sur ${formatNumber(activite.totals.repCalls)} appels`,
            'Aucun appel sur la période',
          ),
  },
  'taux-de-qualification': {
    label: 'Taux de qualification',
    forme: 'scalaire',
    jeu: 'activite',
    description: 'La part des représentants interrogés qui acceptent d’être représentant CHUES.',
    groupe: 'Qualification',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaireTaux(
            activite.totals.repQualificationRate,
            `${formatNumber(activite.totals.repQualified)} acceptent sur ${formatNumber(activite.totals.repQuestioned)} interrogés`,
            'Aucun représentant interrogé sur la période',
          ),
  },
  'taux-de-joignabilite': {
    label: 'Taux de joignabilité',
    forme: 'scalaire',
    jeu: 'activite',
    description: 'La part des appels aux prospects dont le numéro s’est révélé exploitable.',
    groupe: 'Conversion',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaireTaux(
            activite.totals.reachRate,
            `${formatNumber(joignables(activite.totals))} numéros exploitables sur ${formatNumber(activite.totals.calls)} appels`,
            'Aucun appel sur la période',
          ),
  },
  'prospects-notes': {
    label: 'Prospects notés',
    forme: 'scalaire',
    jeu: 'activite',
    description: 'Le nombre de nouvelles fiches saisies pendant la période.',
    groupe: 'Conversion',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaire('fiches saisies sur la période', activite.totals.prospectsCreated),
  },
  adhesions: {
    label: 'Adhésions',
    forme: 'scalaire',
    jeu: 'activite',
    description: 'Le nombre de personnes qui ont finalement adhéré.',
    groupe: 'Résultats',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaire(
            `sur ${formatNumber(activite.totals.calls)} appels de conversion`,
            activite.totals.methodObtained,
          ),
  },
  'par-teleconseiller': {
    label: 'Par téléconseiller',
    forme: 'equipe',
    jeu: 'activite',
    description:
      'Les mêmes taux, téléconseiller par téléconseiller, avec la ligne d’équipe en pied.',
    groupe: 'Équipe',
    extraire: ({ activite }) => (activite === undefined ? null : tableauEquipe(activite, true)),
  },
  'couverture-derniere-campagne': {
    label: 'Couverture de la dernière campagne',
    forme: 'composition',
    jeu: 'campagne',
    description:
      'Pour chaque téléconseiller, la part des fiches assignées qui ont reçu au moins un appel. La période choisie ne change pas la dernière campagne.',
    groupe: 'Campagnes',
    extraire: ({ campagne }) =>
      campagne == null
        ? null
        : {
            forme: 'composition',
            donnee: campagne.performance.map((ligne) => ({
              ligne: ligne.teleconseillerName,
              segments: [
                { id: 'traitees', label: 'Traitées', value: ligne.treated },
                {
                  id: 'restantes',
                  label: 'Restantes',
                  value: Math.max(0, ligne.assigned - ligne.treated),
                },
              ],
            })),
          },
  },
  'hors-attribution-derniere-campagne': {
    label: 'Appels hors attribution',
    forme: 'classement',
    jeu: 'campagne',
    description:
      'Les appels passés sur une fiche confiée à un collègue dans la dernière campagne. La période choisie ne change pas la dernière campagne.',
    groupe: 'Campagnes',
    extraire: ({ campagne }) =>
      campagne == null
        ? null
        : {
            forme: 'classement',
            donnee: campagne.performance.map((ligne) => ({
              id: ligne.teleconseillerId,
              label: ligne.teleconseillerName,
              value: ligne.outsideAssignmentCalls,
            })),
          },
  },
  encaisse: {
    label: 'Encaissé',
    forme: 'scalaire',
    jeu: 'entonnoir',
    description: 'Le montant réellement encaissé sur les dossiers terminés.',
    groupe: 'Résultats',
    extraire: ({ entonnoir }) =>
      entonnoir === undefined
        ? null
        : {
            forme: 'scalaire',
            donnee: {
              libelle: `sur ${formatNumber(entonnoir.finance.dossiersEncaisses)} dossiers`,
              valeur: Number(entonnoir.finance.montantEncaisse),
              affichage: formatXof(entonnoir.finance.montantEncaisse),
            },
          },
  },
  'de-l-appel-a-l-encaissement': {
    label: 'De l’appel à l’encaissement',
    forme: 'composition',
    jeu: 'entonnoir',
    description: 'Voir combien de dossiers passent chaque étape, du premier appel au paiement.',
    groupe: 'Résultats',
    extraire: ({ entonnoir }) =>
      entonnoir === undefined
        ? null
        : {
            forme: 'composition',
            donnee: [
              {
                ligne: 'Étapes',
                segments: entonnoir.etapes.map((etape) => ({
                  id: etape.label,
                  label: etape.label,
                  value: etape.count,
                })),
              },
            ],
          },
  },
  'methodes-d-adhesion': {
    label: 'Méthodes d’adhésion',
    forme: 'composition',
    jeu: 'methodes',
    description: 'Voir quelle méthode d’adhésion est choisie le plus souvent.',
    groupe: 'Résultats',
    extraire: ({ methodes }) =>
      methodes === undefined
        ? null
        : {
            forme: 'composition',
            donnee: [
              {
                ligne: 'Méthodes',
                segments: methodes.items.map((item) => ({
                  id: item.method,
                  label: item.label,
                  value: item.prospects,
                })),
              },
            ],
          },
  },
  'par-banque': {
    label: 'Par banque',
    forme: 'composition',
    jeu: 'banques',
    description: 'Comparer la répartition des dossiers entre les banques.',
    groupe: 'Analyses',
    extraire: ({ banques }) =>
      banques === undefined
        ? null
        : {
            forme: 'composition',
            donnee: [
              {
                ligne: 'Banques',
                segments: banques.items.map((item) => ({
                  id: item.id ?? item.label,
                  label: item.label,
                  value: item.prospects,
                })),
              },
            ],
          },
  },
  'delais-medians': {
    label: 'Délais médians',
    forme: 'classement',
    jeu: 'delais',
    description: 'Repérer l’étape qui prend le plus de temps.',
    groupe: 'Analyses',
    extraire: ({ delais }) =>
      delais === undefined
        ? null
        : {
            forme: 'classement',
            donnee: delais.legs.map((leg) => ({
              id: leg.leg,
              label: leg.label,
              value: leg.medianDays ?? 0,
            })),
          },
  },
  'rendement-par-departement': {
    label: 'Rendement par département',
    forme: 'classement',
    jeu: 'rendement',
    description: 'Comparer le taux de conversion des prospects de chaque département.',
    groupe: 'Analyses',
    extraire: ({ rendement }) =>
      rendement === undefined
        ? null
        : {
            forme: 'classement',
            donnee: rendement.items.flatMap((row) =>
              row.conversionRate === null
                ? []
                : [{ id: row.id, label: row.label, value: row.conversionRate }],
            ),
          },
  },
} satisfies Partial<Record<ChiffreSource, SourceChiffre>>;

export type SourceChiffreCle = keyof typeof SOURCES_CHIFFRES;

/** Une clé qui n'existe pas dans le contrat de l'API rougit sur cette ligne. */
export const SOURCES_DE_L_ECRAN: readonly ChiffreSource[] = Object.keys(
  SOURCES_CHIFFRES,
) as SourceChiffreCle[];

/** Ce que la grille et le tiroir ont besoin de savoir : intitulé et forme. */
export const CATALOGUE_CHIFFRES: Catalogue = SOURCES_CHIFFRES;

/** Un représentant n'existe que dans CHUES : hors de lui, ces cartes seraient à zéro. */
const SOURCES_CHUES_SEULEMENT: readonly string[] = [
  'taux-de-contact',
  'a-rappeler',
  'taux-de-qualification',
  'par-banque',
];

/** Les montants ne s'ouvrent qu'à la direction, comme la disposition d'usine du serveur. */
const SOURCES_MONTANTS: readonly string[] = ['encaisse', 'de-l-appel-a-l-encaissement'];

/** Le pilotage d'équipe parle d'appels, pas de recette ni de portefeuille. */
const SOURCES_SUPERVISION: readonly string[] = [
  'par-banque',
  'encaisse',
  'de-l-appel-a-l-encaissement',
  'rendement-par-departement',
  'couverture-derniere-campagne',
  'hors-attribution-derniere-campagne',
];

export function catalogueDe(input: {
  chues: boolean;
  voitLesMontants: boolean;
  role: Role;
}): Record<string, SourceChiffre> {
  const entrees = Object.entries(SOURCES_CHIFFRES).filter(([cle]) => {
    if (!input.chues && SOURCES_CHUES_SEULEMENT.includes(cle)) return false;
    if (!input.voitLesMontants && SOURCES_MONTANTS.includes(cle)) return false;
    if (input.role === 'SUPERVISEUR' && SOURCES_SUPERVISION.includes(cle)) return false;
    return true;
  });
  const catalogue = Object.fromEntries(entrees);
  // Le tableau d'équipe porte les colonnes du projet : sans représentant, pas de taux CHUES.
  catalogue['par-teleconseiller'] = {
    ...SOURCES_CHIFFRES['par-teleconseiller'],
    extraire: ({ activite }) =>
      activite === undefined ? null : tableauEquipe(activite, input.chues),
  };
  return catalogue;
}
