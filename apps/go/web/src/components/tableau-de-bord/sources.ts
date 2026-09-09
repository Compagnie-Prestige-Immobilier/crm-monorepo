import type { Marque, Presentation, Taille } from '@/lib/data/disposition';

export type { Marque, Presentation, Taille };

/** Une part nommée : ce que la plupart des marques savent dessiner. */
export interface Valeur {
  id: string;
  label: string;
  value: number;
}

export type Forme =
  | 'scalaire'
  | 'classement'
  | 'serie-temporelle'
  | 'cyclique'
  | 'matrice'
  | 'composition'
  | 'equipe';

export interface Scalaire {
  libelle: string;
  valeur: number;
  /** Au lieu du nombre brut : un texte figé, ou le nombre à rouler et sa mise en forme. */
  affichage?: string | { valeur: number; format: (valeur: number) => string };
  serie?: Valeur[];
}

export interface LigneComposition {
  ligne: string;
  segments: Valeur[];
  /** Ce que le clic sur cette ligne ouvre, et ce que sa légende ajoute sous le nom. */
  id?: string;
  detail?: string;
}

export interface Matrice {
  lignes: string[];
  colonnes: string[];
  cellules: { ligne: string; colonne: string; value: number }[];
}

/** Une ligne d'équipe : des mesures d'unités DIFFÉRENTES sur une même personne. */
export interface LigneEquipe {
  id: string;
  nom: string;
  cellules: { cle: string; texte: string }[];
}

export interface Equipe {
  colonnes: string[];
  lignes: LigneEquipe[];
  /** Le pied se recalcule sur les sommes, jamais sur la moyenne des lignes. */
  pied?: LigneEquipe;
}

export type Donnees =
  | { forme: 'scalaire'; donnee: Scalaire }
  | { forme: 'classement'; donnee: Valeur[] }
  | { forme: 'serie-temporelle'; donnee: Valeur[] }
  | { forme: 'cyclique'; donnee: Valeur[] }
  | { forme: 'matrice'; donnee: Matrice }
  | { forme: 'composition'; donnee: LigneComposition[] }
  | { forme: 'equipe'; donnee: Equipe };

/** Ce que la grille sait d'une source, quel que soit l'écran qui la sert. */
export interface EntreeCatalogue {
  label: string;
  forme: Forme;
  question?: string;
  description?: string;
  groupe?: string;
  /** L'écran qu'ouvre une part du graphique, à partir de son identifiant. */
  lien?: (id: string) => string;
}

export type Catalogue = Readonly<Record<string, EntreeCatalogue>>;

export interface Mesure {
  nombreCategories: number;
  nombrePoints: number;
  partZero: number;
}

function mesurerListe(items: readonly Valeur[]): Mesure {
  const zero = items.filter((item) => item.value === 0).length;
  return {
    nombreCategories: items.length,
    nombrePoints: items.length,
    partZero: items.length === 0 ? 0 : zero / items.length,
  };
}

export function mesurerDonnees(donnees: Donnees): Mesure {
  if (donnees.forme === 'composition') {
    return mesurerListe(donnees.donnee.flatMap((ligne) => ligne.segments));
  }
  if (
    donnees.forme === 'classement' ||
    donnees.forme === 'cyclique' ||
    donnees.forme === 'serie-temporelle'
  ) {
    return mesurerListe(donnees.donnee);
  }
  return { nombreCategories: 0, nombrePoints: 0, partZero: 0 };
}

export function donneesVides(donnees: Donnees): boolean {
  if (
    donnees.forme === 'classement' ||
    donnees.forme === 'cyclique' ||
    donnees.forme === 'serie-temporelle'
  ) {
    return donnees.donnee.length === 0;
  }
  if (donnees.forme === 'composition') {
    return donnees.donnee.flatMap((ligne) => ligne.segments).every((item) => item.value === 0);
  }
  if (donnees.forme === 'matrice') {
    return donnees.donnee.cellules.every((cellule) => cellule.value === 0);
  }
  return false;
}

/** Une tuile prend une colonne, un graphique deux, un tableau ou une carte pleine quatre. */
export function classeSpan(marque: Marque | undefined, taille: Taille | undefined): string {
  if (marque === 'tableau' || taille === 'pleine') return 'sm:col-span-2 xl:col-span-4';
  const tuile = marque === 'tuile' || marque === 'tuile-courbe' || marque === 'jauge';
  if (tuile && taille === undefined) return '';
  return 'sm:col-span-2 xl:col-span-2';
}

export function appliquerPresentation(
  items: readonly Valeur[],
  presentation?: Presentation,
): Valeur[] {
  const tri = presentation?.tri ?? 'valeur-desc';
  const trie = [...items].sort((a, b) => {
    if (tri === 'alphabetique') return a.label.localeCompare(b.label, 'fr');
    if (tri === 'valeur-asc') return a.value - b.value;
    return b.value - a.value;
  });

  const seuil = presentation?.autresApres;
  if (seuil === undefined || trie.length <= seuil) return trie;

  const reste = trie.slice(seuil);
  const autres = reste.reduce((somme, item) => somme + item.value, 0);
  return [...trie.slice(0, seuil), { id: '__autres__', label: 'Autres', value: autres }];
}

export interface ReglagesHonores {
  palette: boolean;
  valeurs: boolean;
  legende: boolean;
}

/**
 * Ce que chaque marque honore réellement. Une commande de présentation qui
 * n'agit sur rien est un interrupteur inerte : ce tableau décide, marque par
 * marque, de ce que le mode organisation affiche.
 */
const HONORES: Record<Marque, ReglagesHonores> = {
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

export function reglagesHonores(marque: Marque | undefined): ReglagesHonores {
  if (marque === undefined) return { palette: false, valeurs: false, legende: false };
  return HONORES[marque];
}
