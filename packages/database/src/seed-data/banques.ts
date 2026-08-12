/**
 * Établissements bancaires du Sénégal.
 *
 * Les 29 banques agréées sont reprises TELLES QUELLES de la liste officielle
 * BCEAO « Établissements de crédit agréés dans l'UMOA au 31 décembre 2025 »
 * (section Sénégal, pages 10-11) — pas d'une liste reconstituée de mémoire.
 * Deux dénominations ont changé récemment et un seed de mémoire les aurait
 * ratées :
 *   - BICIS  → SUNU BANK SÉNÉGAL
 *   - Banque de Dakar → AFRIKA BANQUE SÉNÉGAL
 *
 * Les institutions de microfinance ne figurent pas sur la liste BCEAO des
 * banques mais sont incontournables ici : une large part des salariés
 * syndiqués sénégalais domicilie son salaire au CMS, à PAMECAS ou à l'ACEP.
 * Elles sont marquées `secteur: 'Microfinance'`.
 *
 * `AUTRE` et `AUCUNE` ferment la liste. Le référentiel est fermé (pas de saisie
 * libre) : sans ces deux entrées, un commercial face à un cas non prévu
 * choisirait une banque au hasard pour pouvoir valider son formulaire, ce qui
 * pollue les statistiques bien plus qu'un compartiment « Autre » explicite.
 */

export interface BanqueSeed {
  name: string;
  shortName: string;
  sortOrder: number;
}

export const BANQUES_SENEGAL: readonly BanqueSeed[] = [
  // Les plus courantes en tête : la liste mobile est triée par sortOrder, et
  // ces quatre couvrent l'essentiel des domiciliations de salaire.
  { name: 'CBAO, Groupe Attijariwafa Bank', shortName: 'CBAO', sortOrder: 1 },
  { name: 'Société Générale Sénégal', shortName: 'SGS', sortOrder: 2 },
  { name: 'Ecobank Sénégal', shortName: 'Ecobank', sortOrder: 3 },
  { name: "Banque de l'Habitat du Sénégal", shortName: 'BHS', sortOrder: 4 },

  { name: 'Bank of Africa Sénégal', shortName: 'BOA Sénégal', sortOrder: 10 },
  { name: 'Banque Atlantique Sénégal', shortName: 'Banque Atlantique', sortOrder: 11 },
  { name: 'Banque Islamique du Sénégal', shortName: 'BIS', sortOrder: 12 },
  { name: 'La Banque Agricole', shortName: 'LBA', sortOrder: 13 },
  { name: 'United Bank for Africa Sénégal', shortName: 'UBA Sénégal', sortOrder: 14 },
  { name: 'Sunu Bank Sénégal', shortName: 'Sunu Bank', sortOrder: 15 },
  { name: 'Coris Bank International Sénégal', shortName: 'CBI Sénégal', sortOrder: 16 },
  { name: 'Banque Nationale pour le Développement Économique', shortName: 'BNDE', sortOrder: 17 },
  { name: 'Orabank Côte d’Ivoire, succursale du Sénégal', shortName: 'Orabank', sortOrder: 18 },
  { name: 'Orange Bank Africa, succursale du Sénégal', shortName: 'Orange Bank', sortOrder: 19 },
  { name: 'Crédit du Sénégal', shortName: 'CDS', sortOrder: 20 },

  {
    name: "Banque des Institutions Mutualistes d'Afrique de l'Ouest",
    shortName: 'BIMAO',
    sortOrder: 30,
  },
  { name: 'Banque Régionale de Marchés', shortName: 'BRM', sortOrder: 31 },
  {
    name: "Banque Sahélo-Saharienne pour l'Investissement et le Commerce - Sénégal",
    shortName: 'BSIC Sénégal',
    sortOrder: 32,
  },
  { name: 'Citibank Sénégal', shortName: 'Citibank', sortOrder: 33 },
  { name: 'Crédit International', shortName: 'CI', sortOrder: 34 },
  { name: 'BGFIBank Sénégal', shortName: 'BGFIBank', sortOrder: 35 },
  { name: 'FBNBank Sénégal', shortName: 'FBNBank', sortOrder: 36 },
  { name: 'Afrika Banque Sénégal', shortName: 'Afrika Banque', sortOrder: 37 },
  { name: 'La Banque Ourtade', shortName: 'LBO', sortOrder: 38 },
  { name: 'Algerian Bank of Sénégal', shortName: 'ABS', sortOrder: 39 },
  { name: 'NSIA Banque Bénin, succursale du Sénégal', shortName: 'NSIA Banque', sortOrder: 40 },
  {
    name: "Banque pour le Commerce et l'Industrie du Mali, succursale du Sénégal",
    shortName: 'BCI Mali',
    sortOrder: 41,
  },
  {
    name: 'Bridge Bank Group Côte d’Ivoire, succursale du Sénégal',
    shortName: 'Bridge Bank',
    sortOrder: 42,
  },
  {
    name: 'Banque de Développement du Mali, succursale du Sénégal',
    shortName: 'BDM',
    sortOrder: 43,
  },

  // Microfinance — absentes de la liste BCEAO des banques, mais très présentes
  // chez les salariés syndiqués.
  { name: 'Crédit Mutuel du Sénégal', shortName: 'CMS', sortOrder: 60 },
  { name: 'PAMECAS', shortName: 'PAMECAS', sortOrder: 61 },
  { name: 'ACEP Sénégal', shortName: 'ACEP', sortOrder: 62 },
  { name: 'Baobab Sénégal', shortName: 'Baobab', sortOrder: 63 },

  { name: 'Autre établissement', shortName: 'Autre', sortOrder: 900 },
  { name: 'Aucune domiciliation bancaire', shortName: 'Aucune', sortOrder: 901 },
] as const;
