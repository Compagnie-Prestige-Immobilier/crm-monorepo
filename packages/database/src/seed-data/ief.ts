/**
 * Les IEF — Inspections de l'Éducation et de la Formation.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE RÉFÉRENTIEL EXISTE, À CÔTÉ DES DÉPARTEMENTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le département est un découpage administratif. L'IEF est le découpage
 * SCOLAIRE, et c'est celui sur lequel les feuilles de route CHUES sont bâties :
 * un téléconseiller reçoit « IEF Almadies », jamais « Dakar ».
 *
 * Les deux ne coïncident pas. 59 IEF pour 46 départements — dix départements en
 * portent plusieurs, et Dakar en porte quatre à lui seul :
 *
 *     Dakar     → Almadies, Dakar Plateau, Grand Dakar, Parcelles Assainies
 *     Rufisque  → Rufisque Commune, Diamniadio, Sangalkam
 *     Pikine    → Pikine, Thiaroye
 *
 * Sans ce référentiel, ces quatre IEF de Dakar se saisissent toutes comme
 * « Dakar » et se confondent dans le même chiffre. L'information est perdue à
 * la saisie : aucun traitement ultérieur ne peut la reconstituer.
 *
 * Source : `Matrice_Finale_Nationale.xlsx`, onglet « Matrice par IEF ».
 * Rattachement au département par le code, jamais par le libellé : la matrice
 * écrit « Birkilane » là où la feuille de route régionale et l'orthographe
 * officielle écrivent « Birkelane ».
 */
export interface IefSeed {
  readonly code: string;
  readonly name: string;
  readonly departementCode: string;
}

export const IEFS: readonly IefSeed[] = [
  { code: 'DK-DAK-ALMA', name: 'Almadies', departementCode: 'DK-DAK' },
  { code: 'DK-DAK-DAKA', name: 'Dakar Plateau', departementCode: 'DK-DAK' },
  { code: 'DK-DAK-GRAN', name: 'Grand Dakar', departementCode: 'DK-DAK' },
  { code: 'DK-DAK-PARC', name: 'Parcelles Assainies', departementCode: 'DK-DAK' },
  { code: 'DK-GUE-GUED', name: 'Guédiawaye', departementCode: 'DK-GUE' },
  { code: 'DK-KMA-KEUR', name: 'Keur Massar', departementCode: 'DK-KMA' },
  { code: 'DK-PIK-PIKI', name: 'Pikine', departementCode: 'DK-PIK' },
  { code: 'DK-PIK-THIA', name: 'Thiaroye', departementCode: 'DK-PIK' },
  { code: 'DK-RUF-DIAM', name: 'Diamniadio', departementCode: 'DK-RUF' },
  { code: 'DK-RUF-RUFI', name: 'Rufisque Commune', departementCode: 'DK-RUF' },
  { code: 'DK-RUF-SANG', name: 'Sangalkam', departementCode: 'DK-RUF' },
  { code: 'TH-MBO-MBOU', name: 'Mbour 1', departementCode: 'TH-MBO' },
  { code: 'TH-MBO-MBOU2', name: 'Mbour 2', departementCode: 'TH-MBO' },
  { code: 'TH-THI-THIE', name: 'Thiès Commune', departementCode: 'TH-THI' },
  { code: 'TH-THI-THIE2', name: 'Thiès Département', departementCode: 'TH-THI' },
  { code: 'TH-TIV-TIVA', name: 'Tivaouane', departementCode: 'TH-TIV' },
  { code: 'DB-BAM-BAMB', name: 'Bambey', departementCode: 'DB-BAM' },
  { code: 'DB-DIO-DIOU', name: 'Diourbel', departementCode: 'DB-DIO' },
  { code: 'DB-MBA-MBAC', name: 'Mbacké', departementCode: 'DB-MBA' },
  { code: 'FK-FAT-DIOF', name: 'Diofior', departementCode: 'FK-FAT' },
  { code: 'FK-FAT-FATI', name: 'Fatick', departementCode: 'FK-FAT' },
  { code: 'FK-FOU-FOUN', name: 'Foundiougne', departementCode: 'FK-FOU' },
  { code: 'FK-GOS-GOSS', name: 'Gossas', departementCode: 'FK-GOS' },
  { code: 'KA-BIR-BIRK', name: 'Birkelane', departementCode: 'KA-BIR' },
  { code: 'KA-KAF-KAFF', name: 'Kaffrine', departementCode: 'KA-KAF' },
  { code: 'KA-KOU-KOUN', name: 'Koungheul', departementCode: 'KA-KOU' },
  { code: 'KA-MAL-MALE', name: 'Malem Hoddar', departementCode: 'KA-MAL' },
  { code: 'KL-GUI-GUIN', name: 'Guinguinéo', departementCode: 'KL-GUI' },
  { code: 'KL-KAO-KAOL', name: 'Kaolack Commune', departementCode: 'KL-KAO' },
  { code: 'KL-KAO-KAOL2', name: 'Kaolack-Département', departementCode: 'KL-KAO' },
  { code: 'KL-NIO-NIOR', name: 'Nioro', departementCode: 'KL-NIO' },
  { code: 'KE-KED-KEDO', name: 'Kédougou', departementCode: 'KE-KED' },
  { code: 'KE-SAL-SALE', name: 'Salémata', departementCode: 'KE-SAL' },
  { code: 'KE-SAR-SARA', name: 'Saraya', departementCode: 'KE-SAR' },
  { code: 'KD-KOL-KOLD', name: 'Kolda', departementCode: 'KD-KOL' },
  { code: 'KD-MYF-MEDI', name: 'Médina Yoro Foulah', departementCode: 'KD-MYF' },
  { code: 'KD-VEL-VELI', name: 'Vélingara', departementCode: 'KD-VEL' },
  { code: 'LG-KEB-KEBE', name: 'Kébémer', departementCode: 'LG-KEB' },
  { code: 'LG-LIN-LING', name: 'Linguère', departementCode: 'LG-LIN' },
  { code: 'LG-LOU-LOUG', name: 'Louga', departementCode: 'LG-LOU' },
  { code: 'MT-KAN-KANE', name: 'Kanel', departementCode: 'MT-KAN' },
  { code: 'MT-MAT-MATA', name: 'Matam', departementCode: 'MT-MAT' },
  { code: 'MT-RAN-RANE', name: 'Ranérou', departementCode: 'MT-RAN' },
  { code: 'SL-DAG-DAGA', name: 'Dagana', departementCode: 'SL-DAG' },
  { code: 'SL-POD-PETE', name: 'Pété', departementCode: 'SL-POD' },
  { code: 'SL-POD-PODO', name: 'Podor', departementCode: 'SL-POD' },
  { code: 'SL-STL-SAIN', name: 'Saint-Louis Commune', departementCode: 'SL-STL' },
  { code: 'SL-STL-SAIN2', name: 'Saint-Louis Département', departementCode: 'SL-STL' },
  { code: 'SE-BOU-BOUN', name: 'Bounkiling', departementCode: 'SE-BOU' },
  { code: 'SE-GOU-GOUD', name: 'Goudomp', departementCode: 'SE-GOU' },
  { code: 'SE-SED-SEDH', name: 'Sédhiou', departementCode: 'SE-SED' },
  { code: 'TC-BAK-BAKE', name: 'Bakel', departementCode: 'TC-BAK' },
  { code: 'TC-GOU-GOUD', name: 'Goudiry', departementCode: 'TC-GOU' },
  { code: 'TC-KOU-KOUM', name: 'Koumpentoum', departementCode: 'TC-KOU' },
  { code: 'TC-TAM-TAMB', name: 'Tambacounda', departementCode: 'TC-TAM' },
  { code: 'ZG-BIG-BIGN', name: 'Bignona 1', departementCode: 'ZG-BIG' },
  { code: 'ZG-BIG-BIGN2', name: 'Bignona 2', departementCode: 'ZG-BIG' },
  { code: 'ZG-OUS-OUSS', name: 'Oussouye', departementCode: 'ZG-OUS' },
  { code: 'ZG-ZIG-ZIGU', name: 'Ziguinchor', departementCode: 'ZG-ZIG' },
] as const;
