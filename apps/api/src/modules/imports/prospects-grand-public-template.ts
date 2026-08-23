import type { ImportColumn, SheetLayout } from './import-adapter.js';

export const GRAND_PUBLIC_IMPORT_HEADERS = {
  prenom: 'Prénom',
  nom: 'Nom',
  phone: 'Téléphone',
  profession: 'Profession',
  syndicat: 'Syndicat',
  banque: 'Banque de domiciliation',
  fonctionnaire: 'Fonctionnaire (oui/non)',
  dureeSysteme: 'Durée système',
  canal: 'Canal de provenance',
} as const;

const H = GRAND_PUBLIC_IMPORT_HEADERS;

export const GRAND_PUBLIC_SHEET_NAME = 'Prospects Grand Public';

/** Le classeur de la direction commerciale gagne des colonnes d'un mois à l'autre. */
export const GRAND_PUBLIC_SHEET_LAYOUT: SheetLayout = {
  sheetPattern: /prospect/i,
  headerRow: 1,
};

/** Un fichier Grand Public vient d'une campagne, pas d'une reprise d'annuaire. */
export const GRAND_PUBLIC_MAX_ROWS = 50_000;

export const OUI_TOKENS: readonly string[] = ['oui', 'o', 'yes', 'y', 'vrai', 'true', 'x', '1'];

export const NON_TOKENS: readonly string[] = ['non', 'n', 'no', 'faux', 'false', '0'];

/** Ce qu'Excel propose dans la colonne, quand elle est tenue à la souris. */
export const FONCTIONNAIRE_CHOICES: readonly string[] = ['Oui', 'Non'];

export const DUREE_SYSTEME_MAX_MOIS = 300;

/**
 * Deux colonnes obligatoires, sept facultatives.
 *
 * Une cellule vide n'est pas une faute : c'est une information qu'on n'a pas
 * encore. Exiger la banque ferait refuser la moitié d'un fichier de campagne.
 */
export const GRAND_PUBLIC_IMPORT_COLUMNS: readonly ImportColumn[] = [
  {
    header: H.prenom,
    width: 22,
    required: false,
    aliases: ['Prénoms'],
    help: 'Facultatif. Prénom SEUL, prénoms composés compris. Colonne distincte du nom.',
    sample: 'Aminata',
  },
  {
    header: H.nom,
    width: 22,
    required: true,
    aliases: ['Nom de famille', 'Noms'],
    help: 'Obligatoire. Nom de famille SEUL : le serveur ne découpe pas un nom complet.',
    sample: 'Ndiaye',
  },
  {
    header: H.phone,
    width: 20,
    required: true,
    aliases: ['Tel', 'Numéro', 'Numéro de téléphone', 'Contact'],
    help: 'Obligatoire. 77 123 45 67, +221 77 123 45 67 et 00221771234567 sont tous lus. C’est ce numéro qui sert à repérer les doublons.',
    sample: '77 123 45 67',
  },
  {
    header: H.profession,
    width: 26,
    required: false,
    aliases: ['Métier', 'Activité'],
    help: 'Facultative. Texte libre, tel que la personne l’a déclaré. 120 caractères au plus.',
    sample: 'Couturière',
  },
  {
    header: H.syndicat,
    width: 18,
    required: false,
    help: 'Facultatif, et vide pour l’écrasante majorité des fiches Grand Public. Rempli, il doit être repris de la liste déroulante.',
    sample: '',
  },
  {
    header: H.banque,
    width: 24,
    required: false,
    aliases: ['Banque', 'Domiciliation'],
    help: 'Facultative. Rempli, le nom court doit être repris de la liste déroulante : c’est lui qui, croisé au syndicat, donne le segment BDD.',
    sample: 'CBAO',
  },
  {
    header: H.fonctionnaire,
    width: 22,
    required: false,
    aliases: ['Fonctionnaire'],
    help: 'Facultative. « Oui » range la fiche en FONCTIONNAIRE. « Non » dit seulement ce que la personne n’est pas : le type reste vide, il ne se devine pas entre secteur privé, informel et diaspora.',
    sample: 'Oui',
  },
  {
    header: H.dureeSysteme,
    width: 18,
    required: false,
    aliases: ['Durée du système', 'Durée système de paiement', 'Durée (mois)'],
    help: `Facultative. Un nombre de MOIS, entier, de 1 à ${String(DUREE_SYSTEME_MAX_MOIS)}. « 24 » et « 24 mois » sont lus ; « 2 ans » ne l’est pas.`,
    sample: '24',
  },
  {
    header: H.canal,
    width: 26,
    required: false,
    aliases: ['Canal', 'Provenance', 'Source'],
    help: 'Facultatif. Rempli, il doit être repris de la liste déroulante, tirée des canaux du jour.',
    sample: 'TikTok',
  },
];
