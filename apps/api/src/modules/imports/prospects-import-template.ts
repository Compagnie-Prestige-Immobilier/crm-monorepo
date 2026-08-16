import { EnrollmentMethod } from '@crm/database';

import type { ImportColumn } from './import-adapter.js';

/**
 * Colonnes du modèle d'import prospects, définies UNE SEULE FOIS.
 *
 * Le générateur de classeur et l'analyseur de ligne lisent cette liste : c'est
 * ce qui garantit qu'un fichier téléchargé le matin est relu correctement
 * l'après-midi. Deux listes séparées finiraient par diverger d'une colonne, et
 * l'erreur ne se verrait qu'au moment où quelqu'un a déjà rempli cent mille
 * lignes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE NOM ET LE PRÉNOM SONT DEUX COLONNES, ET CE N'EST PAS NÉGOCIABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le modèle représentants n'a qu'une colonne « Nom complet », parce que le
 * modèle `Representant` ne porte qu'un `fullName`. `Prospect` porte `nom` et
 * `prenom` séparément, et découper une chaîne unique pour les remplir serait
 * une décision arbitraire prise cent cinquante mille fois : « Ndiaye Fatou
 * Bintou » se coupe autant en « Ndiaye » / « Fatou Bintou » qu'en « Ndiaye
 * Fatou » / « Bintou », et les deux sont plausibles au Sénégal, où le nom
 * précède souvent le prénom et où les prénoms composés sont ordinaires. Le
 * fichier tranche, jamais le serveur.
 */

/**
 * En-têtes, isolés des colonnes.
 *
 * `parseRow` reçoit les cellules INDEXÉES PAR EN-TÊTE : la chaîne écrite ici
 * est donc la clé de lecture autant que le libellé affiché. Les recopier à la
 * main dans l'analyseur ferait qu'un accent corrigé dans le modèle laisserait
 * l'analyseur lire une colonne vide, sur toutes les lignes, sans erreur.
 */
export const PROSPECT_IMPORT_HEADERS = {
  nom: 'Nom',
  prenom: 'Prénom',
  phone: 'Téléphone',
  representantPhone: 'Téléphone du représentant',
  banque: 'Banque',
  syndicat: 'Syndicat',
  enrollmentMethod: 'Méthode d’enrôlement',
} as const;

/**
 * Jetons admis dans la colonne « Méthode d'enrôlement ».
 *
 * Ce sont les valeurs de l'énumération PostgreSQL telles quelles, et non des
 * libellés français traduits : la colonne est facultative et rarement remplie,
 * elle sert aux reprises de données où la méthode est déjà connue. Un libellé
 * traduit ajouterait une table de correspondance à maintenir en double, et le
 * jour où l'énumération gagne une valeur, le classeur en refuserait une que la
 * base accepte.
 */
export const ENROLLMENT_METHOD_TOKENS: readonly EnrollmentMethod[] = [
  EnrollmentMethod.PLATFORM,
  EnrollmentMethod.PHYSICAL,
  EnrollmentMethod.VOICE_OR_ELECTRONIC_MESSAGING,
];

export const PROSPECTS_IMPORT_COLUMNS: readonly ImportColumn[] = [
  {
    header: PROSPECT_IMPORT_HEADERS.nom,
    width: 24,
    required: true,
    help: 'Nom de famille SEUL. Ne mettez pas le nom et le prénom dans la même cellule : le serveur ne les découpe pas.',
    sample: 'Ndiaye',
  },
  {
    header: PROSPECT_IMPORT_HEADERS.prenom,
    width: 24,
    required: true,
    help: 'Prénom SEUL, prénoms composés compris. Colonne distincte du nom, volontairement.',
    sample: 'Aminata',
  },
  {
    header: PROSPECT_IMPORT_HEADERS.phone,
    width: 20,
    required: true,
    help: 'Toutes les présentations sont admises : 77 123 45 67, +221 77 123 45 67, 00221771234567. Le serveur normalise. C’est ce numéro qui sert à repérer les doublons.',
    sample: '77 123 45 67',
  },
  {
    header: PROSPECT_IMPORT_HEADERS.representantPhone,
    width: 26,
    required: true,
    help: 'Numéro du représentant qui a apporté le prospect. Le représentant doit DÉJÀ exister : importez d’abord les représentants, ce fichier n’en crée aucun.',
    sample: '76 987 65 43',
  },
  {
    header: PROSPECT_IMPORT_HEADERS.banque,
    width: 18,
    required: true,
    help: 'Nom court de la banque, repris EXACTEMENT du référentiel (liste déroulante). Seuls la casse et les espaces autour sont tolérés.',
    sample: 'CBAO',
  },
  {
    header: PROSPECT_IMPORT_HEADERS.syndicat,
    width: 18,
    required: true,
    help: 'Sigle du syndicat, repris EXACTEMENT du référentiel (liste déroulante). Seuls la casse et les espaces autour sont tolérés.',
    sample: 'CHUES',
  },
  {
    header: PROSPECT_IMPORT_HEADERS.enrollmentMethod,
    width: 32,
    required: false,
    help: 'Facultative. À remplir uniquement si l’enrôlement a DÉJÀ eu lieu : PLATFORM, PHYSICAL ou VOICE_OR_ELECTRONIC_MESSAGING. Laissée vide, la fiche part en attente d’appel.',
    sample: 'PLATFORM',
  },
];

/** Nom de la feuille de saisie. Le lecteur prend la PREMIÈRE feuille, pas celle-ci par son nom. */
export const PROSPECTS_IMPORT_SHEET_NAME = 'Prospects';
