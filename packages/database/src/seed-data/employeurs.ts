export interface EmployeurSeed {
  code: string;
  label: string;
  type: 'MINISTERE' | 'ENTREPRISE';
  position: number;
}

const MINISTERES: readonly [string, string][] = [
  ['MIN_FORCES_ARMEES', 'Ministère des Forces armées'],
  ['MIN_INTERIEUR', 'Ministère de l’Intérieur et de la Sécurité publique'],
  ['MIN_JUSTICE', 'Ministère de la Justice'],
  ['MIN_AFFAIRES_ETRANGERES', 'Ministère des Affaires étrangères et de l’Intégration africaine'],
  ['MIN_FINANCES_BUDGET', 'Ministère des Finances et du Budget'],
  ['MIN_ECONOMIE_PLAN', 'Ministère de l’Économie, du Plan et de la Coopération'],
  ['MIN_EDUCATION_NATIONALE', 'Ministère de l’Éducation nationale'],
  [
    'MIN_ENSEIGNEMENT_SUPERIEUR',
    'Ministère de l’Enseignement supérieur, de la Recherche et de l’Innovation',
  ],
  ['MIN_FORMATION_PROFESSIONNELLE', 'Ministère de la Formation professionnelle et technique'],
  ['MIN_SANTE', 'Ministère de la Santé et de l’Action sociale'],
  ['MIN_AGRICULTURE', 'Ministère de l’Agriculture, de la Souveraineté alimentaire et de l’Élevage'],
  ['MIN_PECHES', 'Ministère des Pêches, des Infrastructures maritimes et portuaires'],
  ['MIN_INFRASTRUCTURES', 'Ministère des Infrastructures et des Transports terrestres et aériens'],
  ['MIN_HYDRAULIQUE', 'Ministère de l’Hydraulique et de l’Assainissement'],
  ['MIN_ENERGIE_PETROLE_MINES', 'Ministère de l’Énergie, du Pétrole et des Mines'],
  ['MIN_ENVIRONNEMENT', 'Ministère de l’Environnement et de la Transition écologique'],
  [
    'MIN_URBANISME_COLLECTIVITES',
    'Ministère de l’Urbanisme, des Collectivités territoriales et de l’Aménagement des territoires',
  ],
  [
    'MIN_COMMUNICATION_NUMERIQUE',
    'Ministère de la Communication, des Télécommunications et du Numérique',
  ],
  ['MIN_INDUSTRIE_COMMERCE', 'Ministère de l’Industrie et du Commerce'],
  [
    'MIN_TRAVAIL_EMPLOI',
    'Ministère du Travail, de l’Emploi et des Relations avec les institutions',
  ],
  ['MIN_FONCTION_PUBLIQUE', 'Ministère de la Fonction publique et de la Réforme du service public'],
  ['MIN_MICROFINANCE', 'Ministère de la Microfinance et de l’Économie sociale et solidaire'],
  ['MIN_TOURISME_ARTISANAT', 'Ministère du Tourisme et de l’Artisanat'],
  ['MIN_CULTURE', 'Ministère de la Culture et du Patrimoine historique'],
  ['MIN_JEUNESSE_SPORTS', 'Ministère de la Jeunesse et des Sports'],
  ['MIN_FAMILLE_SOLIDARITES', 'Ministère de la Famille et des Solidarités'],
];

const ENTREPRISES: readonly [string, string][] = [
  ['EMP_SONATEL', 'Sonatel (Orange Sénégal)'],
  ['EMP_FREE', 'Free Sénégal'],
  ['EMP_EXPRESSO', 'Expresso Sénégal'],
  ['EMP_SENELEC', 'SENELEC'],
  ['EMP_SEN_EAU', 'Sen’Eau'],
  ['EMP_SONES', 'SONES'],
  ['EMP_PORT_AUTONOME_DAKAR', 'Port autonome de Dakar'],
  ['EMP_AIR_SENEGAL', 'Air Sénégal'],
  ['EMP_LA_POSTE', 'La Poste'],
  ['EMP_DAKAR_DEM_DIKK', 'Dakar Dem Dikk'],
  ['EMP_PETROSEN', 'Petrosen'],
  ['EMP_ICS', 'Industries chimiques du Sénégal'],
  ['EMP_SOCOCIM', 'Sococim Industries'],
  ['EMP_EIFFAGE', 'Eiffage Sénégal'],
  ['EMP_CBAO', 'CBAO Attijariwafa Bank'],
  ['EMP_ECOBANK', 'Ecobank Sénégal'],
  ['EMP_SGBS', 'Société Générale Sénégal'],
  ['EMP_BICIS', 'BICIS'],
];

export const EMPLOYEURS_SENEGAL: readonly EmployeurSeed[] = [
  ...MINISTERES.map(([code, label], index): EmployeurSeed => ({
    code,
    label,
    type: 'MINISTERE',
    position: index + 1,
  })),
  ...ENTREPRISES.map(([code, label], index): EmployeurSeed => ({
    code,
    label,
    type: 'ENTREPRISE',
    position: MINISTERES.length + index + 1,
  })),
];
