import type * as ExcelJS from 'exceljs';
import type { Cell, Row, Workbook, Worksheet } from 'exceljs';

import type {
  CompositionLigne,
  DonneesSource,
  EquipeDatum,
  MatriceDatum,
  ScalaireDatum,
} from '@/components/accueil/tableau-de-bord/sources';
import type { NamedCount } from '@/lib/types';

const BORDEAUX = 'FF630210';
const OR_CLAIR = 'FFFFC65A';
const ZEBRE = 'FFF6F2F3';
const TRAIT = 'FFC9C2C4';
const GRIS = 'FF6B5F62';
const BLANC = 'FFFFFFFF';

const LARGEUR_BANDEAU = 6;
const HAUTEUR_BANDEAU = 6;

type ModuleExcel = typeof ExcelJS;

type Cellule = string | number | null;

interface Tableau {
  colonnes: readonly string[];
  lignes: readonly (readonly Cellule[])[];
  /** Rang de la colonne à mettre en pourcentage, 1 pour la première. */
  colonnePart?: number;
  total?: readonly Cellule[];
}

export interface FeuilleTableauDeBord {
  titre: string;
  question?: string | undefined;
  donnees: DonneesSource;
}

export interface ClasseurTableauDeBord {
  /** Sans extension : elle est ajoutée au téléchargement. */
  fichier: string;
  titre: string;
  sousTitre: string;
  reperes: readonly { libelle: string; valeur: string }[];
  feuilles: readonly FeuilleTableauDeBord[];
}

export async function telechargerTableauDeBord(classeur: ClasseurTableauDeBord): Promise<void> {
  const { Workbook: Classeur } = await chargerExcel();
  const workbook = new Classeur();
  workbook.creator = 'CPI GO';
  workbook.created = new Date();

  const pris = new Set(['Charte']);
  const pages = classeur.feuilles.map((feuille) => ({
    feuille,
    onglet: nomUnique(feuille.titre, pris),
    tableau: enTableau(feuille.donnees),
  }));

  ecrireCharte(workbook, classeur, pages, await logoCpi());
  for (const page of pages) ecrireFeuille(workbook, page);

  const buffer = await workbook.xlsx.writeBuffer();
  telecharger(buffer, `${classeur.fichier}.xlsx`);
}

/** Le paquet est publié en UMD : selon l'empaqueteur, la classe est sur le module ou sur son `default`. */
async function chargerExcel(): Promise<ModuleExcel> {
  const charge = await import('exceljs');
  return (charge as { default?: ModuleExcel }).default ?? charge;
}

interface Page {
  feuille: FeuilleTableauDeBord;
  onglet: string;
  tableau: Tableau;
}

function ecrireCharte(
  workbook: Workbook,
  classeur: ClasseurTableauDeBord,
  pages: readonly Page[],
  logo: ArrayBuffer | null,
): void {
  const sheet = workbook.addWorksheet('Charte', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [
    { width: 3 },
    { width: 6 },
    { width: 42 },
    { width: 58 },
    { width: 11 },
    { width: 3 },
  ];

  peindreBandeau(sheet);
  poserLogo(workbook, sheet, logo);

  titrerBandeau(sheet.getCell('C3'), classeur.titre, 22, BLANC);
  titrerBandeau(sheet.getCell('C5'), classeur.sousTitre, 11, OR_CLAIR);

  let ligne = HAUTEUR_BANDEAU + 2;
  for (const repere of classeur.reperes) {
    ecrireRepere(sheet.getRow(ligne), repere);
    ligne += 1;
  }

  ligne += 1;
  intituler(sheet.getCell(ligne, 3), 'Ce que contient ce classeur');
  ligne += 2;

  ecrireEnTeteSommaire(sheet.getRow(ligne), ['Feuille', 'Ce qu’elle répond', 'Lignes']);
  ligne += 1;

  pages.forEach((page, index) => {
    ecrireLigneSommaire(sheet.getRow(ligne + index), page, index);
  });
}

function peindreBandeau(sheet: Worksheet): void {
  for (let ligne = 1; ligne <= HAUTEUR_BANDEAU; ligne += 1) {
    const row = sheet.getRow(ligne);
    row.height = 20;
    for (let colonne = 1; colonne <= LARGEUR_BANDEAU; colonne += 1) {
      row.getCell(colonne).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BORDEAUX } };
    }
  }
}

function poserLogo(workbook: Workbook, sheet: Worksheet, logo: ArrayBuffer | null): void {
  if (logo === null) return;
  const image = workbook.addImage({ buffer: logo, extension: 'png' });
  sheet.addImage(image, { tl: { col: 4.35, row: 1.6 }, ext: { width: 150, height: 61 } });
}

function titrerBandeau(cellule: Cell, texte: string, taille: number, couleur: string): void {
  cellule.value = texte;
  cellule.font = { bold: true, size: taille, color: { argb: couleur } };
  cellule.alignment = { vertical: 'middle' };
}

function ecrireRepere(row: Row, repere: { libelle: string; valeur: string }): void {
  const libelle = row.getCell(3);
  libelle.value = repere.libelle;
  libelle.font = { bold: true, size: 10, color: { argb: GRIS } };
  libelle.alignment = { vertical: 'middle' };

  const valeur = row.getCell(4);
  valeur.value = repere.valeur;
  valeur.font = { size: 11 };
  valeur.alignment = { vertical: 'middle' };
  row.height = 18;
}

function intituler(cellule: Cell, texte: string): void {
  cellule.value = texte;
  cellule.font = { bold: true, size: 13, color: { argb: BORDEAUX } };
}

function ecrireEnTeteSommaire(row: Row, colonnes: readonly string[]): void {
  row.height = 22;
  colonnes.forEach((titre, index) => {
    const cellule = row.getCell(index + 3);
    cellule.value = titre;
    cellule.font = { bold: true, size: 11, color: { argb: BLANC } };
    cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BORDEAUX } };
    cellule.alignment = { vertical: 'middle' };
  });
}

function ecrireLigneSommaire(row: Row, page: Page, index: number): void {
  const cellules: Cellule[] = [
    page.onglet,
    page.feuille.question ?? page.feuille.titre,
    page.tableau.lignes.length,
  ];
  row.height = 18;
  cellules.forEach((valeur, colonne) => {
    habillerCelluleSommaire(row.getCell(colonne + 3), valeur, index);
  });
}

function habillerCelluleSommaire(cellule: Cell, valeur: Cellule, index: number): void {
  cellule.value = valeur;
  cellule.alignment = { vertical: 'middle' };
  cellule.border = { bottom: { style: 'hair', color: { argb: TRAIT } } };
  if (index % 2 === 1) {
    cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRE } };
  }
}

function ecrireFeuille(workbook: Workbook, page: Page): void {
  const sheet = workbook.addWorksheet(page.onglet, {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
  });
  const { colonnes, lignes, total, colonnePart } = page.tableau;

  intituler(sheet.getCell('A1'), page.feuille.titre);
  const question = sheet.getCell('A2');
  question.value = page.feuille.question ?? '';
  question.font = { size: 10, color: { argb: GRIS } };

  ecrireEnTete(sheet.getRow(4), colonnes);
  lignes.forEach((valeurs, index) => {
    habillerLigne(sheet.getRow(5 + index), valeurs, index, colonnePart);
  });
  if (total !== undefined) ecrireTotal(sheet.getRow(5 + lignes.length), total, colonnePart);

  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: colonnes.length } };
  ajusterLargeurs(sheet, page.tableau);
}

function ecrireEnTete(row: Row, colonnes: readonly string[]): void {
  row.height = 22;
  colonnes.forEach((titre, index) => {
    const cellule = row.getCell(index + 1);
    cellule.value = titre;
    cellule.font = { bold: true, size: 11, color: { argb: BLANC } };
    cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BORDEAUX } };
    cellule.alignment = { vertical: 'middle', wrapText: true };
  });
}

function habillerLigne(
  row: Row,
  valeurs: readonly Cellule[],
  index: number,
  colonnePart: number | undefined,
): void {
  valeurs.forEach((valeur, colonne) => {
    const cellule = row.getCell(colonne + 1);
    cellule.value = valeur;
    cellule.border = { bottom: { style: 'hair', color: { argb: TRAIT } } };
    cellule.numFmt = formatDe(colonne + 1, colonnePart, typeof valeur === 'number');
    if (index % 2 === 1) {
      cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRE } };
    }
  });
}

/** Un code de format Excel s'écrit toujours en notation anglaise ; le tableur le rend en local. */
function formatDe(colonne: number, colonnePart: number | undefined, nombre: boolean): string {
  if (colonne === colonnePart) return '0.0%';
  return nombre ? '#,##0' : 'General';
}

function ecrireTotal(row: Row, total: readonly Cellule[], colonnePart: number | undefined): void {
  total.forEach((valeur, colonne) => {
    const cellule = row.getCell(colonne + 1);
    cellule.value = valeur;
    cellule.font = { bold: true };
    cellule.border = { top: { style: 'thin', color: { argb: BORDEAUX } } };
    cellule.numFmt = formatDe(colonne + 1, colonnePart, typeof valeur === 'number');
  });
}

function ajusterLargeurs(sheet: Worksheet, tableau: Tableau): void {
  tableau.colonnes.forEach((titre, index) => {
    const part = index + 1 === tableau.colonnePart;
    sheet.getColumn(index + 1).width = part ? 12 : largeurColonne(titre, tableau.lignes, index);
  });
}

/** Une fraction s'écrit `0.6069` en mémoire : sa largeur se mesure sur l'en-tête, pas sur elle. */
function largeurColonne(
  titre: string,
  lignes: readonly (readonly Cellule[])[],
  index: number,
): number {
  const tailles = lignes.map((ligne) => String(ligne[index] ?? '').length + 3);
  return Math.min(52, Math.max(12, titre.length + 4, ...tailles));
}

function enTableau(donnees: DonneesSource): Tableau {
  if (donnees.forme === 'scalaire') return tableauScalaire(donnees.donnee);
  if (donnees.forme === 'classement') return tableauClassement(donnees.donnee);
  if (donnees.forme === 'composition') return tableauComposition(donnees.donnee);
  if (donnees.forme === 'matrice') return tableauMatrice(donnees.donnee);
  if (donnees.forme === 'equipe') return tableauEquipe(donnees.donnee);
  return tableauSerie(donnees.donnee);
}

function tableauScalaire(donnee: ScalaireDatum): Tableau {
  const serie = donnee.serie ?? [];
  if (serie.length === 0) {
    return {
      colonnes: ['Indicateur', 'Valeur'],
      lignes: [[donnee.libelle, donnee.valeur]],
    };
  }
  return {
    colonnes: ['Période', donnee.libelle],
    lignes: serie.map((point) => [point.label, point.value]),
    total: ['Total', donnee.valeur],
  };
}

function tableauClassement(donnee: readonly NamedCount[]): Tableau {
  const total = donnee.reduce((somme, point) => somme + point.value, 0);
  return {
    colonnes: ['Libellé', 'Valeur', 'Part'],
    lignes: donnee.map((point) => [point.label, point.value, part(point.value, total)]),
    colonnePart: 3,
    total: ['Total', total, part(total, total)],
  };
}

function tableauSerie(donnee: readonly NamedCount[]): Tableau {
  const total = donnee.reduce((somme, point) => somme + point.value, 0);
  return {
    colonnes: ['Période', 'Valeur'],
    lignes: donnee.map((point) => [point.label, point.value]),
    total: ['Total', total],
  };
}

function tableauComposition(donnee: readonly CompositionLigne[]): Tableau {
  const segments = [...new Set(donnee.flatMap((ligne) => ligne.segments.map((s) => s.label)))];
  return {
    colonnes: ['Ligne', ...segments, 'Total'],
    lignes: donnee.map((ligne) => ligneDeComposition(ligne, segments)),
  };
}

function ligneDeComposition(ligne: CompositionLigne, segments: readonly string[]): Cellule[] {
  const parLabel = new Map(ligne.segments.map((segment) => [segment.label, segment.value]));
  const valeurs = segments.map((segment) => parLabel.get(segment) ?? 0);
  return [ligne.ligne, ...valeurs, valeurs.reduce((somme, valeur) => somme + valeur, 0)];
}

function tableauMatrice(donnee: MatriceDatum): Tableau {
  const parCellule = new Map(
    donnee.cellules.map((cellule) => [`${cellule.ligne} ${cellule.colonne}`, cellule.value]),
  );
  return {
    colonnes: ['', ...donnee.colonnes],
    lignes: donnee.lignes.map((ligne) => [
      ligne,
      ...donnee.colonnes.map((colonne) => parCellule.get(`${ligne} ${colonne}`) ?? 0),
    ]),
  };
}

function tableauEquipe(donnee: EquipeDatum): Tableau {
  const enLigne = (ligne: EquipeDatum['lignes'][number]): Cellule[] => [
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

/** Un nombre déjà mis en forme reste sommable dans le tableur ; un taux ou une durée non. */
const NOMBRE_SEUL = /^-?\d+(?:\s\d{3})*(?:,\d+)?$/u;

/** `Intl` sépare les milliers par une espace insécable étroite, que `\s` couvre. */
function nombreOuTexte(texte: string): Cellule {
  if (!NOMBRE_SEUL.test(texte)) return texte;
  return Number(texte.replace(/\s/gu, '').replace(',', '.'));
}

/** Excel attend une fraction, pas un nombre de points de pourcentage. */
function part(valeur: number, total: number): number | null {
  return total === 0 ? null : valeur / total;
}

/** Ce qu'Excel refuse dans un nom d'onglet, plus la limite de 31 caractères. */
const CARACTERES_INTERDITS = /[[\]:*?/\\]/gu;

function nomUnique(titre: string, pris: Set<string>): string {
  const base = titre.replace(CARACTERES_INTERDITS, ' ').trim().slice(0, 31) || 'Feuille';
  let nom = base;
  let rang = 2;
  while (pris.has(nom)) {
    const suffixe = ` ${String(rang)}`;
    nom = base.slice(0, 31 - suffixe.length) + suffixe;
    rang += 1;
  }
  pris.add(nom);
  return nom;
}

async function logoCpi(): Promise<ArrayBuffer | null> {
  try {
    const reponse = await fetch('/brand/cpi-logo.png');
    if (!reponse.ok) return null;
    return await reponse.arrayBuffer();
  } catch {
    return null;
  }
}

function telecharger(buffer: ArrayBuffer, nom: string): void {
  const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const url = URL.createObjectURL(new Blob([buffer], { type }));
  const ancre = document.createElement('a');
  ancre.href = url;
  ancre.download = nom;
  ancre.click();
  URL.revokeObjectURL(url);
}
