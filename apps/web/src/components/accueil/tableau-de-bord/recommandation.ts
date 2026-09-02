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
  scalaire: ['tuile'],
  classement: ['barres-horizontales', 'barres-verticales', 'anneau', 'camembert', 'tableau'],
  'serie-temporelle': ['courbe', 'aire', 'escalier', 'barres-verticales', 'mixte', 'tableau'],
  cyclique: ['barres-verticales', 'aire-polaire', 'tableau'],
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

interface Regles {
  readonly recommandations: Map<DashboardMarque, string>;
  readonly avertissements: Map<DashboardMarque, string>;
}

const CYCLE = 'Un cycle refermé se lit mieux qu’une ligne qui recommence.';

function reglesDesParts(mesure: Mesure, compatibles: DashboardMarque[], regles: Regles): void {
  if (mesure.nombreCategories > CINQ_PARTS) {
    regles.recommandations.set(
      'barres-horizontales',
      'Au-delà de cinq parts, la hauteur d’une barre se compare mieux qu’un angle.',
    );
    if (compatibles.includes('anneau')) {
      regles.avertissements.set('anneau', 'Illisible au-delà de cinq parts.');
    }
    if (compatibles.includes('camembert')) {
      regles.avertissements.set('camembert', 'Illisible au-delà de cinq parts.');
    }
    return;
  }

  if (mesure.nombreCategories >= 2 && compatibles.includes('anneau')) {
    regles.recommandations.set('anneau', 'La part se lit mieux que la hauteur.');
  }
}

function reglesDeLaSerie(mesure: Mesure, regles: Regles): void {
  if (mesure.nombrePoints > TRENTE_POINTS) {
    regles.recommandations.set(
      'courbe',
      'Une série dense se lit en tendance, pas barre par barre.',
    );
    regles.avertissements.set('barres-verticales', 'Quatre-vingt-dix barres ne se lisent pas.');
    return;
  }

  if (mesure.nombrePoints < DIX_POINTS) {
    regles.recommandations.set(
      'barres-verticales',
      'Une série courte se compte, elle ne se tend pas.',
    );
    regles.avertissements.set('courbe', 'Une tendance sur sept points n’en est pas une.');
  }
}

function comparerMarques(tableauEnTete: boolean) {
  return (a: MarqueEvaluee, b: MarqueEvaluee): number => {
    if (tableauEnTete && a.marque === 'tableau') return -1;
    if (tableauEnTete && b.marque === 'tableau') return 1;
    if (a.recommandee === b.recommandee) return 0;
    return a.recommandee ? -1 : 1;
  };
}

/**
 * Classe les marques compatibles avec une source au vu de ses données réelles.
 * Les règles de ce fichier sont pures et se testent une par une.
 */
export function evaluerMarques(forme: Forme, mesure: Mesure): MarqueEvaluee[] {
  const compatibles = marquesCompatibles(forme);
  const regles: Regles = { recommandations: new Map(), avertissements: new Map() };

  if (forme === 'classement' || forme === 'composition') {
    reglesDesParts(mesure, compatibles, regles);
  }
  if (forme === 'serie-temporelle') reglesDeLaSerie(mesure, regles);
  if (forme === 'cyclique') {
    regles.recommandations.set('aire-polaire', CYCLE);
    regles.recommandations.set('radar', CYCLE);
  }
  if (forme === 'matrice') {
    regles.recommandations.set(
      'carte-de-chaleur',
      'Une matrice ne se lit qu’en croisement : la couleur montre les deux axes à la fois.',
    );
  }

  const tableauEnTete = mesure.partZero > SEUIL_ZERO && compatibles.includes('tableau');
  if (tableauEnTete) {
    regles.recommandations.set(
      'tableau',
      'La moitié des catégories sont à zéro : le tableau les nomme, un graphique les tairait.',
    );
  }

  const evaluees = compatibles.map((marque): MarqueEvaluee => ({
    marque,
    recommandee: regles.recommandations.has(marque),
    raison: regles.recommandations.get(marque) ?? regles.avertissements.get(marque) ?? null,
  }));

  return evaluees.sort(comparerMarques(tableauEnTete));
}

export function marqueRecommandee(forme: Forme, mesure: Mesure): DashboardMarque {
  return evaluerMarques(forme, mesure)[0]?.marque ?? marquesCompatibles(forme)[0] ?? 'tableau';
}
