import type { Forme, Marque, Mesure } from '@/components/tableau-de-bord/sources';

export interface MarqueEvaluee {
  marque: Marque;
  recommandee: boolean;
  raison: string | null;
}

/**
 * Aligné sur `reglesParSource` du serveur : une marque hors de sa liste y
 * retombe silencieusement sur le défaut, donc la proposer serait un mensonge.
 */
const COMPATIBLES: Record<Forme, Marque[]> = {
  scalaire: ['tuile'],
  classement: ['barres-horizontales', 'barres-verticales', 'anneau', 'camembert', 'tableau'],
  'serie-temporelle': ['courbe', 'aire', 'escalier', 'barres-verticales'],
  cyclique: ['barres-verticales', 'radar', 'aire-polaire'],
  matrice: ['carte-de-chaleur', 'tableau'],
  composition: ['barres-empilees', 'barres-100', 'anneau', 'camembert', 'tableau'],
  // Des colonnes d'unités différentes sur une même personne : aucun graphique
  // ne les met sur le même axe sans mentir.
  equipe: ['tableau'],
};

const CINQ_PARTS = 5;
const TRENTE_POINTS = 30;
const DIX_POINTS = 10;
const SEUIL_ZERO = 0.3;
const CYCLE = 'Un cycle refermé se lit mieux qu’une ligne qui recommence.';

interface Regles {
  readonly recommandations: Map<Marque, string>;
  readonly avertissements: Map<Marque, string>;
}

function reglesDesParts(mesure: Mesure, compatibles: Marque[], regles: Regles): void {
  if (mesure.nombreCategories > CINQ_PARTS) {
    regles.recommandations.set(
      'barres-horizontales',
      'Au-delà de cinq parts, la hauteur d’une barre se compare mieux qu’un angle.',
    );
    for (const marque of (['anneau', 'camembert'] as const).filter((candidate) =>
      compatibles.includes(candidate),
    )) {
      regles.avertissements.set(marque, 'Illisible au-delà de cinq parts.');
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

function reglesDeLaForme(
  forme: Forme,
  mesure: Mesure,
  compatibles: Marque[],
  regles: Regles,
): void {
  if (forme === 'classement' || forme === 'composition') {
    reglesDesParts(mesure, compatibles, regles);
    return;
  }
  if (forme === 'serie-temporelle') {
    reglesDeLaSerie(mesure, regles);
    return;
  }
  if (forme === 'cyclique') {
    regles.recommandations.set('aire-polaire', CYCLE);
    regles.recommandations.set('radar', CYCLE);
    return;
  }
  if (forme === 'matrice') {
    regles.recommandations.set(
      'carte-de-chaleur',
      'Une matrice ne se lit qu’en croisement : la couleur montre les deux axes à la fois.',
    );
  }
}

function comparer(tableauEnTete: boolean) {
  return (a: MarqueEvaluee, b: MarqueEvaluee): number => {
    if (tableauEnTete && a.marque === 'tableau') return -1;
    if (tableauEnTete && b.marque === 'tableau') return 1;
    if (a.recommandee === b.recommandee) return 0;
    return a.recommandee ? -1 : 1;
  };
}

/** Classe les marques compatibles avec une source au vu de ses données réelles. */
export function evaluerMarques(forme: Forme, mesure: Mesure): MarqueEvaluee[] {
  const compatibles = COMPATIBLES[forme];
  const regles: Regles = { recommandations: new Map(), avertissements: new Map() };
  reglesDeLaForme(forme, mesure, compatibles, regles);

  const tableauEnTete = mesure.partZero > SEUIL_ZERO && compatibles.includes('tableau');
  if (tableauEnTete) {
    regles.recommandations.set(
      'tableau',
      'Un tiers des catégories sont à zéro : le tableau les nomme, un graphique les tairait.',
    );
  }

  return compatibles
    .map((marque) => ({
      marque,
      recommandee: regles.recommandations.has(marque),
      raison: regles.recommandations.get(marque) ?? regles.avertissements.get(marque) ?? null,
    }))
    .sort(comparer(tableauEnTete));
}

export function marqueRecommandee(forme: Forme, mesure: Mesure): Marque {
  return evaluerMarques(forme, mesure)[0]?.marque ?? COMPATIBLES[forme][0] ?? 'tableau';
}
