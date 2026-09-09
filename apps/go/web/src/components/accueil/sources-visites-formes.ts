import type {
  Donnees,
  EntreeCatalogue,
  Matrice,
  Valeur,
} from '@/components/tableau-de-bord/sources';
import { MOIS_LABELS, type StatsVisites } from '@/lib/data/visites-stats';

export interface SourceVisite extends EntreeCatalogue {
  extraire: (stats: StatsVisites) => Donnees;
}

export const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const HEURES = Array.from(
  { length: 24 },
  (_, heure) => `${String(heure).padStart(2, '0')}h`,
);

export function joursDePeriode(from: string, to: string): number {
  const debut = new Date(`${from}T00:00:00Z`).getTime();
  const fin = new Date(`${to}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((fin - debut) / 86_400_000) + 1);
}

export function enValeurs(
  items: readonly { id: string; label: string; count: number }[],
): Valeur[] {
  return items.map((item) => ({ id: item.id, label: item.label, value: item.count }));
}

export function libelles(items: readonly { id: string; label: string }[]): Map<string, string> {
  return new Map(items.map((item) => [item.id, item.label]));
}

export function moisLabel(mois: string): string {
  const [annee, rang] = mois.split('-');
  return `${MOIS_LABELS[Number(rang) - 1] ?? mois} ${annee ?? ''}`.trim();
}

export function croisement(
  points: readonly { ligneId: string; colonneId: string; count: number }[],
  lignes: Map<string, string>,
  colonnes: Map<string, string>,
): Matrice {
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

interface Intitule {
  label: string;
  question: string;
  description: string;
}

export function scalaire(
  intitule: Intitule,
  extraire: (stats: StatsVisites) => { libelle: string; valeur: number },
): SourceVisite {
  return {
    ...intitule,
    forme: 'scalaire',
    extraire: (stats) => ({ forme: 'scalaire', donnee: extraire(stats) }),
  };
}

export function classement(
  intitule: Intitule,
  extraire: (stats: StatsVisites) => Valeur[],
): SourceVisite {
  return {
    ...intitule,
    forme: 'classement',
    extraire: (stats) => ({ forme: 'classement', donnee: extraire(stats) }),
  };
}

export function serie(
  intitule: Intitule,
  extraire: (stats: StatsVisites) => Valeur[],
): SourceVisite {
  return {
    ...intitule,
    forme: 'serie-temporelle',
    extraire: (stats) => ({ forme: 'serie-temporelle', donnee: extraire(stats) }),
  };
}

export function cyclique(
  intitule: Intitule,
  extraire: (stats: StatsVisites) => Valeur[],
): SourceVisite {
  return {
    ...intitule,
    forme: 'cyclique',
    extraire: (stats) => ({ forme: 'cyclique', donnee: extraire(stats) }),
  };
}

export function matrice(
  intitule: Intitule,
  extraire: (stats: StatsVisites) => Matrice,
): SourceVisite {
  return {
    ...intitule,
    forme: 'matrice',
    extraire: (stats) => ({ forme: 'matrice', donnee: extraire(stats) }),
  };
}

export function composition(
  intitule: Intitule,
  extraire: (stats: StatsVisites) => Valeur[],
  ligne: string,
): SourceVisite {
  return {
    ...intitule,
    forme: 'composition',
    extraire: (stats) => ({
      forme: 'composition',
      donnee: [{ ligne, segments: extraire(stats) }],
    }),
  };
}
