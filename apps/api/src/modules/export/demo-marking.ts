import type { ServerResponse } from 'node:http';

import type ExcelJS from 'exceljs';

/**
 * Marquage des exports produits en MODE DÉMONSTRATION.
 *
 * Le mode démonstration est une bascule d'AFFICHAGE : allumé, les écrans et les
 * exports mêlent des lignes fictives à des lignes réelles. L'interface porte une
 * bannière, mais le fichier téléchargé, lui, lui survit : il part par courriel,
 * il est ouvert trois semaines plus tard, il est extrait feuille par feuille.
 * Il doit donc porter SA PROPRE mise en garde, et à quatre endroits, parce
 * qu'aucun d'eux ne survit à tous les usages :
 *
 *  1. le NOM DU FICHIER, seule marque lisible sans ouvrir le classeur ;
 *  2. les MÉTADONNÉES du classeur, qui survivent à la suppression d'une
 *     feuille ;
 *  3. une LIGNE D'AVERTISSEMENT en tête de CHAQUE feuille, parce qu'une feuille
 *     extraite du classeur perd tout le reste ;
 *  4. un EN-TÊTE HTTP, pour que le client sache ce qu'il vient de recevoir.
 *
 * Rien de tout cela n'est écrit quand le mode est éteint : un classeur de
 * plateforme en service ne doit porter aucune trace de cette mécanique.
 */

/**
 * En-tête porté par TOUTE réponse d'export, dans les deux états.
 *
 * Un en-tête absent serait ambigu : mode éteint ? proxy qui l'a filtré ?
 * version d'API antérieure ? Un en-tête explicite se lit sans hypothèse.
 */
export const DEMO_MODE_HEADER = 'X-Demo-Mode';

/** Suffixe ajouté au nom de fichier. Volontairement long et en capitales. */
export const DEMO_FILENAME_SUFFIX = '-DEMONSTRATION';

const WARNING_TEXT =
  'ATTENTION : ce fichier a été produit en MODE DÉMONSTRATION. Il mêle des lignes fictives à des lignes réelles et ne doit servir à aucune décision ni à aucun reporting.';

const WARNING_RED = 'FFB00020';
const WARNING_BACKGROUND = 'FFFDECEE';

/** Auteur ordinaire du classeur, hors mode démonstration. */
const CREATOR = 'CPI GO';
const CREATOR_DEMO = 'CPI GO (mode démonstration)';

export const demoFilenameSuffix = (demoEnabled: boolean): string =>
  demoEnabled ? DEMO_FILENAME_SUFFIX : '';

/** Pose l'en-tête, dans LES DEUX cas. Voir `DEMO_MODE_HEADER`. */
export function setDemoHeader(response: ServerResponse, demoEnabled: boolean): void {
  response.setHeader(DEMO_MODE_HEADER, demoEnabled ? 'true' : 'false');
}

/**
 * Renseigne les métadonnées du classeur.
 *
 * Elles survivent à la suppression d'une feuille et au renommage du fichier :
 * c'est la marque la plus difficile à effacer par inadvertance.
 */
export function markWorkbook(
  workbook: ExcelJS.Workbook | ExcelJS.stream.xlsx.WorkbookWriter,
  demoEnabled: boolean,
): void {
  workbook.creator = demoEnabled ? CREATOR_DEMO : CREATOR;
  workbook.lastModifiedBy = workbook.creator;
  workbook.created = new Date();
  workbook.modified = workbook.created;
  if (demoEnabled) workbook.description = WARNING_TEXT;
}

/**
 * Écrit la ligne d'avertissement, JUSTE APRÈS l'en-tête de colonnes.
 *
 * En ligne 2 et non en ligne 1 : l'en-tête doit rester la première ligne, sans
 * quoi le tri d'Excel et le volet figé prennent l'avertissement pour un nom de
 * colonne, et le classeur devient inutilisable pour ce qu'on en attend.
 *
 * À appeler sur CHAQUE feuille. Une feuille extraite du classeur perd les
 * métadonnées, le nom du fichier et l'en-tête HTTP d'un seul coup : il ne lui
 * reste que cette ligne.
 */
export function writeDemoWarningRow(
  sheet: ExcelJS.Worksheet,
  demoEnabled: boolean,
  columnCount: number,
): void {
  if (!demoEnabled) return;

  const row = sheet.addRow([WARNING_TEXT]);
  row.font = { bold: true, color: { argb: WARNING_RED }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARNING_BACKGROUND } };
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 24;

  // La fusion est TENTÉE, pas exigée : `WorkbookWriter` la refuse sur certaines
  // formes de feuille, et un avertissement affiché sur une seule colonne reste
  // un avertissement. Le perdre parce que la fusion a échoué serait un mauvais
  // échange.
  if (columnCount > 1) {
    try {
      sheet.mergeCells(row.number, 1, row.number, columnCount);
    } catch {
      // Sans fusion, le texte déborde sur les cellules voisines vides : lisible.
    }
  }

  row.commit();
}
