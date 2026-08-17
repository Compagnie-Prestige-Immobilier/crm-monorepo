export interface ImportColumn {
  readonly header: string;
  readonly width: number;
  readonly required: boolean;
  readonly help: string;
  readonly sample: string;
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
    help: 'Facultatif. Contexte libre : établissement, horaires d’appel, personne à mentionner.',
    sample: 'Rappeler après 16 h',
  },
];

export const IMPORT_SHEET_NAME = 'Représentants';

export const INSTRUCTIONS_SHEET_NAME = 'Instructions';

export const LISTS_SHEET_NAME = 'Listes';
