import { type Closing } from '@/lib/data/rendez-vous';

type Champ = keyof Closing;
export type Question = {
  champ: Champ;
  label: string;
  choix?: readonly string[] | 'sites' | 'chargesDeClientele' | 'pointsRencontre';
  /** Ajoute « Autre, à préciser » à la liste. */
  autre?: true;
  long?: true;
  type?: 'date' | 'time';
  si?: (closing: Closing) => boolean;
};
type Etape = { titre: string; questions: readonly Question[] };

const VISITE: Etape = {
  titre: 'Visite',
  questions: [
    { champ: 'dateVisite', label: 'Date de la visite', type: 'date' },
    { champ: 'heureVisite', label: 'Heure', type: 'time' },
    { champ: 'pointRencontre', label: 'Point de rencontre', choix: 'pointsRencontre', autre: true },
    { champ: 'siteInteresse', label: 'Site intéressé', choix: 'sites', autre: true },
    { champ: 'moyensUtilises', label: 'Moyens utilisés', choix: ['Moyen personnel', 'Moyen CPI'] },
    { champ: 'accompagnement', label: 'Seul ou accompagné', choix: ['Seul', 'Accompagné'] },
    { champ: 'agent', label: 'Agent', choix: 'chargesDeClientele' },
    { champ: 'chauffeur', label: 'Chauffeur' },
  ],
};

const LOT: Etape = {
  titre: 'Lot',
  questions: [
    { champ: 'localite', label: 'Localité du lot', choix: 'sites', autre: true },
    {
      champ: 'superficie',
      label: 'Superficie du lot',
      choix: ['300 m²', '200 m²', '225 m²', '150 m²'],
      autre: true,
    },
    {
      champ: 'natureJuridique',
      label: 'Nature juridique',
      choix: ['Titre foncier', 'Bail', 'Notification de bail et délibération'],
      autre: true,
    },
    {
      champ: 'etatSite',
      label: 'État du site',
      choix: ['Viabilisé complet', 'Viabilisé partiel', 'Loti'],
      autre: true,
    },
    {
      champ: 'position',
      label: 'Position',
      choix: ['Bordure route', 'Deuxième position', 'Angle', 'Double façade', 'Pas angle'],
      autre: true,
    },
  ],
};

// Étapes 2 et 3 : listes reprises du calculateur BANT de CPI.
const ACQUEREUR: Etape = {
  titre: 'Acquéreur & conformité',
  questions: [
    {
      champ: 'auNomDe',
      label: 'Au nom de qui sera le bien ?',
      choix: [
        'Le prospect lui-même',
        'Le conjoint',
        'Les deux époux',
        'Un ou plusieurs enfants',
        'Co-acquisition familiale (frères, sœurs…)',
        'Un proche au Sénégal (autre)',
        'Une société / SCI',
      ],
    },
    { champ: 'titulaires', label: 'Nom du ou des titulaires' },
    {
      champ: 'pieceIdentiteVerifiee',
      label: 'Pièce d’identité vérifiée',
      choix: [
        'CNI (copie au dossier)',
        'Passeport (copie au dossier)',
        'Carte consulaire',
        'Pas encore vérifiée',
      ],
    },
    {
      champ: 'paiementAcompte',
      label: 'Paiement de l’acompte',
      choix: [
        'Virement sur compte CPI',
        'Versement à la banque sur compte CPI',
        'Chèque',
        'Mobile money',
        'Espèces',
      ],
    },
    {
      champ: 'origineFondsJustifiee',
      label: 'Origine des fonds justifiée',
      choix: ['Oui, justificatif reçu', 'Demandé, en attente', 'Non demandé'],
    },
    {
      champ: 'personnePolitiquementExposee',
      label: 'Personne politiquement exposée ?',
      choix: ['Non', 'Oui (élu, haut fonctionnaire, proche d’un dirigeant)', 'À vérifier'],
    },
  ],
};

const QUALIFICATION: readonly Question[] = [
  {
    champ: 'qualification',
    label: 'Qualification',
    choix: ['Vendu', 'Va acheter', 'Apporteur d’affaires', 'Partenariat'],
    autre: true,
  },
  {
    champ: 'qualificationCommentaire',
    label: 'Commentaire sur le partenariat',
    long: true,
    si: (closing) => closing.qualification === 'Partenariat',
  },
];

const QUALIFICATION_EXTERNE: Question = {
  champ: 'qualificationExterne',
  label: 'Qualification du RV externe',
  choix: ['Offre modulable', 'Négociation', 'Rendez-vous site', 'Rendez-vous CPI', 'Suivi'],
};

const FREINS: readonly Question[] = [
  {
    champ: 'freinPrincipal',
    label: 'Frein principal',
    choix: [
      'Prix trop élevé',
      'Acompte de 50% difficile',
      'Confiance envers les promoteurs',
      'Zone trop éloignée',
      'Nature des papiers',
      'Attend l’avis de la famille',
      'Aucun frein exprimé',
    ],
  },
  {
    champ: 'autresPromoteurs',
    label: 'A consulté d’autres promoteurs ?',
    choix: ['Non, CPI uniquement', 'Oui, un autre', 'Oui, il compare plusieurs offres'],
  },
  { champ: 'parrain', label: 'Parrain ou apporteur' },
  {
    champ: 'chargeDeClientele',
    label: 'Chargé de clientèle en charge',
    choix: 'chargesDeClientele',
  },
  {
    champ: 'prochaineAction',
    label: 'Prochaine action',
    choix: [
      'Rappeler',
      'RDV agence',
      'Visite de site',
      'Visite vidéo',
      'Envoyer la proposition',
      'Relancer la banque',
      'Signature / encaissement acompte',
    ],
  },
  { champ: 'dateRelance', label: 'Date de relance', type: 'date' },
  { champ: 'compteRendu', label: 'Compte-rendu de l’échange', long: true },
];

/** Écrans courts : le chargé de clientèle enregistre dès qu'il a ce qu'il sait. */
export function etapesDe(typeCode: string): readonly Etape[] {
  const suivi: Etape = {
    titre: 'Freins & suivi',
    questions: [
      ...QUALIFICATION,
      ...(typeCode === 'RV_EXTERNE' ? [QUALIFICATION_EXTERNE] : []),
      ...FREINS,
    ],
  };
  const etapes = [LOT, ACQUEREUR, suivi];
  return typeCode === 'RV_SITE' ? [VISITE, ...etapes] : etapes;
}
