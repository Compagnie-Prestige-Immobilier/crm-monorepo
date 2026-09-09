import type { Cell, Row } from 'exceljs';

import type { Tableau } from '@/lib/tableau-de-bord-xlsx-donnees';

export const BORDEAUX = 'FF630210';
export const OR_CLAIR = 'FFFFC65A';
export const ZEBRE = 'FFF6F2F3';
export const TRAIT = 'FFC9C2C4';
export const GRIS = 'FF6B5F62';
export const BLANC = 'FFFFFFFF';

export const POLICE = 'Arial';
export const CORPS = 14;
export const HAUTEUR_LIGNE = 22;
export const LARGEUR_BANDEAU = 6;
export const HAUTEUR_BANDEAU = 7;

export interface Bloc {
  titre: string;
  question: string;
  tableau: Tableau;
}

export interface Onglet {
  nom: string;
  blocs: Bloc[];
}

export function intituler(cellule: Cell, texte: string, taille: number): void {
  cellule.value = texte;
  cellule.font = { name: POLICE, bold: true, size: taille, color: { argb: BORDEAUX } };
  cellule.alignment = { vertical: 'middle' };
}

export function ecrireEnTete(row: Row, colonnes: readonly string[], premiere: number): void {
  row.height = HAUTEUR_LIGNE + 4;
  colonnes.forEach((titre, index) => {
    const cellule = row.getCell(index + premiere);
    cellule.value = titre;
    cellule.font = { name: POLICE, bold: true, size: CORPS, color: { argb: BLANC } };
    cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BORDEAUX } };
    cellule.alignment = { vertical: 'middle', wrapText: true };
  });
}
