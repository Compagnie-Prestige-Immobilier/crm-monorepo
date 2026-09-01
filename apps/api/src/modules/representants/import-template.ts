export interface ImportColumn {
  readonly header: string;
  readonly width: number;
  readonly required: boolean;
  readonly help: string;
  readonly sample: string;
  /** Autres intitulés admis pour cette colonne, quand le classeur vient du terrain. */
  readonly aliases?: readonly string[];
}

export const IMPORT_COLUMNS: readonly ImportColumn[] = [
  {
    header: 'Nom complet',
    width: 30,
    required: true,
    help: 'Nom et prénom du représentant, tels qu’il se présente. 2 caractères au minimum.',
    sample: 'Fatou Ndiaye',
  },
  {
    header: 'Téléphone',
    width: 20,
    required: true,
    help: 'Toutes les présentations sont admises : 77 123 45 67, +221 77 123 45 67, 00221771234567. Le serveur normalise. C’est ce numéro qui sert à repérer les doublons.',
    sample: '77 123 45 67',
  },
  {
    header: 'Département',
    width: 24,
    required: true,
    help: 'Choisir dans la liste déroulante. Les accents et la casse sont sans importance, l’orthographe non.',
    sample: 'Dakar',
  },
  {
    header: 'IEF',
    width: 26,
    required: false,
    help: 'Facultative. Si elle est renseignée, elle doit appartenir au département de la colonne précédente.',
    sample: 'IEF Almadies',
  },
  {
    header: 'Notes',
    width: 40,
    required: false,
    help: 'Facultatif. Contexte libre : horaires d’appel, personne à mentionner.',
    sample: 'Rappeler après 16 h',
  },
  // En DERNIÈRE position, et non après le nom où elle se lirait mieux : les
  // colonnes sont rapprochées par leur RANG, jamais par leur intitulé. Insérée
  // au milieu, elle décalerait toutes les suivantes et ferait entrer le
  // téléphone dans le département sur chaque classeur déjà distribué.
  {
    header: 'Établissement',
    width: 32,
    required: false,
    help: 'Facultatif. L’établissement où il exerce. Ni l’IEF, qui est une circonscription, ni le département.',
    sample: 'Lycée Blaise Diagne',
    aliases: ['Nom de l’établissement', "Nom de l'établissement", 'Etablissement'],
  },
  {
    header: 'Statut relation',
    width: 20,
    required: false,
    help: 'Facultatif. Inconnu, Contacté, Ambassadeur ou Refus. Vide vaut Inconnu, c’est-à-dire « à appeler ».',
    sample: 'Inconnu',
  },
  {
    header: 'WhatsApp',
    width: 20,
    required: false,
    help: 'Facultatif. Non demandé, Même numéro, Autre numéro ou Aucun. « Non demandé » et « Aucun » ne sont pas la même chose : le premier veut dire que la question n’a pas été posée.',
    sample: 'Non demandé',
  },
  {
    header: 'Chargé de compte',
    width: 26,
    required: false,
    help: 'Facultatif. Le compte à qui la fiche appartient : identifiant, e-mail ou nom complet. Vide, la fiche revient au compte qui importe.',
    sample: 'khadim',
    aliases: ['CC en charge', 'Téléconseiller'],
  },
  {
    header: 'Date du dernier appel',
    width: 22,
    required: false,
    help: 'Facultatif. JJ/MM/AAAA. Renseignée, elle enregistre un appel à cette date, au nom du chargé de compte : la fiche cesse de repartir dans la file comme jamais appelée.',
    sample: '18/08/2026',
    aliases: ['Date de contact'],
  },
  {
    header: 'Issue du dernier appel',
    width: 24,
    required: false,
    help: 'Facultatif, et sans effet sans la date qui précède. Joint, Injoignable, Refus, Faux numéro ou Autre. Vide vaut Joint.',
    sample: 'Joint',
  },
];

export const IMPORT_SHEET_NAME = 'Représentants';

export const INSTRUCTIONS_SHEET_NAME = 'Instructions';

export const LISTS_SHEET_NAME = 'Listes';
