import type * as ExcelJS from 'exceljs';
import type { Row, Workbook, Worksheet } from 'exceljs';

import type { Donnees } from '@/components/tableau-de-bord/sources';
import { ecrireCharte, type Repere } from '@/lib/tableau-de-bord-xlsx-charte';
import { enTableau, estNombreSeul, type Cellule } from '@/lib/tableau-de-bord-xlsx-donnees';
import {
  BORDEAUX,
  CORPS,
  ecrireEnTete,
  GRIS,
  HAUTEUR_LIGNE,
  intituler,
  POLICE,
  TRAIT,
  ZEBRE,
  type Bloc,
  type Onglet,
} from '@/lib/tableau-de-bord-xlsx-style';

/** Le groupe des cartes qui n'en déclarent pas, et l'onglet des nombres seuls. */
const SANS_GROUPE = 'Détail';
const CHIFFRES_CLES = 'Chiffres clés';

export interface BlocTableauDeBord {
  titre: string;
  question?: string | undefined;
  /** Le thème qui décide de l'onglet : ce qui se lit ensemble reste ensemble. */
  groupe?: string | undefined;
  donnees: Donnees;
}

export interface ClasseurTableauDeBord {
  /** Sans extension : elle est ajoutée au téléchargement. */
  fichier: string;
  titre: string;
  sousTitre: string;
  reperes: readonly Repere[];
  blocs: readonly BlocTableauDeBord[];
}

/** Le paquet est publié en UMD : selon l'empaqueteur, la classe est sur le module ou son `default`. */
async function chargerExcel(): Promise<typeof ExcelJS> {
  const charge = await import('exceljs');
  return (charge as { default?: typeof ExcelJS }).default ?? charge;
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

function ongletDesCles(cles: readonly (readonly Cellule[])[]): Onglet {
  return {
    nom: CHIFFRES_CLES,
    blocs: [
      {
        titre: '',
        question: 'Les indicateurs de l’écran, en une valeur chacun.',
        tableau: { colonnes: ['Indicateur', 'Valeur'], lignes: cles },
      },
    ],
  };
}

/**
 * Un nombre seul ne mérite pas un onglet : tous se rangent dans « Chiffres
 * clés ». Le reste suit le thème de la carte.
 */
function repartir(blocs: readonly BlocTableauDeBord[]): Onglet[] {
  const cles: Cellule[][] = [];
  const parGroupe = new Map<string, Bloc[]>();

  for (const source of blocs) {
    const tableau = enTableau(source.donnees);
    if (estNombreSeul(source.donnees)) {
      cles.push([source.titre, tableau.lignes[0]?.[1] ?? null]);
      continue;
    }
    const groupe = source.groupe ?? SANS_GROUPE;
    const bloc = { titre: source.titre, question: source.question ?? '', tableau };
    parGroupe.set(groupe, [...(parGroupe.get(groupe) ?? []), bloc]);
  }

  const onglets = [...parGroupe].map(([nom, liste]) => ({ nom, blocs: liste }));
  const tous = cles.length === 0 ? onglets : [ongletDesCles(cles), ...onglets];

  const pris = new Set(['Charte']);
  return tous.map((onglet) => ({ ...onglet, nom: nomUnique(onglet.nom, pris) }));
}

/** Un code de format Excel s'écrit en notation anglaise ; le tableur le rend en local. */
function formatDe(colonne: number, colonnePart: number | undefined, nombre: boolean): string {
  if (colonne === colonnePart) return '0.0%';
  return nombre ? '#,##0' : 'General';
}

function habillerLigne(
  row: Row,
  valeurs: readonly Cellule[],
  index: number,
  colonnePart: number | undefined,
): void {
  row.height = HAUTEUR_LIGNE;
  valeurs.forEach((valeur, colonne) => {
    const cellule = row.getCell(colonne + 1);
    cellule.value = valeur;
    cellule.font = { name: POLICE, size: CORPS };
    cellule.alignment = { vertical: 'middle' };
    cellule.border = { bottom: { style: 'hair', color: { argb: TRAIT } } };
    cellule.numFmt = formatDe(colonne + 1, colonnePart, typeof valeur === 'number');
    if (index % 2 === 1) {
      cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRE } };
    }
  });
}

function ecrireTotal(row: Row, total: readonly Cellule[], colonnePart: number | undefined): void {
  row.height = HAUTEUR_LIGNE;
  total.forEach((valeur, colonne) => {
    const cellule = row.getCell(colonne + 1);
    cellule.value = valeur;
    cellule.font = { name: POLICE, bold: true, size: CORPS };
    cellule.alignment = { vertical: 'middle' };
    cellule.border = { top: { style: 'thin', color: { argb: BORDEAUX } } };
    cellule.numFmt = formatDe(colonne + 1, colonnePart, typeof valeur === 'number');
  });
}

/** Rend le rang de la dernière ligne écrite, pour que le bloc suivant s'y accroche. */
function ecrireBloc(sheet: Worksheet, bloc: Bloc, depart: number): number {
  if (bloc.titre !== '') intituler(sheet.getCell(depart, 1), bloc.titre, 16);
  const question = sheet.getCell(depart + 1, 1);
  question.value = bloc.question;
  question.font = { name: POLICE, size: 12, color: { argb: GRIS } };

  const { colonnes, lignes, total, colonnePart } = bloc.tableau;
  ecrireEnTete(sheet.getRow(depart + 3), colonnes, 1);
  lignes.forEach((valeurs, index) => {
    habillerLigne(sheet.getRow(depart + 4 + index), valeurs, index, colonnePart);
  });

  const fin = depart + 3 + lignes.length;
  if (total === undefined) return fin;
  ecrireTotal(sheet.getRow(fin + 1), total, colonnePart);
  return fin + 1;
}

/** Une fraction s'écrit `0.6069` en mémoire : sa largeur se mesure sur l'en-tête. */
function largeurColonne(
  titre: string,
  lignes: readonly (readonly Cellule[])[],
  index: number,
): number {
  const tailles = lignes.map((ligne) => String(ligne[index] ?? '').length + 3);
  return Math.min(58, Math.max(14, titre.length + 5, ...tailles));
}

/** Les blocs d'un onglet partagent ses colonnes : la plus large commande. */
function ajusterLargeurs(sheet: Worksheet, blocs: readonly Bloc[]): void {
  const largeurs = new Map<number, number>();
  for (const bloc of blocs) {
    bloc.tableau.colonnes.forEach((titre, index) => {
      const pourcent = index + 1 === bloc.tableau.colonnePart;
      const largeur = pourcent ? 14 : largeurColonne(titre, bloc.tableau.lignes, index);
      largeurs.set(index + 1, Math.max(largeurs.get(index + 1) ?? 0, largeur));
    });
  }
  for (const [colonne, largeur] of largeurs) sheet.getColumn(colonne).width = largeur;
}

/**
 * Excel n'admet qu'un filtre par onglet : il ne se pose que si l'onglet tient
 * en un bloc. Sinon il trierait un tableau en emportant les suivants.
 */
function poserFiltre(sheet: Worksheet, blocs: readonly Bloc[]): void {
  const seul = blocs.length === 1 ? blocs[0] : undefined;
  if (seul === undefined) return;
  sheet.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: 6, column: seul.tableau.colonnes.length },
  };
  sheet.views = [{ state: 'frozen', ySplit: 6, showGridLines: false }];
}

function ecrireOnglet(workbook: Workbook, onglet: Onglet): void {
  const sheet = workbook.addWorksheet(onglet.nom, { views: [{ showGridLines: false }] });
  intituler(sheet.getCell('A1'), onglet.nom, 18);

  let ligne = 3;
  for (const bloc of onglet.blocs) ligne = ecrireBloc(sheet, bloc, ligne) + 3;

  ajusterLargeurs(sheet, onglet.blocs);
  poserFiltre(sheet, onglet.blocs);
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

export async function telechargerTableauDeBord(classeur: ClasseurTableauDeBord): Promise<void> {
  const { Workbook } = await chargerExcel();
  const workbook = new Workbook();
  workbook.creator = 'CPI GO';
  workbook.created = new Date();

  const onglets = repartir(classeur.blocs);
  ecrireCharte(workbook, classeur, onglets);
  for (const onglet of onglets) ecrireOnglet(workbook, onglet);

  telecharger(await workbook.xlsx.writeBuffer(), `${classeur.fichier}.xlsx`);
}
