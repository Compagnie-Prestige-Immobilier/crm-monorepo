/**
 * Découpage administratif du Sénégal : 14 régions, 46 départements.
 *
 * Le département est l'axe d'analyse principal du panel admin (« regrouper par
 * département »), et la région lui donne un second niveau d'agrégation sans
 * coût supplémentaire côté saisie — le commercial ne choisit que le département.
 */

export interface RegionSeed {
  code: string;
  name: string;
  departements: readonly { code: string; name: string }[];
}

export const REGIONS_SENEGAL: readonly RegionSeed[] = [
  {
    code: 'DK',
    name: 'Dakar',
    departements: [
      { code: 'DK-DAK', name: 'Dakar' },
      { code: 'DK-GUE', name: 'Guédiawaye' },
      { code: 'DK-KMA', name: 'Keur Massar' },
      { code: 'DK-PIK', name: 'Pikine' },
      { code: 'DK-RUF', name: 'Rufisque' },
    ],
  },
  {
    code: 'DB',
    name: 'Diourbel',
    departements: [
      { code: 'DB-BAM', name: 'Bambey' },
      { code: 'DB-DIO', name: 'Diourbel' },
      { code: 'DB-MBA', name: 'Mbacké' },
    ],
  },
  {
    code: 'FK',
    name: 'Fatick',
    departements: [
      { code: 'FK-FAT', name: 'Fatick' },
      { code: 'FK-FOU', name: 'Foundiougne' },
      { code: 'FK-GOS', name: 'Gossas' },
    ],
  },
  {
    code: 'KA',
    name: 'Kaffrine',
    departements: [
      { code: 'KA-BIR', name: 'Birkelane' },
      { code: 'KA-KAF', name: 'Kaffrine' },
      { code: 'KA-KOU', name: 'Koungheul' },
      { code: 'KA-MAL', name: 'Malem Hodar' },
    ],
  },
  {
    code: 'KL',
    name: 'Kaolack',
    departements: [
      { code: 'KL-GUI', name: 'Guinguinéo' },
      { code: 'KL-KAO', name: 'Kaolack' },
      { code: 'KL-NIO', name: 'Nioro du Rip' },
    ],
  },
  {
    code: 'KE',
    name: 'Kédougou',
    departements: [
      { code: 'KE-KED', name: 'Kédougou' },
      { code: 'KE-SAL', name: 'Salémata' },
      { code: 'KE-SAR', name: 'Saraya' },
    ],
  },
  {
    code: 'KD',
    name: 'Kolda',
    departements: [
      { code: 'KD-KOL', name: 'Kolda' },
      { code: 'KD-MYF', name: 'Médina Yoro Foulah' },
      { code: 'KD-VEL', name: 'Vélingara' },
    ],
  },
  {
    code: 'LG',
    name: 'Louga',
    departements: [
      { code: 'LG-KEB', name: 'Kébémer' },
      { code: 'LG-LIN', name: 'Linguère' },
      { code: 'LG-LOU', name: 'Louga' },
    ],
  },
  {
    code: 'MT',
    name: 'Matam',
    departements: [
      { code: 'MT-KAN', name: 'Kanel' },
      { code: 'MT-MAT', name: 'Matam' },
      { code: 'MT-RAN', name: 'Ranérou Ferlo' },
    ],
  },
  {
    code: 'SL',
    name: 'Saint-Louis',
    departements: [
      { code: 'SL-DAG', name: 'Dagana' },
      { code: 'SL-POD', name: 'Podor' },
      { code: 'SL-STL', name: 'Saint-Louis' },
    ],
  },
  {
    code: 'SE',
    name: 'Sédhiou',
    departements: [
      { code: 'SE-BOU', name: 'Bounkiling' },
      { code: 'SE-GOU', name: 'Goudomp' },
      { code: 'SE-SED', name: 'Sédhiou' },
    ],
  },
  {
    code: 'TC',
    name: 'Tambacounda',
    departements: [
      { code: 'TC-BAK', name: 'Bakel' },
      { code: 'TC-GOU', name: 'Goudiry' },
      { code: 'TC-KOU', name: 'Koumpentoum' },
      { code: 'TC-TAM', name: 'Tambacounda' },
    ],
  },
  {
    code: 'TH',
    name: 'Thiès',
    departements: [
      { code: 'TH-MBO', name: 'Mbour' },
      { code: 'TH-THI', name: 'Thiès' },
      { code: 'TH-TIV', name: 'Tivaouane' },
    ],
  },
  {
    code: 'ZG',
    name: 'Ziguinchor',
    departements: [
      { code: 'ZG-BIG', name: 'Bignona' },
      { code: 'ZG-OUS', name: 'Oussouye' },
      { code: 'ZG-ZIG', name: 'Ziguinchor' },
    ],
  },
] as const;

export const DEPARTEMENT_COUNT = REGIONS_SENEGAL.reduce(
  (total, region) => total + region.departements.length,
  0,
);
