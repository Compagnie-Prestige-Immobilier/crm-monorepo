/**
 * Colonnes du modèle d'import, définies UNE SEULE FOIS.
 *
 * Le générateur de modèle et le lecteur d'import lisent cette liste : c'est ce
 * qui garantit qu'un fichier téléchargé le matin est relu correctement l'après
 * midi. Deux listes séparées finiraient par diverger d'une colonne, et l'erreur
 * ne se verrait qu'au moment où quelqu'un a déjà rempli mille lignes.
 *
 * L'ORDRE EST CONTRACTUEL. Le lecteur travaille par POSITION et non par
 * en-tête : un utilisateur renomme une colonne bien plus souvent qu'il n'en
 * déplace une, et rapprocher par le texte de l'en-tête ferait échouer un
 * fichier par ailleurs parfait.
 */

export interface ImportColumn {
  readonly header: string;
  readonly width: number;
  readonly required: boolean;
  /** Ce que l'auteur du fichier doit comprendre en lisant l'onglet Instructions. */
  readonly help: string;
  /** Valeur de la ligne d'exemple grisée. */
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

/** Nom de la feuille de saisie. Le lecteur prend la PREMIÈRE feuille, pas celle-ci par son nom. */
export const IMPORT_SHEET_NAME = 'Représentants';

export const INSTRUCTIONS_SHEET_NAME = 'Instructions';

/** Feuille technique qui alimente les listes déroulantes. Masquée à l'ouverture. */
export const LISTS_SHEET_NAME = 'Listes';
