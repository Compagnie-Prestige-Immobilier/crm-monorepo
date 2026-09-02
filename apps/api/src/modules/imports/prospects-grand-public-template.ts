import { ModeEpargne, TypeContrat } from '@crm/database';

import { normalizeKey } from '../representants/import-fields.js';
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
  employeur: 'Employeur',
  typeContrat: 'Type de contrat',
  anciennete: 'Ancienneté (mois)',
  lieuActivite: 'Lieu d’activité',
  modeEpargne: 'Mode d’épargne',
  paysResidence: 'Pays de résidence',
  villeResidence: 'Ville de résidence',
  whatsapp: 'WhatsApp',
  relaisNom: 'Nom du relais',
  relaisPhone: 'Téléphone du relais',
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

/** 70 ans de carrière : au-delà, c'est une saisie en années prise pour des mois. */
export const ANCIENNETE_MAX_MOIS = 840;

export const TYPE_CONTRAT_CHOICES: readonly string[] = ['CDI', 'CDD', 'Autre'];

export const MODE_EPARGNE_CHOICES: readonly string[] = [
  'Tontine',
  'Mobile money',
  'Banque',
  'Aucun',
];

function tableDe<T extends string>(entrees: readonly (readonly [string, T])[]): Map<string, T> {
  const table = new Map<string, T>();
  for (const [libelle, valeur] of entrees) table.set(normalizeKey(libelle), valeur);
  // Le nom de l'énumération est toujours accepté : un fichier réexporté depuis
  // la base porte `MOBILE_MONEY` et non « Mobile money ».
  for (const [, valeur] of entrees) table.set(normalizeKey(valeur), valeur);
  return table;
}

const TYPES_CONTRAT = tableDe<TypeContrat>([
  ['CDI', TypeContrat.CDI],
  ['CDD', TypeContrat.CDD],
  ['Autre', TypeContrat.AUTRE],
]);

const MODES_EPARGNE = tableDe<ModeEpargne>([
  ['Tontine', ModeEpargne.TONTINE],
  ['Mobile money', ModeEpargne.MOBILE_MONEY],
  ['Mobile Money', ModeEpargne.MOBILE_MONEY],
  ['Orange Money', ModeEpargne.MOBILE_MONEY],
  ['Wave', ModeEpargne.MOBILE_MONEY],
  ['Banque', ModeEpargne.BANQUE],
  ['Aucun', ModeEpargne.AUCUN],
]);

/** `null` quand le libellé n'est pas reconnu ; `undefined` quand la cellule est vide. */
export function readTypeContrat(raw: string): TypeContrat | null | undefined {
  const key = normalizeKey(raw);
  return key === '' ? undefined : (TYPES_CONTRAT.get(key) ?? null);
}

export function readModeEpargne(raw: string): ModeEpargne | null | undefined {
  const key = normalizeKey(raw);
  return key === '' ? undefined : (MODES_EPARGNE.get(key) ?? null);
}

/**
 * Deux colonnes obligatoires, dix-sept facultatives.
 *
 * Une cellule vide n'est pas une faute : c'est une information qu'on n'a pas
 * encore. Exiger la banque ferait refuser la moitié d'un fichier de campagne.
 *
 * Les colonnes de situation sont AJOUTÉES EN FIN : un classeur déjà rempli sans
 * elles se relit à l'identique, leurs cellules se lisant vides.
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
  {
    header: H.employeur,
    width: 28,
    required: false,
    aliases: ['Ministère', 'Entreprise', 'Employeur / Entreprise'],
    help: 'Facultatif. Repris de la liste déroulante, il rattache la fiche au référentiel ; sinon la valeur est conservée telle quelle, en clair.',
    sample: 'Ministère de l’Éducation nationale',
  },
  {
    header: H.typeContrat,
    width: 18,
    required: false,
    aliases: ['Contrat'],
    help: `Facultatif. ${TYPE_CONTRAT_CHOICES.join(', ')}, ou cellule vide.`,
    sample: 'CDI',
  },
  {
    header: H.anciennete,
    width: 18,
    required: false,
    aliases: ['Ancienneté', 'Ancienneté chez l’employeur'],
    help: `Facultative. Ancienneté chez l’employeur, en MOIS, de 0 à ${String(ANCIENNETE_MAX_MOIS)}. À ne pas confondre avec « ${H.dureeSysteme} », qui est la durée du plan de paiement.`,
    sample: '36',
  },
  {
    header: H.lieuActivite,
    width: 26,
    required: false,
    aliases: ['Lieu de travail', 'Marché'],
    help: 'Facultatif. Pour l’informel : marché, quartier ou lieu où il exerce.',
    sample: 'Marché Sandaga',
  },
  {
    header: H.modeEpargne,
    width: 20,
    required: false,
    aliases: ['Épargne'],
    help: `Facultatif. ${MODE_EPARGNE_CHOICES.join(', ')}, ou cellule vide.`,
    sample: 'Tontine',
  },
  {
    header: H.paysResidence,
    width: 24,
    required: false,
    aliases: ['Pays', 'Résidence'],
    help: 'Facultatif. Nom du pays en français ou code ISO à deux lettres (IT, FR…). Un pays hors référentiel refuse la ligne : il ne se crée pas à l’import.',
    sample: 'Italie',
  },
  {
    header: H.villeResidence,
    width: 22,
    required: false,
    aliases: ['Ville'],
    help: 'Facultative. Ville de résidence, pour la diaspora.',
    sample: 'Milan',
  },
  {
    header: H.whatsapp,
    width: 22,
    required: false,
    aliases: ['Numéro WhatsApp', 'WhatsApp (international)'],
    help: 'Facultatif. Souvent INTERNATIONAL et distinct du numéro principal : écrivez-le avec son indicatif, « +39 320 111 22 33 ». Sans indicatif, il est lu comme sénégalais.',
    sample: '+39 320 111 22 33',
  },
  {
    header: H.relaisNom,
    width: 24,
    required: false,
    aliases: ['Relais', 'Personne relais'],
    help: 'Facultatif. Personne à contacter au Sénégal pour un prospect de la diaspora.',
    sample: 'Awa Diop',
  },
  {
    header: H.relaisPhone,
    width: 22,
    required: false,
    aliases: ['Téléphone relais', 'Contact du relais'],
    help: 'Facultatif. Numéro sénégalais du relais, lu comme la colonne Téléphone.',
    sample: '77 000 00 11',
  },
];
