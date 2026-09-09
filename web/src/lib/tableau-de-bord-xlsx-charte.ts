import type { Workbook, Worksheet } from 'exceljs';

import type { Cellule } from '@/lib/tableau-de-bord-xlsx-donnees';
import {
  BLANC,
  BORDEAUX,
  CORPS,
  ecrireEnTete,
  GRIS,
  HAUTEUR_BANDEAU,
  HAUTEUR_LIGNE,
  intituler,
  LARGEUR_BANDEAU,
  OR_CLAIR,
  POLICE,
  TRAIT,
  ZEBRE,
  type Onglet,
} from '@/lib/tableau-de-bord-xlsx-style';

export interface Repere {
  libelle: string;
  valeur: string;
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

function ecrireReperes(sheet: Worksheet, reperes: readonly Repere[], depart: number): number {
  let ligne = depart;
  for (const repere of reperes) {
    const row = sheet.getRow(ligne);
    row.height = HAUTEUR_LIGNE;
    const libelle = row.getCell(3);
    libelle.value = repere.libelle;
    libelle.font = { name: POLICE, bold: true, size: CORPS, color: { argb: GRIS } };
    const valeur = row.getCell(4);
    valeur.value = repere.valeur;
    valeur.font = { name: POLICE, size: CORPS };
    ligne += 1;
  }
  return ligne;
}

function resumeDe(onglet: Onglet): string {
  const titres = onglet.blocs.map((bloc) => bloc.titre).filter((titre) => titre !== '');
  if (titres.length > 0) return titres.join(' · ');
  return onglet.blocs[0]?.question ?? '';
}

function ecrireSommaire(sheet: Worksheet, onglets: readonly Onglet[], depart: number): void {
  ecrireEnTete(sheet.getRow(depart), ['Onglet', 'Ce qu’il rassemble', 'Blocs'], 3);

  onglets.forEach((onglet, index) => {
    const row = sheet.getRow(depart + 1 + index);
    row.height = HAUTEUR_LIGNE;
    const cellules: Cellule[] = [onglet.nom, resumeDe(onglet), onglet.blocs.length];
    cellules.forEach((valeur, colonne) => {
      const cellule = row.getCell(colonne + 3);
      cellule.value = valeur;
      cellule.font = { name: POLICE, size: CORPS };
      cellule.alignment = { vertical: 'middle', wrapText: true };
      cellule.border = { bottom: { style: 'hair', color: { argb: TRAIT } } };
      if (index % 2 === 1) {
        cellule.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRE } };
      }
    });
  });
}

/** La page de garde : ce que le classeur contient, et de quelle période. */
export function ecrireCharte(
  workbook: Workbook,
  entete: { titre: string; sousTitre: string; reperes: readonly Repere[] },
  onglets: readonly Onglet[],
): void {
  const sheet = workbook.addWorksheet('Charte', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.columns = [{ width: 3 }, { width: 6 }, { width: 38 }, { width: 62 }, { width: 13 }];

  peindreBandeau(sheet);

  const titre = sheet.getCell('C3');
  titre.value = entete.titre;
  titre.font = { name: POLICE, bold: true, size: 26, color: { argb: BLANC } };
  const sousTitre = sheet.getCell('C6');
  sousTitre.value = entete.sousTitre;
  sousTitre.font = { name: POLICE, bold: true, size: CORPS, color: { argb: OR_CLAIR } };

  let ligne = ecrireReperes(sheet, entete.reperes, HAUTEUR_BANDEAU + 2);
  ligne += 2;
  intituler(sheet.getCell(ligne, 3), 'Ce que contient ce classeur', 18);
  ecrireSommaire(sheet, onglets, ligne + 2);
}
