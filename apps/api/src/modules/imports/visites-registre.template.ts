import type { ImportColumn } from './import-adapter.js';
import type { SheetLayout } from './import-adapter.js';

/**
 * Les onze colonnes de l'aller-retour Excel du registre, dans l'orthographe du
 * PRODUIT : c'est l'export qui écrit `OBJET VISITE`, l'accueil qui écrit
 * `OBJECT VISITE` sur le classeur historique. Les deux se lisent, en alias.
 *
 * Partagées entre `visites-export.service.ts`, qui les écrit, et
 * `visites-registre.adapter.ts`, qui les relit : une seule feuille, un seul
 * en-tête, à la ligne 1.
 */
export const VISITES_REGISTRE_SHEET = 'Registre';

export const VISITES_REGISTRE_HEADERS = {
  numero: 'N° REGISTRE',
  date: 'DATE VISITE',
  heure: 'HEURE VISITE',
  nom: 'PRENOM ET NOMS',
  telephone: 'TELEPHONES',
  entreprise: 'ENTREPRISE',
  direction: 'DIRECTION',
  destinataire: 'DESTINATAIRES',
  objet: 'OBJET VISITE',
  commentaire: 'COMMENTAIRES / NOTES',
  saisieLe: 'SAISIE LE',
} as const;

const H = VISITES_REGISTRE_HEADERS;

export const VISITES_REGISTRE_LAYOUT: SheetLayout = {
  sheetPattern: /^Registre/i,
  headerRow: 1,
};

/**
 * `N° REGISTRE` VIDE : la ligne est une création. RENSEIGNÉ ET INCONNU : la
 * ligne est refusée, jamais repliée sur une création — une coquille sur un
 * numéro produirait une visite fantôme que personne ne cherchait.
 */
export const VISITES_REGISTRE_COLUMNS: readonly ImportColumn[] = [
  {
    header: H.numero,
    width: 16,
    required: false,
    help: 'Le « N° » du registre. Vide : la ligne est une création. Renseigné : elle corrige la visite désignée.',
    sample: 'V-2026-000412',
  },
  {
    header: H.date,
    width: 14,
    required: true,
    help: 'Date de la visite. Une vraie date Excel, pas du texte.',
    sample: '06/01/2026',
  },
  {
    header: H.heure,
    width: 12,
    required: false,
    help: 'Heure d’arrivée, au format 14:30. Vide si elle n’a pas été relevée.',
    sample: '14:30',
  },
  {
    header: H.nom,
    width: 32,
    required: true,
    help: 'Le visiteur, tel qu’il s’est présenté.',
    sample: 'MOUHAMED FALL',
  },
  {
    header: H.telephone,
    width: 18,
    required: false,
    help: 'Facultatif. Le numéro est gardé tel quel, et normalisé quand c’est possible.',
    sample: '78 454 44 66',
  },
  {
    header: H.entreprise,
    width: 20,
    required: true,
    help: 'Une entrée de la liste déroulante ENTREPRISES.',
    sample: 'CPI',
  },
  {
    header: H.direction,
    width: 26,
    required: false,
    help: 'Facultatif. Une entrée de la liste DIRECTIONS &/OU NIVEAU.',
    sample: 'COMMERCIALE',
  },
  {
    header: H.destinataire,
    width: 34,
    required: false,
    help: 'Facultatif. Une entrée de la liste DESTINATAIRES.',
    sample: 'MME. NDOYE (RESP. COMM.)',
  },
  {
    header: H.objet,
    width: 30,
    required: true,
    help: 'Une entrée de la liste OBJET VISITE.',
    sample: 'SUIVI DE DOSSIER',
    aliases: ['OBJECT VISITE'],
  },
  {
    header: H.commentaire,
    width: 48,
    required: false,
    help: 'Facultatif. Ce que l’accueil a noté.',
    sample: 'Reçu par MME NDOYE',
  },
  {
    header: H.saisieLe,
    width: 20,
    required: false,
    help: 'Colonne d’information : jamais relue à l’import.',
    sample: '06/01/2026 09:12',
  },
];
