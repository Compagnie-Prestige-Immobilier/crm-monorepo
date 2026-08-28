import type { components } from '@crm/api-client';

import type { Catalogue, DonneesSource, Forme } from '@/components/accueil/tableau-de-bord/sources';
import type {
  ChiffresActivite,
  ChiffresBanques,
  ChiffresDelais,
  ChiffresEntonnoir,
  ChiffresMethodes,
  ChiffresRendement,
} from '@/lib/data/chiffres';
import { formatDecimal, formatNumber } from '@/lib/format';
import { formatXof } from '@/lib/money';

export type ChiffreSource = components['schemas']['DashboardSource'];

/** Une requête, et les cartes qui en vivent. Rien d'autre n'est lancé. */
export type Jeu = 'activite' | 'entonnoir' | 'delais' | 'rendement' | 'methodes' | 'banques';

export interface Jeux {
  activite?: ChiffresActivite;
  entonnoir?: ChiffresEntonnoir;
  delais?: ChiffresDelais;
  rendement?: ChiffresRendement;
  methodes?: ChiffresMethodes;
  banques?: ChiffresBanques;
}

export interface SourceChiffre {
  label: string;
  forme: Forme;
  jeu: Jeu;
  /** `null` tant que le jeu n'est pas arrivé : la carte montre son squelette. */
  extraire: (jeux: Jeux) => DonneesSource | null;
}

const taux = (valeur: number | null): string =>
  valeur === null ? 'Sans objet' : `${formatDecimal(valeur)} %`;

const scalaire = (libelle: string, valeur: number): DonneesSource => ({
  forme: 'scalaire',
  donnee: { libelle, valeur },
});

/**
 * Un taux se range dans une tuile, pas dans une valeur brute : la jauge et la
 * tuile lisent `valeur`, et `libelle` porte le dénominateur qui le rend vrai.
 */
const scalaireTaux = (libelle: string, valeur: number | null): DonneesSource => ({
  forme: 'scalaire',
  donnee: { libelle, valeur: valeur ?? 0 },
});

const COLONNES_EQUIPE = [
  'Appels',
  'Joints',
  'Prospects notés',
  'Adhésions',
  'Reste à appeler',
] as const;

/**
 * Le catalogue de l'écran « Chiffres ». Une entrée par carte, et rien qui ne
 * soit pas une carte : tout ce qui s'affiche se déplace et se retire.
 */
export const SOURCES_CHIFFRES = {
  'appels-de-qualification': {
    label: 'Appels aux représentants',
    forme: 'scalaire',
    jeu: 'activite',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaire(
            `dont ${formatNumber(activite.totals.repReached)} ont répondu`,
            activite.totals.repCalls,
          ),
  },
  'taux-de-contact': {
    label: 'Représentants joints',
    forme: 'scalaire',
    jeu: 'activite',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaireTaux(
            `${taux(activite.totals.repContactRate)} des appels aboutissent`,
            activite.totals.repContactRate,
          ),
  },
  'a-rappeler': {
    label: 'Rappels promis',
    forme: 'scalaire',
    jeu: 'activite',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaire(
            `${taux(activite.totals.repCallbackRate)} des appels`,
            activite.totals.repCallback,
          ),
  },
  'taux-de-qualification': {
    label: 'Représentants qui acceptent',
    forme: 'scalaire',
    jeu: 'activite',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaireTaux(
            `${formatNumber(activite.totals.repQualified)} sur ${formatNumber(activite.totals.repQuestioned)} interrogés`,
            activite.totals.repQualificationRate,
          ),
  },
  'prospects-notes': {
    label: 'Prospects notés',
    forme: 'scalaire',
    jeu: 'activite',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaire('fiches saisies sur la période', activite.totals.prospectsCreated),
  },
  adhesions: {
    label: 'Adhésions obtenues',
    forme: 'scalaire',
    jeu: 'activite',
    extraire: ({ activite }) =>
      activite === undefined
        ? null
        : scalaire(
            `sur ${formatNumber(activite.totals.calls)} appels de conversion`,
            activite.totals.methodObtained,
          ),
  },
  'reste-a-appeler': {
    label: 'Reste à appeler',
    forme: 'scalaire',
    jeu: 'activite',
    extraire: ({ activite }) => {
      if (activite === undefined) return null;
      // Instantané : aucune date ne le borne, il ne suit pas la période choisie.
      const ouvertes = activite.teleconseillers.reduce(
        (somme, personne) => somme + personne.openTasks,
        0,
      );
      return scalaire('fiches en attente, à l’instant', ouvertes);
    },
  },
  'par-teleconseiller': {
    label: 'Par téléconseiller',
    forme: 'equipe',
    jeu: 'activite',
    extraire: ({ activite }) => {
      if (activite === undefined) return null;
      const restes = new Map(activite.teleconseillers.map((p) => [p.id, p.openTasks]));
      // Les colonnes cumulées SE SOMMENT entre périodes ; `repQuestioned` et
      // `representantsContacted` comptent des personnes distinctes et n'y sont
      // donc pas, seul `totals` les tient juste.
      const cumul = new Map<string, number[]>();

      for (const ligne of activite.items) {
        const courant = cumul.get(ligne.teleconseillerId) ?? [0, 0, 0, 0];
        courant[0] = (courant[0] ?? 0) + ligne.repCalls + ligne.calls;
        courant[1] = (courant[1] ?? 0) + ligne.repReached;
        courant[2] = (courant[2] ?? 0) + ligne.prospectsCreated;
        courant[3] = (courant[3] ?? 0) + ligne.methodObtained;
        cumul.set(ligne.teleconseillerId, courant);
      }

      return {
        forme: 'equipe',
        donnee: {
          colonnes: [...COLONNES_EQUIPE],
          lignes: activite.teleconseillers.map((personne) => {
            const chiffres = cumul.get(personne.id) ?? [0, 0, 0, 0];
            return {
              id: personne.id,
              nom: personne.fullName,
              cellules: [
                ...chiffres.map((valeur, index) => ({
                  cle: COLONNES_EQUIPE[index] ?? String(index),
                  texte: formatNumber(valeur),
                })),
                { cle: 'reste', texte: formatNumber(restes.get(personne.id) ?? 0) },
              ],
            };
          }),
        },
      };
    },
  },
  encaisse: {
    label: 'Encaissé',
    forme: 'scalaire',
    jeu: 'entonnoir',
    extraire: ({ entonnoir }) =>
      entonnoir === undefined
        ? null
        : {
            forme: 'scalaire',
            donnee: {
              libelle: `${formatXof(entonnoir.finance.montantEncaisse)} sur ${formatNumber(entonnoir.finance.dossiersEncaisses)} dossiers`,
              valeur: entonnoir.finance.dossiersEncaisses,
            },
          },
  },
  'de-l-appel-a-l-encaissement': {
    label: 'De l’appel à l’encaissement',
    forme: 'composition',
    jeu: 'entonnoir',
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
} satisfies Record<string, SourceChiffre>;

export type SourceChiffreCle = keyof typeof SOURCES_CHIFFRES;

/** Une clé qui n'existe pas dans le contrat de l'API rougit sur cette ligne. */
export const SOURCES_DE_L_ECRAN: readonly ChiffreSource[] = Object.keys(
  SOURCES_CHIFFRES,
) as SourceChiffreCle[];

/** Ce que la grille et le tiroir ont besoin de savoir : intitulé et forme. */
export const CATALOGUE_CHIFFRES: Catalogue = SOURCES_CHIFFRES;

/** Un représentant n'existe que dans CHUES : hors de lui, ces cartes seraient à zéro. */
const SOURCES_CHUES_SEULEMENT: readonly string[] = [
  'appels-de-qualification',
  'taux-de-contact',
  'a-rappeler',
  'taux-de-qualification',
];

/** Les montants ne s'ouvrent qu'à la direction, comme la disposition d'usine du serveur. */
const SOURCES_MONTANTS: readonly string[] = ['encaisse', 'de-l-appel-a-l-encaissement'];

export function catalogueDe(input: {
  chues: boolean;
  voitLesMontants: boolean;
}): Record<string, SourceChiffre> {
  const entrees = Object.entries(SOURCES_CHIFFRES).filter(([cle]) => {
    if (!input.chues && SOURCES_CHUES_SEULEMENT.includes(cle)) return false;
    if (!input.voitLesMontants && SOURCES_MONTANTS.includes(cle)) return false;
    return true;
  });
  return Object.fromEntries(entrees);
}
