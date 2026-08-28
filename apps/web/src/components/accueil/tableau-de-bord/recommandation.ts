import type { DashboardMarque, Forme } from '@/components/accueil/tableau-de-bord/sources';

export interface Mesure {
  nombreCategories: number;
  nombrePoints: number;
  partZero: number;
}

export interface MarqueEvaluee {
  marque: DashboardMarque;
  recommandee: boolean;
  raison: string | null;
}

const COMPATIBLES: Record<Forme, DashboardMarque[]> = {
  scalaire: ['tuile', 'tuile-courbe', 'jauge', 'tableau'],
  classement: [
    'barres-horizontales',
    'barres-verticales',
    'barres-groupees',
    'anneau',
    'camembert',
    'nuage',
    'bulles',
    'tableau',
  ],
  'serie-temporelle': ['courbe', 'aire', 'escalier', 'barres-verticales', 'mixte', 'tableau'],
  cyclique: ['aire-polaire', 'radar', 'barres-verticales', 'tableau'],
  matrice: ['carte-de-chaleur', 'tableau'],
  composition: ['barres-empilees', 'barres-100', 'anneau', 'camembert', 'tableau'],
  // Des colonnes d'unités différentes sur une même personne : aucun graphique
  // ne les met sur le même axe sans mentir.
  equipe: ['tableau'],
};

export function marquesCompatibles(forme: Forme): DashboardMarque[] {
  return COMPATIBLES[forme];
}

const CINQ_PARTS = 5;
const TRENTE_POINTS = 30;
const DIX_POINTS = 10;
const SEUIL_ZERO = 0.3;

/**
 * Classe les marques compatibles avec une source au vu de ses données réelles.
 * Les règles de ce fichier sont pures et se testent une par une.
 */
export function evaluerMarques(forme: Forme, mesure: Mesure): MarqueEvaluee[] {
  const compatibles = marquesCompatibles(forme);
  const recommandations = new Map<DashboardMarque, string>();
  const avertissements = new Map<DashboardMarque, string>();

  if (forme === 'classement' || forme === 'composition') {
    if (mesure.nombreCategories > CINQ_PARTS) {
      recommandations.set(
        'barres-horizontales',
        'Au-delà de cinq parts, la hauteur d’une barre se compare mieux qu’un angle.',
      );
      if (compatibles.includes('anneau')) {
        avertissements.set('anneau', 'Illisible au-delà de cinq parts.');
      }
      if (compatibles.includes('camembert')) {
        avertissements.set('camembert', 'Illisible au-delà de cinq parts.');
      }
    } else if (mesure.nombreCategories >= 2 && compatibles.includes('anneau')) {
      recommandations.set('anneau', 'La part se lit mieux que la hauteur.');
    }
  }

  if (forme === 'serie-temporelle') {
    if (mesure.nombrePoints > TRENTE_POINTS) {
      recommandations.set('courbe', 'Une série dense se lit en tendance, pas barre par barre.');
      avertissements.set('barres-verticales', 'Quatre-vingt-dix barres ne se lisent pas.');
    } else if (mesure.nombrePoints < DIX_POINTS) {
      recommandations.set('barres-verticales', 'Une série courte se compte, elle ne se tend pas.');
      avertissements.set('courbe', 'Une tendance sur sept points n’en est pas une.');
    }
  }

  if (forme === 'cyclique') {
    recommandations.set(
      'aire-polaire',
      'Un cycle refermé se lit mieux qu’une ligne qui recommence.',
    );
    recommandations.set('radar', 'Un cycle refermé se lit mieux qu’une ligne qui recommence.');
  }

  if (forme === 'matrice') {
    recommandations.set(
      'carte-de-chaleur',
      'Une matrice ne se lit qu’en croisement : la couleur montre les deux axes à la fois.',
    );
  }

  let tableauEnTete = false;
  if (mesure.partZero > SEUIL_ZERO && compatibles.includes('tableau')) {
    recommandations.set(
      'tableau',
      'La moitié des catégories sont à zéro : le tableau les nomme, un graphique les tairait.',
    );
    tableauEnTete = true;
  }

  const evaluees = compatibles.map((marque): MarqueEvaluee => ({
    marque,
    recommandee: recommandations.has(marque),
    raison: recommandations.get(marque) ?? avertissements.get(marque) ?? null,
  }));

  return evaluees.sort((a, b) => {
    if (tableauEnTete) {
      if (a.marque === 'tableau') return -1;
      if (b.marque === 'tableau') return 1;
    }
    if (a.recommandee === b.recommandee) return 0;
    return a.recommandee ? -1 : 1;
  });
}

export function marqueRecommandee(forme: Forme, mesure: Mesure): DashboardMarque {
  return evaluerMarques(forme, mesure)[0]?.marque ?? marquesCompatibles(forme)[0] ?? 'tableau';
}
