import type { components } from '@crm/api-client';

import { MOIS_LABELS } from '@/lib/data/visites-stats';
import type { NamedCount } from '@/lib/types';

type Schemas = components['schemas'];

export type DashboardSource = Schemas['DashboardSource'];
export type DashboardMarque = Schemas['DashboardMarque'];
export type DashboardTaille = Schemas['DashboardTaille'];
export type DashboardPreset = Schemas['DashboardPreset'];
export type DispositionPresentation = Schemas['DispositionPresentationDto'];
export type VisiteStats = Schemas['VisiteStatsDto'];

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
  serie?: NamedCount[];
}

export interface CompositionLigne {
  ligne: string;
  segments: NamedCount[];
}

export interface MatriceCellule {
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
}

export type DonneesSource =
  | { forme: 'scalaire'; donnee: ScalaireDatum }
  | { forme: 'classement'; donnee: NamedCount[] }
  | { forme: 'serie-temporelle'; donnee: NamedCount[] }
  | { forme: 'cyclique'; donnee: NamedCount[] }
  | { forme: 'matrice'; donnee: MatriceDatum }
  | { forme: 'composition'; donnee: CompositionLigne[] }
  | { forme: 'equipe'; donnee: EquipeDatum };

export interface SourceDefinition {
  label: string;
  forme: Forme;
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
    extraire: (stats) => ({
      forme: 'scalaire',
      donnee: { libelle: 'Total des visites', valeur: stats.total },
    }),
  },
  'moyenne-journaliere': {
    label: 'Moyenne journalière',
    forme: 'scalaire',
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
    extraire: (stats) => ({ forme: 'classement', donnee: bucketRank(stats.parEntreprise) }),
  },
  'par-objet': {
    label: 'Par objet',
    forme: 'classement',
    extraire: (stats) => ({ forme: 'classement', donnee: bucketRank(stats.parObjet) }),
  },
  'par-direction': {
    label: 'Par direction',
    forme: 'classement',
    extraire: (stats) => ({ forme: 'classement', donnee: bucketRank(stats.parDirection) }),
  },
  'par-destinataire': {
    label: 'Par destinataire',
    forme: 'classement',
    extraire: (stats) => ({ forme: 'classement', donnee: bucketRank(stats.parDestinataire) }),
  },
  'par-agent': {
    label: 'Par agent',
    forme: 'classement',
    extraire: (stats) => ({ forme: 'classement', donnee: bucketRank(stats.parAgent) }),
  },
  'visiteurs-recurrents': {
    label: 'Visiteurs récurrents',
    forme: 'classement',
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

/** Une clé qui n'existe pas dans le contrat de l'API rougit sur cette ligne. */
export const SOURCES_DU_REGISTRE: readonly DashboardSource[] = Object.keys(
  SOURCES,
) as VisiteSource[];

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

export function spanClass(
  marque: DashboardMarque | undefined,
  taille: DashboardTaille | undefined,
): string {
  if (marque === 'tuile' || marque === 'tuile-courbe' || marque === 'jauge') return '';
  if (taille === 'pleine') return 'sm:col-span-2 xl:col-span-4';
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

export const REGLAGES_HONORES: Record<DashboardMarque, ReglagesHonores> = {
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
