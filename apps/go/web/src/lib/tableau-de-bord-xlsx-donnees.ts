import type {
  Donnees,
  Equipe,
  LigneComposition,
  LigneEquipe,
  Matrice,
  Scalaire,
  Valeur,
} from '@/components/tableau-de-bord/sources';

export type Cellule = string | number | null;

export interface Tableau {
  colonnes: readonly string[];
  lignes: readonly (readonly Cellule[])[];
  /** Rang de la colonne à mettre en pourcentage, 1 pour la première. */
  colonnePart?: number;
  total?: readonly Cellule[];
}

/** Excel attend une fraction, pas un nombre de points de pourcentage. */
function part(valeur: number, total: number): number | null {
  return total === 0 ? null : valeur / total;
}

/** Un nombre déjà mis en forme reste sommable ; un taux ou une durée non. */
const NOMBRE_SEUL = /^-?\d+(?:\s\d{3})*(?:,\d+)?$/u;

/** `Intl` sépare les milliers par une espace insécable étroite, que `\s` couvre. */
function nombreOuTexte(texte: string): Cellule {
  if (!NOMBRE_SEUL.test(texte)) return texte;
  return Number(texte.replace(/\s/gu, '').replace(',', '.'));
}

function tableauScalaire(donnee: Scalaire): Tableau {
  const serie = donnee.serie ?? [];
  if (serie.length === 0) {
    return { colonnes: ['Indicateur', 'Valeur'], lignes: [[donnee.libelle, donnee.valeur]] };
  }
  return {
    colonnes: ['Période', donnee.libelle],
    lignes: serie.map((point) => [point.label, point.value]),
    total: ['Total', donnee.valeur],
  };
}

function tableauClassement(donnee: readonly Valeur[]): Tableau {
  const total = donnee.reduce((somme, point) => somme + point.value, 0);
  return {
    colonnes: ['Libellé', 'Valeur', 'Part'],
    lignes: donnee.map((point) => [point.label, point.value, part(point.value, total)]),
    colonnePart: 3,
    total: ['Total', total, part(total, total)],
  };
}

function tableauSerie(donnee: readonly Valeur[]): Tableau {
  const total = donnee.reduce((somme, point) => somme + point.value, 0);
  return {
    colonnes: ['Période', 'Valeur'],
    lignes: donnee.map((point) => [point.label, point.value]),
    total: ['Total', total],
  };
}

function tableauComposition(donnee: readonly LigneComposition[]): Tableau {
  const segments = [
    ...new Set(donnee.flatMap((ligne) => ligne.segments.map((segment) => segment.label))),
  ];
  return {
    colonnes: ['Ligne', ...segments, 'Total'],
    lignes: donnee.map((ligne) => {
      const parLibelle = new Map(ligne.segments.map((segment) => [segment.label, segment.value]));
      const valeurs = segments.map((segment) => parLibelle.get(segment) ?? 0);
      return [ligne.ligne, ...valeurs, valeurs.reduce((somme, valeur) => somme + valeur, 0)];
    }),
  };
}

function tableauMatrice(donnee: Matrice): Tableau {
  const parCellule = new Map(
    donnee.cellules.map((cellule) => [`${cellule.ligne} ${cellule.colonne}`, cellule.value]),
  );
  return {
    colonnes: ['', ...donnee.colonnes],
    lignes: donnee.lignes.map((ligne) => [
      ligne,
      ...donnee.colonnes.map((colonne) => parCellule.get(`${ligne} ${colonne}`) ?? 0),
    ]),
  };
}

function tableauEquipe(donnee: Equipe): Tableau {
  const enLigne = (ligne: LigneEquipe): Cellule[] => [
    ligne.nom,
    ...ligne.cellules.map((cellule) => nombreOuTexte(cellule.texte)),
  ];
  const pied = donnee.pied;
  return {
    colonnes: ['Nom', ...donnee.colonnes],
    lignes: donnee.lignes.map(enLigne),
    ...(pied === undefined ? {} : { total: enLigne(pied) }),
  };
}

export function enTableau(donnees: Donnees): Tableau {
  if (donnees.forme === 'scalaire') return tableauScalaire(donnees.donnee);
  if (donnees.forme === 'classement') return tableauClassement(donnees.donnee);
  if (donnees.forme === 'composition') return tableauComposition(donnees.donnee);
  if (donnees.forme === 'matrice') return tableauMatrice(donnees.donnee);
  if (donnees.forme === 'equipe') return tableauEquipe(donnees.donnee);
  return tableauSerie(donnees.donnee);
}

export function estNombreSeul(donnees: Donnees): boolean {
  return donnees.forme === 'scalaire' && (donnees.donnee.serie ?? []).length === 0;
}
