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

const POLICE = 'Arial';
const CORPS = 14;
const HAUTEUR_LIGNE = 22;

const LARGEUR_BANDEAU = 6;
const HAUTEUR_BANDEAU = 7;

/** Le groupe des cartes qui n'en déclarent pas, et l'onglet qui rassemble les nombres seuls. */
const SANS_GROUPE = 'Détail';
const CHIFFRES_CLES = 'Chiffres clés';

type ModuleExcel = typeof ExcelJS;

type Cellule = string | number | null;

interface Tableau {
  colonnes: readonly string[];
  lignes: readonly (readonly Cellule[])[];
  /** Rang de la colonne à mettre en pourcentage, 1 pour la première. */
  colonnePart?: number;
  total?: readonly Cellule[];
}

export interface BlocTableauDeBord {
  titre: string;
  question?: string | undefined;
  /** Le thème qui décide de l'onglet : les cartes d'un même thème se lisent ensemble. */
  groupe?: string | undefined;
  donnees: DonneesSource;
}

export interface ClasseurTableauDeBord {
  /** Sans extension : elle est ajoutée au téléchargement. */
  fichier: string;
  titre: string;
  sousTitre: string;
  reperes: readonly { libelle: string; valeur: string }[];
  blocs: readonly BlocTableauDeBord[];
}

interface Bloc {
  titre: string;
  question: string;
  tableau: Tableau;
}

interface Onglet {
  nom: string;
  blocs: Bloc[];
}

export async function telechargerTableauDeBord(classeur: ClasseurTableauDeBord): Promise<void> {
  const { Workbook: Classeur } = await chargerExcel();
  const workbook = new Classeur();
  workbook.creator = 'CPI GO';
  workbook.created = new Date();

  const onglets = repartir(classeur.blocs);
  ecrireCharte(workbook, classeur, onglets, await logoCpi());
  for (const onglet of onglets) ecrireOnglet(workbook, onglet);

  const buffer = await workbook.xlsx.writeBuffer();
  telecharger(buffer, `${classeur.fichier}.xlsx`);
}

/** Le paquet est publié en UMD : selon l'empaqueteur, la classe est sur le module ou sur son `default`. */
async function chargerExcel(): Promise<ModuleExcel> {
  const charge = await import('exceljs');
  return (charge as { default?: ModuleExcel }).default ?? charge;
}

/**
 * Un nombre seul ne mérite pas un onglet : tous se rangent dans « Chiffres
 * clés ». Le reste suit le thème de la carte, pour que ce qui se lit ensemble
 * reste ensemble.
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
  if (cles.length === 0) return nommerOnglets(onglets);
  return nommerOnglets([{ nom: CHIFFRES_CLES, blocs: [blocDesCles(cles)] }, ...onglets]);
}

function estNombreSeul(donnees: DonneesSource): boolean {
  return donnees.forme === 'scalaire' && (donnees.donnee.serie ?? []).length === 0;
}

/** Sans titre propre : l'onglet porte déjà le sien, le répéter ne dit rien de plus. */
function blocDesCles(lignes: readonly (readonly Cellule[])[]): Bloc {
  return {
    titre: '',
    question: 'Les indicateurs de l’écran, en une valeur chacun.',
    tableau: { colonnes: ['Indicateur', 'Valeur'], lignes },
  };
}

function nommerOnglets(onglets: readonly Onglet[]): Onglet[] {
  const pris = new Set(['Charte']);
  return onglets.map((onglet) => ({ ...onglet, nom: nomUnique(onglet.nom, pris) }));
}

function ecrireCharte(
  workbook: Workbook,
  classeur: ClasseurTableauDeBord,
  onglets: readonly Onglet[],
  logo: ArrayBuffer | null,
): void {
  const sheet = workbook.addWorksheet('Charte', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [
    { width: 3 },
    { width: 6 },
    { width: 38 },
    { width: 62 },
    { width: 13 },
    { width: 3 },
  ];

  peindreBandeau(sheet);
  poserLogo(workbook, sheet, logo);

  titrerBandeau(sheet.getCell('C3'), classeur.titre, 26, BLANC);
  titrerBandeau(sheet.getCell('C6'), classeur.sousTitre, CORPS, OR_CLAIR);

  let ligne = HAUTEUR_BANDEAU + 2;
  for (const repere of classeur.reperes) {
    ecrireRepere(sheet.getRow(ligne), repere);
    ligne += 1;
  }

  ligne += 2;
  intituler(sheet.getCell(ligne, 3), 'Ce que contient ce classeur', 18);
  ligne += 2;

  ecrireEnTete(sheet.getRow(ligne), ['Onglet', 'Ce qu’il rassemble', 'Blocs'], 3);
  ligne += 1;

  onglets.forEach((onglet, index) => {
    ecrireLigneSommaire(sheet.getRow(ligne + index), onglet, index);
  });
}

function peindreBandeau(sheet: Worksheet): void {
  for (let ligne = 1; ligne <= HAUTEUR_BANDEAU; ligne += 1) {
    const row = sheet.getRow(ligne);
    row.height = HAUTEUR_LIGNE;
    for (let colonne = 1; colonne <= LARGEUR_BANDEAU; colonne += 1) {
      row.getCell(colonne).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BORDEAUX },
      };
    }
  }
}

function poserLogo(workbook: Workbook, sheet: Worksheet, logo: ArrayBuffer | null): void {
  if (logo === null) return;
  const image = workbook.addImage({ buffer: logo, extension: 'png' });
  sheet.addImage(image, { tl: { col: 4.3, row: 1.8 }, ext: { width: 172, height: 70 } });
}

function titrerBandeau(cellule: Cell, texte: string, taille: number, couleur: string): void {
  cellule.value = texte;
  cellule.font = { name: POLICE, bold: true, size: taille, color: { argb: couleur } };
  cellule.alignment = { vertical: 'middle' };
}

function ecrireRepere(row: Row, repere: { libelle: string; valeur: string }): void {
  const libelle = row.getCell(3);
  libelle.value = repere.libelle;
  libelle.font = { name: POLICE, bold: true, size: CORPS, color: { argb: GRIS } };
  libelle.alignment = { vertical: 'middle' };

  const valeur = row.getCell(4);
  valeur.value = repere.valeur;
  valeur.font = { name: POLICE, size: CORPS };
  valeur.alignment = { vertical: 'middle' };
  row.height = HAUTEUR_LIGNE;
}

function intituler(cellule: Cell, texte: string, taille: number): void {
  cellule.value = texte;
  cellule.font = { name: POLICE, bold: true, size: taille, color: { argb: BORDEAUX } };
  cellule.alignment = { vertical: 'middle' };
}

function ecrireLigneSommaire(row: Row, onglet: Onglet, index: number): void {
  const titres = onglet.blocs.map((bloc) => bloc.titre).filter((titre) => titre !== '');
  const cellules: Cellule[] = [
    onglet.nom,
    titres.length === 0 ? (onglet.blocs[0]?.question ?? '') : titres.join(' · '),
    onglet.blocs.length,
  ];
  row.height = HAUTEUR_LIGNE;
  cellules.forEach((valeur, colonne) => {
    habillerCelluleSommaire(row.getCell(colonne + 3), valeur, index);
  });
}

function habillerCelluleSommaire(cellule: Cell, valeur: Cellule, index: number): void {
  cellule.value = valeur;
  cellule.font = { name: POLICE, size: CORPS };
  cellule.alignment = { vertical: 'middle', wrapText: true };
  cellule.border = { bottom: { style: 'hair', color: { argb: TRAIT } } };
  if (index % 2 === 1) {
    cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRE } };
  }
}

function ecrireOnglet(workbook: Workbook, onglet: Onglet): void {
  const sheet = workbook.addWorksheet(onglet.nom, { views: [{ showGridLines: false }] });
  intituler(sheet.getCell('A1'), onglet.nom, 18);

  let ligne = 3;
  for (const bloc of onglet.blocs) ligne = ecrireBloc(sheet, bloc, ligne) + 3;

  ajusterLargeurs(sheet, onglet.blocs);
  poserFiltre(sheet, onglet.blocs);
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

function ecrireEnTete(row: Row, colonnes: readonly string[], premiere: number): void {
  row.height = HAUTEUR_LIGNE + 4;
  colonnes.forEach((titre, index) => {
    const cellule = row.getCell(index + premiere);
    cellule.value = titre;
    cellule.font = { name: POLICE, bold: true, size: CORPS, color: { argb: BLANC } };
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

/** Un code de format Excel s'écrit toujours en notation anglaise ; le tableur le rend en local. */
function formatDe(colonne: number, colonnePart: number | undefined, nombre: boolean): string {
  if (colonne === colonnePart) return '0.0%';
  return nombre ? '#,##0' : 'General';
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

/** Les blocs d'un onglet partagent ses colonnes : la plus large commande. */
function ajusterLargeurs(sheet: Worksheet, blocs: readonly Bloc[]): void {
  const largeurs = new Map<number, number>();
  for (const bloc of blocs) mesurerBloc(bloc, largeurs);
  for (const [colonne, largeur] of largeurs) sheet.getColumn(colonne).width = largeur;
}

function mesurerBloc(bloc: Bloc, largeurs: Map<number, number>): void {
  bloc.tableau.colonnes.forEach((titre, index) => {
    const part = index + 1 === bloc.tableau.colonnePart;
    const largeur = part ? 14 : largeurColonne(titre, bloc.tableau.lignes, index);
    largeurs.set(index + 1, Math.max(largeurs.get(index + 1) ?? 0, largeur));
  });
}

/** Une fraction s'écrit `0.6069` en mémoire : sa largeur se mesure sur l'en-tête, pas sur elle. */
function largeurColonne(
  titre: string,
  lignes: readonly (readonly Cellule[])[],
  index: number,
): number {
  const tailles = lignes.map((ligne) => String(ligne[index] ?? '').length + 3);
  return Math.min(58, Math.max(14, titre.length + 5, ...tailles));
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
