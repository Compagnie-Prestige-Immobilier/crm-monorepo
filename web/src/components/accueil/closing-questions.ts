import { type Closing } from '@/lib/data/rendez-vous';

type Champ = keyof Closing;
export type Question = {
  champ: Champ;
  label: string;
  choix?: readonly string[] | 'sites' | 'chargesDeClientele';
  long?: true;
};

/** Trois écrans courts : le chargé de clientèle enregistre dès qu'il a ce qu'il sait. */
export const ETAPES: readonly { titre: string; questions: readonly Question[] }[] = [
  {
    titre: 'Lot',
    questions: [
      { champ: 'localite', label: 'Localité du lot', choix: 'sites' },
      {
        champ: 'superficie',
        label: 'Superficie du lot',
        choix: ['300 m²', '200 m²', '225 m²', '150 m²'],
      },
      {
        champ: 'natureJuridique',
        label: 'Nature juridique',
        choix: ['Titre foncier', 'Bail', 'Notification de bail et délibération'],
      },
      {
        champ: 'etatSite',
        label: 'État du site',
        choix: ['Viabilisé complet', 'Viabilisé partiel', 'Loti'],
      },
      {
        champ: 'position',
        label: 'Position',
        choix: ['Bordure route', 'Deuxième position', 'Angle', 'Double façade', 'Pas angle'],
      },
    ],
  },
  // Étapes 2 et 3 : listes reprises du calculateur BANT de CPI.
  {
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
  },
  {
    titre: 'Freins & suivi',
    questions: [
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
      { champ: 'dateRelance', label: 'Date de relance' },
      { champ: 'compteRendu', label: 'Compte-rendu de l’échange', long: true },
    ],
  },
];
