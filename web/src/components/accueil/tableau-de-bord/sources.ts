import type { components } from '@crm/api-client';

import { MOIS_LABELS } from '@/lib/data/visites-stats';
import type { NamedCount } from '@/lib/types';
import type { Role } from '@/lib/types';

type Schemas = components['schemas'];

/** Go ne type pas `DispositionWidget.source` au delà de `string` : chaque catalogue valide les siennes. */
export type DashboardSource = string;
export type DashboardMarque = Exclude<Schemas['DispositionWidget']['marque'], undefined>;
export type DashboardTaille = Exclude<Schemas['DispositionWidget']['taille'], undefined>;
export type DashboardPreset = Schemas['DispositionOutputBody']['preset'];
export type DispositionPresentation = Schemas['DispositionPresentation'];
export type VisiteStats = Schemas['StatsVisitesOutputBody'];

export type Forme =
  | 'scalaire'
  | 'classement'
  | 'serie-temporelle'
  | 'cyclique'
  | 'matrice'
  | 'composition'
  | 'equipe';

export interface ScalaireDatum {
  libelle: string;
  valeur: number;
  /** Au lieu du nombre brut : un texte figé, ou le nombre à rouler et sa mise en forme. */
  affichage?: string | { valeur: number; format: (valeur: number) => string };
  serie?: NamedCount[];
}

export interface CompositionLigne {
  ligne: string;
  segments: NamedCount[];
  /** Ce que le clic sur cette ligne ouvre, et ce que sa légende ajoute sous le nom. */
  id?: string;
  detail?: string;
}

interface MatriceCellule {
  ligne: string;
  colonne: string;
  value: number;
}

export interface MatriceDatum {
  lignes: string[];
  colonnes: string[];
  cellules: MatriceCellule[];
}

/** Une ligne de tableau d'équipe : des mesures d'unités DIFFÉRENTES sur une même personne. */
export interface EquipeLigne {
  id: string;
  nom: string;
  cellules: { cle: string; texte: string }[];
}

export interface EquipeDatum {
  colonnes: string[];
  lignes: EquipeLigne[];
  /** La ligne d'équipe en pied, recalculée sur les sommes et non sur la moyenne des lignes. */
  pied?: EquipeLigne;
}

export type DonneesSource =
  | { forme: 'scalaire'; donnee: ScalaireDatum }
  | { forme: 'classement'; donnee: NamedCount[] }
  | { forme: 'serie-temporelle'; donnee: NamedCount[] }
  | { forme: 'cyclique'; donnee: NamedCount[] }
  | { forme: 'matrice'; donnee: MatriceDatum }
  | { forme: 'composition'; donnee: CompositionLigne[]; resume?: string }
  | { forme: 'equipe'; donnee: EquipeDatum };

export interface SourceDefinition {
  label: string;
  forme: Forme;
  question?: string;
  description?: string;
  extraire: (stats: VisiteStats) => DonneesSource;
}

/**
 * Ce que la grille a besoin de savoir d'une source, quel que soit l'écran qui
 * la sert : son intitulé et la forme de ses données. Le registre des visites et
 * les chiffres d'un projet fournissent chacun le leur.
 */
export interface CatalogueEntree {
  label: string;
  forme: Forme;
  question?: string;
  description?: string;
  groupe?: string;
  /** L'écran qu'ouvre une part du graphique, à partir de son identifiant. */
  lien?: (id: string) => string;
}

export type Catalogue = Readonly<Record<string, CatalogueEntree>>;

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function joursDePeriode(from: string, to: string): number {
  const debut = new Date(`${from}T00:00:00Z`);
  const fin = new Date(`${to}T00:00:00Z`);
  return Math.max(1, Math.round((fin.getTime() - debut.getTime()) / 86_400_000) + 1);
}

function bucketRank(items: { id: string; label: string; count: number }[]): NamedCount[] {
  return items.map((item) => ({ id: item.id, label: item.label, value: item.count }));
}

function labelMap(items: { id: string; label: string }[]): Map<string, string> {
  return new Map(items.map((item) => [item.id, item.label]));
}

function moisLabel(month: string): string {
  const [annee, mois] = month.split('-');
  const index = Number(mois) - 1;
  const nom = MOIS_LABELS[index] ?? month;
  return `${nom} ${annee ?? ''}`.trim();
}

function croisement(
  points: { ligneId: string; colonneId: string; count: number }[],
  lignes: Map<string, string>,
  colonnes: Map<string, string>,
): MatriceDatum {
  return {
    lignes: [...lignes.values()],
    colonnes: [...colonnes.values()],
    cellules: points.map((point) => ({
      ligne: lignes.get(point.ligneId) ?? point.ligneId,
      colonne: colonnes.get(point.colonneId) ?? point.colonneId,
      value: point.count,
    })),
  };
}

/**
 * Le catalogue du REGISTRE DES VISITES. Le contrat porte les sources de tous
 * les écrans ; celui-ci n'en sert qu'un, d'où le `satisfies` plutôt qu'un
 * `Record` exhaustif.
 */
export const SOURCES = {
  'total-visites': {
    label: 'Total des visites',
    forme: 'scalaire',
    question: 'Combien de visites ont été enregistrées ?',
    description: 'Le volume total sur la période choisie.',
    extraire: (stats) => ({
      forme: 'scalaire',
      donnee: { libelle: 'Total des visites', valeur: stats.total },
    }),
  },
  'moyenne-journaliere': {
    label: 'Moyenne journalière',
    forme: 'scalaire',
    question: 'À quel rythme les visites arrivent-elles ?',
    description: 'Le nombre moyen de visites par jour.',
    extraire: (stats) => {
      const jours = joursDePeriode(stats.from, stats.to);
      return {
        forme: 'scalaire',
        donnee: {
          libelle: 'Moyenne journalière',
          valeur: Math.round((stats.total / jours) * 10) / 10,
        },
      };
    },
  },
  'jour-le-plus-charge': {
    label: 'Jour le plus chargé',
    forme: 'scalaire',
    question: 'Quel jour reçoit le plus de visiteurs ?',
    description: 'Le jour où l’accueil a été le plus sollicité.',
    extraire: (stats) => {
      const plusCharge = stats.parJour.reduce<{ date: string; count: number } | null>(
        (max, point) => (max === null || point.count > max.count ? point : max),
        null,
      );
      return {
        forme: 'scalaire',
        donnee: {
          libelle: plusCharge === null ? 'Aucune visite' : plusCharge.date,
          valeur: plusCharge?.count ?? 0,
        },
      };
    },
  },
  'par-entreprise': {
    label: 'Par entreprise',
    forme: 'classement',
    question: 'Quelles entreprises viennent le plus ?',
    description: 'Comparer les volumes entre organismes.',
    extraire: (stats) => ({ forme: 'classement', donnee: bucketRank(stats.parEntreprise) }),
  },
  'par-objet': {
    label: 'Par objet',
    forme: 'classement',
    question: 'Pourquoi les visiteurs viennent-ils ?',
    description: 'Voir les demandes les plus fréquentes.',
    extraire: (stats) => ({ forme: 'classement', donnee: bucketRank(stats.parObjet) }),
  },
  'par-direction': {
    label: 'Par direction',
    forme: 'classement',
    question: 'Quelles directions sont le plus demandées ?',
    description: 'Comparer les volumes par direction.',
    extraire: (stats) => ({ forme: 'classement', donnee: bucketRank(stats.parDirection) }),
  },
  'par-destinataire': {
    label: 'Par destinataire',
    forme: 'classement',
    question: 'Qui reçoit le plus de visiteurs ?',
    description: 'Comparer les personnes ou services sollicités.',
    extraire: (stats) => ({ forme: 'classement', donnee: bucketRank(stats.parDestinataire) }),
  },
  'par-agent': {
    label: 'Par agent',
    forme: 'classement',
    question: 'Qui a enregistré le plus de visites ?',
    description: 'Comparer le nombre de saisies par agent d’accueil.',
    extraire: (stats) => ({ forme: 'classement', donnee: bucketRank(stats.parAgent) }),
  },
  'visiteurs-recurrents': {
    label: 'Visiteurs récurrents',
    forme: 'classement',
    question: 'Qui revient le plus souvent ?',
    description: 'Repérer les visiteurs qui reviennent régulièrement.',
    extraire: (stats) => ({
      forme: 'classement',
      donnee: stats.recurrents.map((r, index) => ({
        id: `${r.nom}-${String(index)}`,
        label: r.nom,
        value: r.visites,
      })),
    }),
  },
  'par-jour': {
    label: 'Par jour',
    forme: 'serie-temporelle',
    question: 'Les visites montent-elles ou baissent-elles ?',
    description: 'Suivre l’évolution jour après jour.',
    extraire: (stats) => ({
      forme: 'serie-temporelle',
      donnee: [...stats.parJour]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((point) => ({ id: point.date, label: point.date, value: point.count })),
    }),
  },
  'par-mois': {
    label: 'Par mois',
    forme: 'serie-temporelle',
    question: 'Quel est le rythme d’un mois à l’autre ?',
    description: 'Comparer les mois de la période.',
    extraire: (stats) => ({
      forme: 'serie-temporelle',
      donnee: [...stats.parMois]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((point) => ({ id: point.month, label: moisLabel(point.month), value: point.count })),
    }),
  },
  'par-heure': {
    label: 'Par heure',
    forme: 'cyclique',
    question: 'À quelles heures l’accueil est-il le plus chargé ?',
    description: 'Repérer les heures qui demandent le plus de présence.',
    extraire: (stats) => {
      const parHeure = new Map(stats.parHeure.map((point) => [point.hour, point.count]));
      return {
        forme: 'cyclique',
        donnee: Array.from({ length: 24 }, (_, heure) => ({
          id: String(heure),
          label: `${String(heure).padStart(2, '0')}h`,
          value: parHeure.get(heure) ?? 0,
        })),
      };
    },
  },
  'par-jour-semaine': {
    label: 'Par jour de la semaine',
    forme: 'cyclique',
    question: 'Quels jours de la semaine sont les plus chargés ?',
    description: 'Comparer lundi, mardi et les autres jours.',
    extraire: (stats) => {
      const parJour = new Map(stats.parJourSemaine.map((point) => [point.weekday, point.count]));
      return {
        forme: 'cyclique',
        donnee: Array.from({ length: 7 }, (_, index) => ({
          id: String(index + 1),
          label: JOURS_SEMAINE[index] ?? String(index + 1),
          value: parJour.get(index + 1) ?? 0,
        })),
      };
    },
  },
  'par-heure-jour-semaine': {
    label: 'Heure × jour de la semaine',
    forme: 'matrice',
    question: 'Quel créneau est le plus chargé ?',
    description: 'Lire le jour et l’heure ensemble.',
    extraire: (stats) => {
      const cellules = new Map(
        stats.parHeureJourSemaine.map((point) => [
          `${String(point.weekday)}-${String(point.hour)}`,
          point.count,
        ]),
      );
      return {
        forme: 'matrice',
        donnee: {
          lignes: JOURS_SEMAINE,
          colonnes: Array.from({ length: 24 }, (_, heure) => `${String(heure).padStart(2, '0')}h`),
          cellules: JOURS_SEMAINE.flatMap((jour, jourIndex) =>
            Array.from({ length: 24 }, (_, heure) => ({
              ligne: jour,
              colonne: `${String(heure).padStart(2, '0')}h`,
              value: cellules.get(`${String(jourIndex + 1)}-${String(heure)}`) ?? 0,
            })),
          ),
        },
      };
    },
  },
  'par-entreprise-objet': {
    label: 'Entreprise × objet',
    forme: 'matrice',
    question: 'Que demandent les visiteurs de chaque entreprise ?',
    description: 'Croiser l’entreprise et le motif de visite.',
    extraire: (stats) => ({
      forme: 'matrice',
      donnee: croisement(
        stats.parEntrepriseObjet,
        labelMap(stats.parEntreprise),
        labelMap(stats.parObjet),
      ),
    }),
  },
  'par-destinataire-direction': {
    label: 'Destinataire × direction',
    forme: 'matrice',
    question: 'Quelle direction reçoit chaque demande ?',
    description: 'Croiser le destinataire et sa direction.',
    extraire: (stats) => ({
      forme: 'matrice',
      donnee: croisement(
        stats.parDestinataireDirection,
        labelMap(stats.parDestinataire),
        labelMap(stats.parDirection),
      ),
    }),
  },
  'par-objet-mois': {
    label: 'Objet × mois',
    forme: 'matrice',
    question: 'Quels motifs augmentent selon les mois ?',
    description: 'Croiser le motif de visite et le mois.',
    extraire: (stats) => {
      const colonnes = new Map(stats.parMois.map((point) => [point.month, moisLabel(point.month)]));
      return {
        forme: 'matrice',
        donnee: croisement(stats.parObjetMois, labelMap(stats.parObjet), colonnes),
      };
    },
  },
  'avec-telephone': {
    label: 'Avec téléphone',
    forme: 'composition',
    question: 'Combien de fiches ont un numéro utilisable ?',
    description: 'Comparer les fiches avec et sans téléphone.',
    extraire: (stats) => ({
      forme: 'composition',
      donnee: [
        {
          ligne: 'Avec téléphone',
          segments: [
            { id: 'avec', label: 'Avec téléphone', value: stats.avecTelephone },
            {
              id: 'sans',
              label: 'Sans téléphone',
              value: Math.max(0, stats.total - stats.avecTelephone),
            },
          ],
        },
      ],
    }),
  },
  'qualite-de-saisie': {
    label: 'Qualité de saisie',
    forme: 'composition',
    question: 'Les visites sont-elles saisies à temps ?',
    description: 'Voir si la saisie est faite le jour même ou plus tard.',
    extraire: (stats) => ({
      forme: 'composition',
      donnee: [
        {
          ligne: 'Délai de saisie',
          segments: [
            { id: 'meme-jour', label: 'Le jour même', value: stats.saisieDifferee.memeJour },
            { id: 'lendemain', label: 'Le lendemain', value: stats.saisieDifferee.lendemain },
            { id: 'plus-tard', label: 'Plus tard', value: stats.saisieDifferee.plusTard },
          ],
        },
      ],
    }),
  },
} satisfies Record<string, SourceDefinition>;

export type VisiteSource = keyof typeof SOURCES;

const SOURCES_REGISTRE_ACCUEIL: readonly VisiteSource[] = [
  'total-visites',
  'moyenne-journaliere',
  'jour-le-plus-charge',
  'par-entreprise',
  'par-objet',
  'par-jour',
  'avec-telephone',
];

export function catalogueVisitesDe(role: Role): Readonly<Record<string, SourceDefinition>> {
  if (role !== 'ACCUEIL') return SOURCES;
  return Object.fromEntries(SOURCES_REGISTRE_ACCUEIL.map((source) => [source, SOURCES[source]]));
}

export function mesurerDonnees(donnees: DonneesSource): {
  nombreCategories: number;
  nombrePoints: number;
  partZero: number;
} {
  switch (donnees.forme) {
    case 'classement':
    case 'cyclique':
    case 'serie-temporelle': {
      const items = donnees.donnee;
      const zero = items.filter((item) => item.value === 0).length;
      return {
        nombreCategories: items.length,
        nombrePoints: items.length,
        partZero: items.length === 0 ? 0 : zero / items.length,
      };
    }
    case 'composition': {
      const items = donnees.donnee.flatMap((ligne) => ligne.segments);
      const zero = items.filter((item) => item.value === 0).length;
      return {
        nombreCategories: items.length,
        nombrePoints: items.length,
        partZero: items.length === 0 ? 0 : zero / items.length,
      };
    }
    case 'scalaire':
    case 'matrice':
    case 'equipe':
    default:
      return { nombreCategories: 0, nombrePoints: 0, partZero: 0 };
  }
}

export function donneesVides(donnees: DonneesSource): boolean {
  switch (donnees.forme) {
    case 'classement':
    case 'cyclique':
    case 'serie-temporelle':
      return donnees.donnee.length === 0;
    case 'composition': {
      const items = donnees.donnee.flatMap((ligne) => ligne.segments);
      return items.every((item) => item.value === 0);
    }
    case 'matrice':
      return donnees.donnee.cellules.every((cellule) => cellule.value === 0);
    default:
      return false;
  }
}

/** Une tuile prend une colonne, un graphique deux, un tableau ou une carte pleine quatre. */
export function spanClass(
  marque: DashboardMarque | undefined,
  taille: DashboardTaille | undefined,
): string {
  if (marque === 'tableau' || taille === 'pleine') return 'sm:col-span-2 xl:col-span-4';
  const tuile = marque === 'tuile' || marque === 'tuile-courbe' || marque === 'jauge';
  if (tuile && taille === undefined) return '';
  return 'sm:col-span-2 xl:col-span-2';
}

export function appliquerPresentation(
  items: readonly NamedCount[],
  presentation?: DispositionPresentation,
): NamedCount[] {
  const tri = presentation?.tri ?? 'valeur-desc';
  const trie = [...items].sort((a, b) => {
    if (tri === 'alphabetique') return a.label.localeCompare(b.label, 'fr');
    if (tri === 'valeur-asc') return a.value - b.value;
    return b.value - a.value;
  });

  const seuil = presentation?.autresApres;
  if (seuil === undefined || trie.length <= seuil) return trie;

  const tete = trie.slice(0, seuil);
  const reste = trie.slice(seuil);
  const autres = reste.reduce((somme, item) => somme + item.value, 0);
  return [...tete, { id: '__autres__', label: 'Autres', value: autres }];
}

/**
 * Ce que chaque marque honore réellement. Une commande de présentation qui
 * n'agit sur rien est un interrupteur inerte : c'est ce tableau qui décide,
 * marque par marque, quelles commandes le mode composition affiche.
 */
export interface ReglagesHonores {
  palette: boolean;
  valeurs: boolean;
  legende: boolean;
}

const REGLAGES_HONORES: Record<DashboardMarque, ReglagesHonores> = {
  'barres-verticales': { palette: true, valeurs: true, legende: false },
  'barres-horizontales': { palette: true, valeurs: true, legende: false },
  'barres-empilees': { palette: true, valeurs: true, legende: true },
  'barres-100': { palette: true, valeurs: true, legende: true },
  'barres-groupees': { palette: true, valeurs: true, legende: true },
  courbe: { palette: true, valeurs: true, legende: false },
  aire: { palette: true, valeurs: true, legende: false },
  escalier: { palette: true, valeurs: true, legende: false },
  anneau: { palette: true, valeurs: false, legende: true },
  camembert: { palette: true, valeurs: false, legende: true },
  'aire-polaire': { palette: true, valeurs: false, legende: true },
  radar: { palette: true, valeurs: false, legende: false },
  nuage: { palette: true, valeurs: false, legende: false },
  bulles: { palette: true, valeurs: false, legende: false },
  mixte: { palette: true, valeurs: true, legende: true },
  jauge: { palette: true, valeurs: false, legende: false },
  'carte-de-chaleur': { palette: false, valeurs: false, legende: false },
  tableau: { palette: false, valeurs: false, legende: false },
  tuile: { palette: false, valeurs: false, legende: false },
  'tuile-courbe': { palette: true, valeurs: false, legende: false },
};

export function reglagesHonores(marque: DashboardMarque | undefined): ReglagesHonores {
  if (marque === undefined) return { palette: false, valeurs: false, legende: false };
  return REGLAGES_HONORES[marque];
}
