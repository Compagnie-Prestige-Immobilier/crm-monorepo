import type { Fiche } from './bant';

export const CONFIG = {
  VERSION: 'Prototype - septembre 2026',
  POIDS: { budget: 30, authority: 20, need: 20, timeline: 15, engagement: 15 },
  SEUILS_CLASSES: { A: 75, B: 55, C: 35 },
  ACOMPTE: 0.5,
  DUREE_CPI_MOIS: 24,
  ENDETTEMENT_OK: 0.33,
  ENDETTEMENT_LIMITE: 0.45,
  RESTE_BASE: 75000,
  RESTE_PAR_PERSONNE: 25000,
  PRIX_MIN: 3750000,
  PRIX_MAX: 13000000,
  EUR: 655.957,
  LOCALITES: [
    'Dakar',
    'Pikine / Guédiawaye',
    'Rufisque',
    'Diamniadio / Lac Rose',
    'Bargny / Sendou',
    'Thiès',
    'Mbour / Saly',
    'Touba',
    'Kaolack',
    'Saint-Louis',
    'Ziguinchor',
    'Autre',
    'Indifférent',
  ],
  SUPERFICIES: ['150 m²', '200 m²', '250 m²', '300 m²', '400 m²', '500 m² et plus'],
  // Dates du calendrier lunaire approximatives, à mettre à jour chaque année.
  PERIODES: [
    { nom: 'Rentrée scolaire', debut: '2026-09-15', fin: '2026-10-15', type: 'warn' },
    {
      nom: "Fêtes de fin d'année (retour de la diaspora)",
      debut: '2026-12-15',
      fin: '2027-01-05',
      type: 'good',
    },
    { nom: 'Korité', debut: '2027-02-28', fin: '2027-03-12', type: 'warn' },
    { nom: 'Tabaski', debut: '2027-05-01', fin: '2027-05-21', type: 'warn' },
    {
      nom: "Vacances d'été (retour de la diaspora)",
      debut: '2027-07-01',
      fin: '2027-08-31',
      type: 'good',
    },
    { nom: 'Grand Magal de Touba', debut: '2027-07-15', fin: '2027-07-25', type: 'warn' },
    { nom: 'Rentrée scolaire', debut: '2027-09-15', fin: '2027-10-15', type: 'warn' },
    {
      nom: "Fêtes de fin d'année (retour de la diaspora)",
      debut: '2027-12-15',
      fin: '2028-01-05',
      type: 'good',
    },
  ],
} as const;

export type Option = readonly [value: string, label: string];
type Kind = 'select' | 'text' | 'tel' | 'number' | 'date' | 'textarea';
export type Field = {
  id: string;
  label: string | ((f: Fiche) => string);
  section: string;
  kind: Kind;
  options?: readonly Option[];
  placeholder?: string;
  show?: (f: Fiche) => boolean;
};
export type Section = {
  id: string;
  phase: 1 | 2 | 3;
  title: string;
  hint?: string;
  show?: (f: Fiche) => boolean;
};

const same = (...labels: string[]): Option[] => labels.map((l) => [l, l]);
const v = (f: Fiche, id: string) => f.values[id] ?? '';
const notFormal = (f: Fiche) => f.sector !== 'formal';
const PAPIERS: Option[] = [
  ['titre-foncier', 'Titre foncier'],
  ['bail', 'Bail'],
  ['notification-bail', 'Notification de bail'],
];
const ETATS: Option[] = [
  ['viabilise-complet', 'Viabilisé complet'],
  ['viabilise-partiel', 'Viabilisé partiel'],
  ['loti', 'Loti'],
];
export const PAPIERS_OPTIONS = PAPIERS;
export const ETATS_OPTIONS = ETATS;
export const LOCALITES_OPTIONS = same(...CONFIG.LOCALITES);
export const SUPERFICIES_OPTIONS = same(...CONFIG.SUPERFICIES);

export const SECTIONS: Section[] = [
  { id: 'info', phase: 1, title: 'Informations' },
  { id: 'b2b', phase: 1, title: 'Structure (B2B)', show: (f) => f.sector === 'formal' },
  { id: 'diaspora', phase: 1, title: 'Prospect diaspora', show: (f) => f.residence === 'diaspora' },
  {
    id: 'projet',
    phase: 1,
    title: 'Projet recherché',
    hint: "Alimente l'adéquation de l'offre et la demande par localité transmise à la Direction des affaires foncières.",
  },
  {
    id: 'motivations',
    phase: 1,
    title: "Qu'est-ce qui motive l'achat ?",
    hint: 'La première motivation choisie est la motivation principale.',
    show: notFormal,
  },
  { id: 'consent', phase: 2, title: 'Consentement' },
  { id: 'famille', phase: 2, title: 'Situation personnelle', show: notFormal },
  { id: 'banque', phase: 2, title: 'Banque et financement' },
  {
    id: 'credit',
    phase: 2,
    title: 'Revenus, crédits et apport',
    hint: 'Montants dans la devise des revenus. Revenus variables : saisir la moyenne des 6 derniers mois.',
    show: notFormal,
  },
  {
    id: 'lot',
    phase: 3,
    title: 'Lot proposé',
    hint: 'Choisir un lot du catalogue remplit la localité, la superficie, les papiers, l’état et le prix.',
  },
  {
    id: 'conformite',
    phase: 3,
    title: 'Acquéreur et conformité',
    hint: 'Vigilance anti-blanchiment : identité, origine des fonds, personnes politiquement exposées. Procédure à valider par le conseil juridique.',
  },
  { id: 'suivi', phase: 3, title: 'Freins et suivi' },
];

export const PHASES = [
  {
    n: 1,
    title: 'Premier contact',
    intro:
      "5 à 10 min : identité, projet, motivation, calendrier. Pas de questions d'argent à ce stade, on écoute.",
  },
  {
    n: 2,
    title: 'Découverte',
    intro:
      'Au RDV : recueillir le consentement, puis situation, banque, revenus, crédits et apport.',
  },
  {
    n: 3,
    title: 'Closing',
    intro:
      'Lot proposé, acquéreur au titre, conformité, frein principal, prochaine action datée et compte-rendu.',
  },
] as const;

const PRET = (f: Fiche) => ['accord', 'en-cours', 'envisage'].includes(v(f, 'financement'));

export const FIELDS: Field[] = [
  {
    id: 'prospect-name',
    section: 'info',
    kind: 'text',
    label: 'Nom du contact',
    placeholder: 'Prénom et nom',
  },
  {
    id: 'company',
    section: 'info',
    kind: 'text',
    label: (f) =>
      f.sector === 'formal'
        ? 'Nom de la structure'
        : f.sector === 'collective'
          ? 'Nom du groupement'
          : 'Entreprise / employeur',
  },
  {
    id: 'telephone',
    section: 'info',
    kind: 'tel',
    label: 'Téléphone / WhatsApp',
    placeholder: '77 000 00 00 ou +33…',
  },
  {
    id: 'secteur-activite',
    section: 'info',
    kind: 'select',
    label: "Secteur d'activité",
    show: (f) => f.sector !== 'collective',
    options: [
      ['fonctionnaire', 'Fonction publique'],
      ['enseignant', 'Enseignement'],
      ['sante', 'Santé'],
      ['banque', 'Banque / Finance'],
      ['ong', 'ONG / Organisation internationale'],
      ['grande-entreprise', 'Grande entreprise privée'],
      ['pme', 'PME'],
      ['commerce', 'Commerce'],
      ['artisan', 'Artisan'],
      ['agriculture', 'Agriculture / pêche'],
      ['btp', 'BTP'],
      ['transport', 'Transport'],
      ['tech', 'Tech / télécoms'],
      ['liberal', 'Profession libérale'],
      ['retraite', 'Retraité'],
      ['autre', 'Autre'],
    ],
  },
  {
    id: 'role-groupement',
    section: 'info',
    kind: 'select',
    label: 'Rôle dans le groupement',
    show: (f) => f.sector === 'collective',
    options: [
      ['presidente', 'Présidente / Président'],
      ['sg', 'Secrétaire général'],
      ['tresorier', 'Trésorier'],
      ['bureau', 'Membre du bureau'],
      ['membre-actif', 'Membre actif'],
      ['simple-membre', 'Simple membre'],
    ],
  },
  {
    id: 'etape',
    section: 'info',
    kind: 'select',
    label: 'Étape du dossier',
    options: [
      ['nouveau', 'Nouveau lead'],
      ['contacte', 'Contacté'],
      ['rdv', 'RDV fixé'],
      ['visite', 'Visite effectuée'],
      ['proposition', 'Proposition envoyée'],
      ['negociation', 'En négociation'],
      ['reservation', 'Réservation / acompte versé'],
      ['perdu', 'Perdu'],
    ],
  },
  {
    id: 'motif-perte',
    section: 'info',
    kind: 'select',
    label: 'Motif de perte',
    show: (f) => v(f, 'etape') === 'perdu',
    options: [
      ['prix', 'Prix trop élevé'],
      ['concurrent', 'Parti chez un concurrent'],
      ['confiance', 'Manque de confiance'],
      ['financement', 'Financement refusé'],
      ['zone', 'Zone ne convient pas'],
      ['report', 'Projet reporté'],
      ['injoignable', 'Injoignable'],
    ],
  },
  {
    id: 'deja-client',
    section: 'info',
    kind: 'select',
    label: 'Déjà client CPI ?',
    options: [
      ['oui', 'Oui (a déjà acheté)'],
      ['non', 'Non'],
    ],
  },
  {
    id: 'programme',
    section: 'info',
    kind: 'select',
    label: 'Programme déjà acheté',
    show: (f) => v(f, 'deja-client') === 'oui',
    options: [
      ['programme-premium', 'Premium'],
      ['programme-moyen', 'Moyen'],
      ['programme-economique', 'Économique'],
      ['programme-social', 'Social'],
    ],
  },
  {
    id: 'visite-cpi',
    section: 'info',
    kind: 'select',
    label: 'Visite agence CPI',
    show: (f) => v(f, 'deja-client') === 'non',
    options: [
      ['oui-plusieurs', 'Plusieurs fois'],
      ['oui-une-fois', 'Une fois'],
      ['non', 'Jamais'],
    ],
  },
  {
    id: 'visite-site',
    section: 'info',
    kind: 'select',
    label: 'Visite du site',
    show: (f) => v(f, 'deja-client') === 'non' && f.residence !== 'diaspora',
    options: [
      ['oui-plusieurs', 'Plusieurs'],
      ['oui-un', 'Une'],
      ['non', 'Jamais'],
    ],
  },
  {
    id: 'canal',
    section: 'info',
    kind: 'select',
    label: 'Canal de captation',
    options: [
      ['institutionnel', 'Institutionnel (convention, employeur)'],
      ['parrainage', 'Parrainage / recommandation'],
      ['digital', 'Entrant digital (réseaux, site)'],
      ['terrain', 'Terrain / prospection'],
      ['evenementiel', 'Événementiel (salon, foire)'],
    ],
  },
  {
    id: 'langue',
    section: 'info',
    kind: 'select',
    label: 'Langue préférée',
    options: same(
      'Wolof',
      'Français',
      'Pulaar',
      'Sérère',
      'Diola',
      'Mandingue',
      'Soninké',
      'Anglais',
      'Autre',
    ),
  },
  {
    id: 'moment',
    section: 'info',
    kind: 'select',
    label: 'Meilleur moment pour le joindre',
    options: [
      ['matin', 'Matin (avant 10h)'],
      ['journee', 'Journée'],
      ['pause', 'Pause déjeuner'],
      ['soir', 'Après 18h'],
      ['weekend', 'Week-end uniquement'],
    ],
  },
  {
    id: 'contact-prefere',
    section: 'info',
    kind: 'select',
    label: 'Canal de contact préféré',
    options: [
      ['whatsapp', 'WhatsApp'],
      ['appel', 'Appel'],
      ['email', 'Email'],
      ['visite', 'Visite'],
      ['visio', 'Visio'],
    ],
  },

  {
    id: 'type-structure',
    section: 'b2b',
    kind: 'select',
    label: 'Type de structure',
    options: [
      ['privee', 'Entreprise privée'],
      ['administration', 'Administration / ministère'],
      ['parapublic', 'Société parapublique / agence'],
      ['banque', 'Banque / assurance'],
      ['ong', 'ONG / organisation internationale'],
      ['mutuelle', 'Mutuelle / amicale / syndicat'],
    ],
  },
  {
    id: 'effectif',
    section: 'b2b',
    kind: 'select',
    label: 'Effectif total',
    options: [
      ['moins-50', 'Moins de 50'],
      ['50-200', '50 à 200'],
      ['200-1000', '200 à 1 000'],
      ['plus-1000', 'Plus de 1 000'],
    ],
  },
  {
    id: 'salaries-concernes',
    section: 'b2b',
    kind: 'number',
    label: 'Salariés potentiellement intéressés',
  },
  {
    id: 'fonction-interlocuteur',
    section: 'b2b',
    kind: 'select',
    label: "Fonction de l'interlocuteur",
    options: [
      ['dg', 'Directeur général / dirigeant'],
      ['drh', 'DRH / responsable social'],
      ['daf', 'DAF'],
      ['delegue', 'Délégué du personnel / syndicat / amicale'],
      ['autre', 'Autre'],
    ],
  },
  {
    id: 'objectif-structure',
    section: 'b2b',
    kind: 'select',
    label: 'Objectif de la structure',
    options: [
      ['social', 'Avantage social / fidéliser les salariés'],
      ['logement-fonction', 'Loger des agents (logement de fonction)'],
      ['investissement', 'Investissement de la structure'],
      ['relais', "Simple relais d'information aux salariés"],
    ],
  },
  {
    id: 'modalite',
    section: 'b2b',
    kind: 'select',
    label: 'Modalité envisagée',
    options: [
      ['convention', 'Convention CPI / structure (prix de groupe)'],
      ['prelevement', 'Prélèvement sur salaire'],
      ['achat-groupe', 'Achat groupé par la structure'],
      ['information', 'Information simple aux salariés'],
    ],
  },
  {
    id: 'cycle',
    section: 'b2b',
    kind: 'select',
    label: 'Cycle de validation interne',
    options: [
      ['court', "Décision de l'interlocuteur (moins d'1 mois)"],
      ['comite', 'Comité de direction (1 à 3 mois)'],
      ['conseil', "Conseil d'administration / budget annuel"],
    ],
  },

  {
    id: 'pays',
    section: 'diaspora',
    kind: 'select',
    label: 'Pays de résidence',
    options: same(
      'France',
      'Italie',
      'Espagne',
      'Belgique',
      'Allemagne',
      'Royaume-Uni',
      'États-Unis',
      'Canada',
      'Suisse',
      "Côte d'Ivoire",
      'Gabon',
      'Mauritanie',
      'Maroc',
      'Pays du Golfe',
      'Autre',
    ),
  },
  {
    id: 'mandataire',
    section: 'diaspora',
    kind: 'select',
    label: 'Représentant au Sénégal',
    options: [
      ['procuration', 'Mandataire avec procuration notariée'],
      ['proche', 'Proche de confiance, sans procuration'],
      ['aucun', 'Personne sur place'],
    ],
  },
  {
    id: 'sejour',
    section: 'diaspora',
    kind: 'select',
    label: 'Prochain séjour au Sénégal',
    options: [
      ['sur-place', 'Actuellement au Sénégal'],
      ['moins-1-mois', "Dans moins d'1 mois"],
      ['1-3-mois', 'Dans 1 à 3 mois'],
      ['3-6-mois', 'Dans 3 à 6 mois'],
      ['inconnu', 'Pas prévu / inconnu'],
    ],
  },
  {
    id: 'paiement-diaspora',
    section: 'diaspora',
    kind: 'select',
    label: 'Moyen de paiement envisagé',
    options: [
      ['virement', 'Virement bancaire international'],
      ['transfert', "Transfert d'argent (Wave, WorldRemit, WU…)"],
      ['famille', 'Remise via la famille'],
    ],
  },
  {
    id: 'vu-terrain',
    section: 'diaspora',
    kind: 'select',
    label: 'A vu le terrain ?',
    options: [
      ['personne', 'Oui, en personne'],
      ['video', 'Oui, en visite vidéo avec CPI'],
      ['proche', "Un proche l'a visité"],
      ['non', 'Non'],
    ],
  },
  {
    id: 'inquietude',
    section: 'diaspora',
    kind: 'select',
    label: 'Principale inquiétude',
    options: [
      ['arnaque', 'Arnaque / double vente du terrain'],
      ['argent', "Détournement de l'argent envoyé"],
      ['chantier', 'Suivi du chantier à distance'],
      ['papiers', 'Papiers / titre de propriété'],
      ['prix', 'Prix / rentabilité'],
      ['aucune', 'Aucune exprimée'],
    ],
  },

  {
    id: 'localite-souhaitee',
    section: 'projet',
    kind: 'select',
    label: 'Localité souhaitée',
    options: LOCALITES_OPTIONS,
  },
  {
    id: 'superficie',
    section: 'projet',
    kind: 'select',
    label: 'Superficie souhaitée',
    options: SUPERFICIES_OPTIONS,
  },
  {
    id: 'exigence-papiers',
    section: 'projet',
    kind: 'select',
    label: 'Exigence sur les papiers',
    options: [
      ['tf', 'Titre foncier exigé'],
      ['bail', 'Bail accepté'],
      ['indifferent', 'Indifférent'],
    ],
  },
  {
    id: 'type-projet',
    section: 'projet',
    kind: 'select',
    label: 'Formule souhaitée',
    options: [
      ['terrain-construction', 'Terrain + construction'],
      ['terrain-seul', 'Terrain seul'],
    ],
  },
  {
    id: 'delai-construction',
    section: 'projet',
    kind: 'select',
    label: 'Construction souhaitée',
    show: (f) => v(f, 'type-projet') === 'terrain-construction',
    options: [
      ['immediat', 'Dès fin paiement'],
      ['court', '6-12 mois'],
      ['moyen', '1-2 ans'],
      ['long', '3-5 ans'],
      ['tres-long', '5+ ans'],
    ],
  },

  {
    id: 'statut-pro',
    section: 'famille',
    kind: 'select',
    label: 'Statut professionnel',
    options: [
      ['fonctionnaire', 'Fonctionnaire (titulaire)'],
      ['cdi', 'Salarié CDI'],
      ['cdd', 'Contractuel / CDD'],
      ['liberal', 'Profession libérale'],
      ['independant', "Chef d'entreprise / indépendant déclaré"],
      ['informel', 'Commerçant / activité informelle'],
      ['retraite', 'Retraité (pension)'],
      ['sans-revenu', 'Sans revenu régulier'],
    ],
  },
  {
    id: 'age',
    section: 'famille',
    kind: 'select',
    label: "Tranche d'âge",
    options: [
      ['moins-30', 'Moins de 30 ans'],
      ['30-40', '30 - 40 ans'],
      ['40-50', '40 - 50 ans'],
      ['50-60', '50 - 60 ans'],
      ['plus-60', 'Plus de 60 ans'],
    ],
  },
  {
    id: 'matrimonial',
    section: 'famille',
    kind: 'select',
    label: 'Situation matrimoniale',
    options: [
      ['celibataire', 'Célibataire'],
      ['marie', 'Marié(e)'],
      ['divorce', 'Divorcé(e)'],
      ['veuf', 'Veuf / veuve'],
    ],
  },
  {
    id: 'charges',
    section: 'famille',
    kind: 'select',
    label: 'Personnes à charge',
    options: [
      ['0', 'Aucune'],
      ['1-2', '1 - 2'],
      ['3-5', '3 - 5'],
      ['6+', '6 et plus'],
    ],
  },
  {
    id: 'logement',
    section: 'famille',
    kind: 'select',
    label: 'Logement actuel',
    options: [
      ['locataire', 'Locataire'],
      ['heberge', 'Hébergé (famille, belle-famille)'],
      ['fonction', 'Logement de fonction'],
      ['proprietaire', 'Propriétaire'],
    ],
  },
  {
    id: 'loyer',
    section: 'famille',
    kind: 'number',
    label: 'Loyer mensuel',
    show: (f) => v(f, 'logement') === 'locataire',
  },
  {
    id: 'deja-proprio',
    section: 'famille',
    kind: 'select',
    label: 'Possède déjà un terrain / bien ?',
    options: [
      ['non', 'Non, ce serait le premier'],
      ['terrain', 'Oui, un terrain'],
      ['bien', 'Oui, un ou plusieurs biens bâtis'],
    ],
  },

  {
    id: 'banque',
    section: 'banque',
    kind: 'select',
    label: 'Banque principale',
    options: [
      ...same(
        'CBAO',
        "BHS (Banque de l'Habitat)",
        'Société Générale Sénégal',
        'Ecobank',
        'BICIS',
        'Bank of Africa',
        'Banque Atlantique',
        'BIS (Banque Islamique)',
        'BNDE',
        'Orabank',
        'Coris Bank',
        'UBA',
        'CBI',
        'Crédit du Sénégal',
        'La Banque Agricole',
        'NSIA Banque',
        'BSIC',
        'Autre banque au Sénégal',
        'Crédit Mutuel du Sénégal',
        'PAMECAS',
        'ACEP',
        'Baobab',
        'Autre microfinance',
      ),
      ['etrangere', "Banque à l'étranger"],
      ['mobile', 'Mobile money uniquement (Wave / OM)'],
      ['aucun', 'Aucun compte'],
    ],
  },
  {
    id: 'banque-etrangere',
    section: 'banque',
    kind: 'text',
    label: "Nom de la banque à l'étranger",
    placeholder: 'Ex. Crédit Agricole, BNP…',
    show: (f) => v(f, 'banque') === 'etrangere',
  },
  {
    id: 'financement',
    section: 'banque',
    kind: 'select',
    label: 'Financement bancaire',
    options: [
      ['accord', 'Accord de principe obtenu'],
      ['en-cours', 'Demande en cours'],
      ['envisage', 'Envisagé, pas encore demandé'],
      ['autofinancement', 'Autofinancement (pas de crédit)'],
      ['refuse', 'Refusé / non éligible'],
    ],
  },
  {
    id: 'domiciliation',
    section: 'banque',
    kind: 'select',
    label: 'Revenus domiciliés dans cette banque ?',
    show: notFormal,
    options: [
      ['oui', 'Oui'],
      ['non', 'Non'],
    ],
  },
  {
    id: 'pret-montant',
    section: 'banque',
    kind: 'number',
    label: 'Montant du prêt bancaire (FCFA)',
    show: PRET,
  },
  {
    id: 'pret-duree',
    section: 'banque',
    kind: 'number',
    label: 'Durée du prêt (années)',
    show: PRET,
  },
  { id: 'pret-taux', section: 'banque', kind: 'number', label: 'Taux annuel (%)', show: PRET },

  { id: 'revenu', section: 'credit', kind: 'number', label: 'Revenu mensuel net' },
  {
    id: 'devise',
    section: 'credit',
    kind: 'select',
    label: 'Devise des revenus',
    options: [
      ['XOF', 'FCFA'],
      ['EUR', 'Euro (1 € = 655,957 FCFA)'],
      ['USD', 'Dollar américain'],
      ['CAD', 'Dollar canadien'],
      ['GBP', 'Livre sterling'],
      ['CHF', 'Franc suisse'],
    ],
  },
  {
    id: 'taux-change',
    section: 'credit',
    kind: 'number',
    label: (f) => `Taux : FCFA pour 1 ${v(f, 'devise')}`,
    show: (f) => !['', 'XOF', 'EUR'].includes(v(f, 'devise')),
  },
  {
    id: 'regularite',
    section: 'credit',
    kind: 'select',
    label: 'Régularité des revenus',
    options: [
      ['fixe', 'Fixe (salaire, pension)'],
      ['variable', 'Variable (commerce, activité indépendante)'],
    ],
  },
  { id: 'transferts', section: 'credit', kind: 'number', label: 'Aide familiale versée / mois' },
  {
    id: 'credit-en-cours',
    section: 'credit',
    kind: 'select',
    label: 'Crédit en cours ?',
    options: [
      ['non', 'Non, aucun crédit'],
      ['oui', 'Oui'],
    ],
  },
  {
    id: 'type-credit',
    section: 'credit',
    kind: 'select',
    label: 'Type de crédit',
    show: (f) => v(f, 'credit-en-cours') === 'oui',
    options: [
      ['immobilier', 'Crédit immobilier'],
      ['conso', 'Prêt consommation / scolaire / Tabaski'],
      ['auto', 'Crédit auto'],
      ['microcredit', 'Microcrédit'],
      ['decouvert', 'Découvert / avance sur salaire'],
      ['plusieurs', 'Plusieurs crédits'],
    ],
  },
  {
    id: 'mensualites',
    section: 'credit',
    kind: 'number',
    label: 'Total des mensualités',
    show: (f) => v(f, 'credit-en-cours') === 'oui',
  },
  {
    id: 'fin-credit',
    section: 'credit',
    kind: 'select',
    label: 'Fin du crédit',
    show: (f) => v(f, 'credit-en-cours') === 'oui',
    options: [
      ['moins-6', 'Dans moins de 6 mois'],
      ['6-12', 'Dans 6 à 12 mois'],
      ['1-2', 'Dans 1 à 2 ans'],
      ['plus-2', 'Dans plus de 2 ans'],
    ],
  },
  {
    id: 'informel-credit',
    section: 'credit',
    kind: 'select',
    label: 'Engagements informels',
    options: [
      ['non', 'Aucun'],
      ['tontine', 'Tontine en cours (cotisation)'],
      ['dette-familiale', 'Dette familiale / entre proches'],
    ],
  },
  { id: 'prix-lot', section: 'credit', kind: 'number', label: 'Prix du lot envisagé (FCFA)' },
  { id: 'apport', section: 'credit', kind: 'number', label: 'Apport disponible (FCFA)' },
  {
    id: 'origine-apport',
    section: 'credit',
    kind: 'select',
    label: "Origine de l'apport",
    options: [
      ['epargne', 'Épargne personnelle'],
      ['tontine', 'Tontine'],
      ['vente', "Vente d'un bien"],
      ['heritage', 'Héritage'],
      ['pret', 'Prêt bancaire'],
      ['famille', 'Aide familiale'],
      ['indemnite', 'Indemnités / fin de carrière'],
    ],
  },

  {
    id: 'lot-localite',
    section: 'lot',
    kind: 'select',
    label: 'Localité du lot',
    options: LOCALITES_OPTIONS,
  },
  {
    id: 'lot-superficie',
    section: 'lot',
    kind: 'select',
    label: 'Superficie du lot',
    options: SUPERFICIES_OPTIONS,
  },
  {
    id: 'nature-foncier',
    section: 'lot',
    kind: 'select',
    label: 'Nature juridique',
    options: PAPIERS,
  },
  { id: 'etat-site', section: 'lot', kind: 'select', label: 'État du site', options: ETATS },

  {
    id: 'acquereur',
    section: 'conformite',
    kind: 'select',
    label: 'Au nom de qui sera le bien ?',
    options: [
      ['lui', 'Le prospect lui-même'],
      ['conjoint', 'Le conjoint'],
      ['couple', 'Les deux époux'],
      ['enfant', 'Un ou plusieurs enfants'],
      ['famille', 'Co-acquisition familiale (frères, sœurs…)'],
      ['proche', 'Un proche au Sénégal (autre)'],
      ['societe', 'Une société / SCI'],
    ],
  },
  {
    id: 'titulaire',
    section: 'conformite',
    kind: 'text',
    label: 'Nom du ou des titulaires',
    show: (f) => !['', 'lui'].includes(v(f, 'acquereur')),
  },
  {
    id: 'piece',
    section: 'conformite',
    kind: 'select',
    label: "Pièce d'identité vérifiée",
    options: [
      ['cni', 'CNI (copie au dossier)'],
      ['passeport', 'Passeport (copie au dossier)'],
      ['consulaire', 'Carte consulaire'],
      ['non', 'Pas encore vérifiée'],
    ],
  },
  {
    id: 'mode-paiement',
    section: 'conformite',
    kind: 'select',
    label: "Paiement de l'acompte",
    options: [
      ['virement', 'Virement sur compte CPI'],
      ['versement', 'Versement à la banque sur compte CPI'],
      ['cheque', 'Chèque'],
      ['mobile', 'Mobile money'],
      ['especes', 'Espèces'],
    ],
  },
  {
    id: 'origine-justifiee',
    section: 'conformite',
    kind: 'select',
    label: 'Origine des fonds justifiée',
    options: [
      ['oui', 'Oui, justificatif reçu'],
      ['demande', 'Demandé, en attente'],
      ['non', 'Non demandé'],
    ],
  },
  {
    id: 'ppe',
    section: 'conformite',
    kind: 'select',
    label: 'Personne politiquement exposée ?',
    options: [
      ['non', 'Non'],
      ['oui', "Oui (élu, haut fonctionnaire, proche d'un dirigeant)"],
      ['verifier', 'À vérifier'],
    ],
  },

  {
    id: 'frein',
    section: 'suivi',
    kind: 'select',
    label: 'Frein principal',
    options: [
      ['prix', 'Prix trop élevé'],
      ['acompte', 'Acompte de 50% difficile'],
      ['confiance', 'Confiance envers les promoteurs'],
      ['zone', 'Zone trop éloignée'],
      ['papiers', 'Nature des papiers'],
      ['famille', "Attend l'avis de la famille"],
      ['aucun', 'Aucun frein exprimé'],
    ],
  },
  {
    id: 'concurrence',
    section: 'suivi',
    kind: 'select',
    label: 'A consulté d’autres promoteurs ?',
    options: [
      ['non', 'Non, CPI uniquement'],
      ['un', 'Oui, un autre'],
      ['plusieurs', 'Oui, il compare plusieurs offres'],
    ],
  },
  {
    id: 'parrain',
    section: 'suivi',
    kind: 'text',
    label: 'Parrain / apporteur',
    placeholder: 'Nom (si recommandé)',
  },
  { id: 'commercial', section: 'suivi', kind: 'text', label: 'Conseiller en charge' },
  {
    id: 'prochaine-action',
    section: 'suivi',
    kind: 'select',
    label: 'Prochaine action',
    options: [
      ['appel', 'Rappeler'],
      ['rdv', 'RDV agence'],
      ['visite', 'Visite de site'],
      ['video', 'Visite vidéo'],
      ['proposition', 'Envoyer la proposition'],
      ['banque', 'Relancer la banque'],
      ['signature', 'Signature / encaissement acompte'],
    ],
  },
  { id: 'date-relance', section: 'suivi', kind: 'date', label: 'Date de relance' },
  {
    id: 'satisfaction',
    section: 'suivi',
    kind: 'select',
    label: 'Satisfaction (client existant)',
    show: (f) => v(f, 'deja-client') === 'oui',
    options: [
      ['tres', 'Très satisfait'],
      ['satisfait', 'Satisfait'],
      ['mitige', 'Mitigé'],
      ['insatisfait', 'Insatisfait'],
    ],
  },
  {
    id: 'recommande',
    section: 'suivi',
    kind: 'select',
    label: 'Prêt à recommander CPI ?',
    show: (f) => v(f, 'deja-client') === 'oui',
    options: [
      ['deja', 'Oui, il a déjà recommandé'],
      ['oui', 'Oui'],
      ['non', 'Non'],
    ],
  },
  {
    id: 'compte-rendu',
    section: 'suivi',
    kind: 'textarea',
    label: 'Compte-rendu de cet échange',
    placeholder: "Ce qui s'est dit, ce qui a été promis… Ajouté à l'historique à l'enregistrement.",
  },
];

const BY_ID = new Map(FIELDS.map((f) => [f.id, f]));
const SECTION_BY_ID = new Map(SECTIONS.map((s) => [s.id, s]));

export const fieldLabel = (f: Fiche, field: Field) =>
  typeof field.label === 'function' ? field.label(f) : field.label;

export function isVisible(f: Fiche, id: string): boolean {
  const field = BY_ID.get(id);
  const section = SECTION_BY_ID.get(field?.section ?? id);
  return (section?.show?.(f) ?? true) && (field?.show?.(f) ?? true);
}

const COLUMN_TITLES: Record<string, string> = {
  company: 'Entreprise / structure',
  'taux-change': 'Taux de change',
  'consent-date': 'Date du consentement',
};
export const columnTitle = (id: string) => {
  const label = BY_ID.get(id)?.label;
  return typeof label === 'string' ? label : (COLUMN_TITLES[id] ?? id);
};

export const optionLabel = (id: string, value: string) =>
  BY_ID.get(id)?.options?.find(([k]) => k === value)?.[1] ?? value;
export const selText = (f: Fiche, id: string) => optionLabel(id, v(f, id));

export function phaseOf(id: string): 1 | 2 | 3 {
  return SECTION_BY_ID.get(BY_ID.get(id)?.section ?? id)?.phase ?? 1;
}

export function withoutHiddenValues(f: Fiche): Fiche {
  const values = Object.fromEntries(
    Object.entries(f.values).filter(([id]) => !BY_ID.has(id) || isVisible(f, id)),
  );
  return { ...f, values };
}

const NOT_COUNTED = new Set(['devise', 'compte-rendu']);
export function phaseProgress(f: Fiche, phase: 1 | 2 | 3) {
  const sections = SECTIONS.filter((s) => s.phase === phase && (s.show?.(f) ?? true));
  let total = 0,
    done = 0;
  for (const s of sections) {
    if (s.id === 'motivations') {
      total++;
      if (f.motivations.length) done++;
      continue;
    }
    if (s.id === 'consent') {
      total++;
      if (v(f, 'consent-date')) done++;
      continue;
    }
    for (const field of FIELDS) {
      if (field.section !== s.id || NOT_COUNTED.has(field.id) || !isVisible(f, field.id)) continue;
      total++;
      if (v(f, field.id)) done++;
    }
  }
  return { total, done };
}
