export interface SyndicatSeed {
  name: string;
  sigle: string;
  secteur: string;
  sortOrder: number;
}

export const SYNDICATS_SENEGAL: readonly SyndicatSeed[] = [
  {
    name: "Coopérative d'Habitat de l'Union des Enseignants du Sénégal",
    sigle: 'CHUES',
    secteur: "Coopérative d'habitat",
    sortOrder: 1,
  },
  {
    name: 'Union des Enseignants du Sénégal',
    sigle: 'UES',
    secteur: 'Éducation',
    sortOrder: 2,
  },

  {
    name: 'Syndicat Autonome des Enseignants du Moyen Secondaire du Sénégal',
    sigle: 'SAEMSS',
    secteur: 'Éducation',
    sortOrder: 10,
  },
  {
    name: 'Cadre Unitaire Syndical des Enseignants du Moyen Secondaire',
    sigle: 'CUSEMS',
    secteur: 'Éducation',
    sortOrder: 11,
  },
  {
    name: 'Syndicat des Enseignants Libres du Sénégal',
    sigle: 'SELS',
    secteur: 'Éducation',
    sortOrder: 12,
  },
  {
    name: 'Syndicat des Enseignants Libres du Sénégal / Authentique',
    sigle: 'SELS/A',
    secteur: 'Éducation',
    sortOrder: 13,
  },
  {
    name: 'Union Démocratique des Enseignantes et Enseignants du Sénégal',
    sigle: 'UDEN',
    secteur: 'Éducation',
    sortOrder: 14,
  },
  {
    name: 'Syndicat National des Enseignants en Langue Arabe du Sénégal',
    sigle: 'SNELAS/FC',
    secteur: 'Éducation',
    sortOrder: 15,
  },
  {
    name: "Syndicat des Inspectrices et Inspecteurs de l'Éducation Nationale du Sénégal",
    sigle: 'SIENS',
    secteur: 'Éducation',
    sortOrder: 16,
  },

  {
    name: "Syndicat Autonome de l'Enseignement Supérieur",
    sigle: 'SAES',
    secteur: 'Enseignement supérieur',
    sortOrder: 20,
  },

  {
    name: 'Syndicat Unique des Travailleurs de la Santé et de l’Action Sociale',
    sigle: 'SUTSAS',
    secteur: 'Santé',
    sortOrder: 30,
  },
  {
    name: 'Syndicat Autonome des Médecins du Sénégal',
    sigle: 'SAMES',
    secteur: 'Santé',
    sortOrder: 31,
  },
  {
    name: 'Syndicat Autonome des Travailleurs de la Santé',
    sigle: 'SAT-Santé',
    secteur: 'Santé',
    sortOrder: 32,
  },

  {
    name: 'Confédération Nationale des Travailleurs du Sénégal',
    sigle: 'CNTS',
    secteur: 'Centrale syndicale',
    sortOrder: 40,
  },
  {
    name: 'Confédération Nationale des Travailleurs du Sénégal / Forces du Changement',
    sigle: 'CNTS/FC',
    secteur: 'Centrale syndicale',
    sortOrder: 41,
  },
  {
    name: 'Union Nationale des Syndicats Autonomes du Sénégal',
    sigle: 'UNSAS',
    secteur: 'Centrale syndicale',
    sortOrder: 42,
  },
  {
    name: 'Confédération des Syndicats Autonomes du Sénégal',
    sigle: 'CSA',
    secteur: 'Centrale syndicale',
    sortOrder: 43,
  },
  {
    name: 'Union Démocratique des Travailleurs du Sénégal',
    sigle: 'UDTS',
    secteur: 'Centrale syndicale',
    sortOrder: 44,
  },

  {
    name: 'Syndicat des Travailleurs de la Justice',
    sigle: 'SYTJUST',
    secteur: 'Justice',
    sortOrder: 50,
  },
  {
    name: "Syndicat des Professionnels de l'Information et de la Communication du Sénégal",
    sigle: 'SYNPICS',
    secteur: 'Presse',
    sortOrder: 51,
  },
  {
    name: "Syndicat Unique des Travailleurs de l'Électricité",
    sigle: 'SUTELEC',
    secteur: 'Énergie',
    sortOrder: 52,
  },

  { name: 'Autre structure', sigle: 'AUTRE', secteur: 'Autre', sortOrder: 900 },
  { name: 'Aucune structure', sigle: 'AUCUNE', secteur: 'Autre', sortOrder: 901 },
] as const;
