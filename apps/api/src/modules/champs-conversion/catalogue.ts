import { Projet } from '@crm/database';

import type { CallAttemptOpDto } from '../phase2/dto.js';

/**
 * Ce que la tentative d'appel porte SANS être un champ du formulaire de
 * conversion. Le retrait est fait par soustraction et non par recopie : un
 * champ ajouté à `CallAttemptOpDto` sans être nommé ici casse la compilation de
 * `CATALOGUE`, qui doit alors lui donner un libellé et des valeurs par défaut.
 */
type HorsFormulaire =
  | 'id'
  | 'prospectId'
  | 'projet'
  | 'outcome'
  | 'reasonCode'
  | 'comment'
  | 'clientCreatedAt'
  | 'callbackAt'
  | 'deviceCallType'
  | 'deviceCallDurationSeconds'
  | 'deviceCallAt'
  | 'champsLibres';

/** `phoneE164` s'ajoute à la main : affiché en lecture seule, il ne voyage pas. */
export type ChampConversion = Exclude<keyof CallAttemptOpDto, HorsFormulaire> | 'phoneE164';

export interface ChampMeta {
  readonly label: string;
  readonly visible: readonly Projet[];
  readonly obligatoire: readonly Projet[];
}

const CHUES = Projet.CHUES;
const GP = Projet.GRAND_PUBLIC;
const LES_DEUX = [CHUES, GP] as const;

/** L'ordre de déclaration EST l'ordre d'affichage sans réglage, et les défauts avec. */
export const CATALOGUE = {
  nom: { label: 'Nom', visible: LES_DEUX, obligatoire: LES_DEUX },
  prenom: { label: 'Prénom', visible: LES_DEUX, obligatoire: [CHUES] },
  phoneE164: { label: 'Téléphone', visible: LES_DEUX, obligatoire: [] },
  email: { label: 'E-mail', visible: LES_DEUX, obligatoire: [] },
  profession: { label: 'Profession', visible: LES_DEUX, obligatoire: [CHUES] },
  dureeEtablissementMois: {
    label: 'Durée dans l’établissement (mois)',
    visible: LES_DEUX,
    obligatoire: [CHUES],
  },
  fonctionnaire: { label: 'Fonctionnaire', visible: LES_DEUX, obligatoire: [CHUES] },
  type: { label: 'Situation', visible: [GP], obligatoire: [] },
  syndicatId: { label: 'Syndicat', visible: LES_DEUX, obligatoire: [CHUES] },
  banqueId: { label: 'Banque', visible: LES_DEUX, obligatoire: [CHUES] },
  engagementEnCours: {
    label: 'Engagement en cours à la banque',
    visible: LES_DEUX,
    obligatoire: [CHUES],
  },
  incomeBandId: { label: 'Revenu mensuel', visible: LES_DEUX, obligatoire: [CHUES] },
  paymentMode: { label: 'Paiement', visible: [GP], obligatoire: [] },
  etablissement: { label: 'Établissement', visible: LES_DEUX, obligatoire: [] },
  // EB-22 : la duree du systeme de paiement quitte le formulaire CHUES, la
  // colonne reste pour le Grand Public qui s'en sert.
  dureeSystemeMois: {
    label: 'Durée du système de paiement',
    visible: [GP],
    obligatoire: [],
  },
  // EB-23 : le statut porte la question, le numero n'apparait que sur « non ».
  whatsappStatus: { label: 'Numéro WhatsApp', visible: LES_DEUX, obligatoire: [] },
  whatsappE164: { label: 'Autre numéro WhatsApp', visible: LES_DEUX, obligatoire: [] },
  method: { label: 'Méthode d’enrôlement', visible: LES_DEUX, obligatoire: LES_DEUX },
  rendezVousAt: { label: 'Date du rendez-vous', visible: LES_DEUX, obligatoire: LES_DEUX },
} as const satisfies Readonly<Record<ChampConversion, ChampMeta>>;

const ORDRE_CATALOGUE = Object.keys(CATALOGUE) as readonly ChampConversion[];

/** Ce dont dépendent les indicateurs et le closing : `fusionner` les rend visibles quoi qu'il arrive. */
const CHAMPS_IMPOSES = [
  'nom',
  'prenom',
  'phoneE164',
  'incomeBandId',
  'method',
] as const satisfies readonly ChampConversion[];

const IMPOSES = new Set<string>(CHAMPS_IMPOSES);

export const estChampConversion = (valeur: string): valeur is ChampConversion =>
  Object.hasOwn(CATALOGUE, valeur);

export const estChampImpose = (champ: ChampConversion): boolean => IMPOSES.has(champ);

export interface ReglageChamp {
  readonly champ: ChampConversion;
  readonly libelle: string;
  readonly visible: boolean;
  readonly obligatoire: boolean;
  readonly impose: boolean;
}

export const TYPES_CHAMP_LIBRE = ['TEXTE', 'LISTE', 'OUI_NON'] as const;
export type TypeChampLibre = (typeof TYPES_CHAMP_LIBRE)[number];

export interface ChampLibre {
  readonly id: string;
  readonly libelle: string;
  readonly type: TypeChampLibre;
  readonly options: readonly string[];
  readonly obligatoire: boolean;
}

export const CHAMPS_LIBRES_MAX = 20;
export const REPONSE_MAX_LENGTH = 500;

export type ReponsesChampsLibres = Record<string, string>;

/**
 * Une clé qu'aucun champ ne définit plus reste inerte : la fiche et le classeur
 * se lisent par les définitions, jamais par les clés stockées.
 */
export function normaliserReponses(brut: unknown): ReponsesChampsLibres | null {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return null;

  const reponses: ReponsesChampsLibres = {};
  for (const [id, valeur] of Object.entries(brut).slice(0, CHAMPS_LIBRES_MAX)) {
    if (id.length > 60 || typeof valeur !== 'string') continue;
    const texte = valeur.trim().slice(0, REPONSE_MAX_LENGTH);
    if (texte !== '') reponses[id] = texte;
  }
  return reponses;
}

export interface ReglagesConversion {
  readonly champs: readonly ReglageChamp[];
  readonly libres: readonly ChampLibre[];
}

interface ReglageStocke {
  readonly champ: string;
  readonly visible: boolean;
  readonly obligatoire: boolean;
}

function parDefaut(champ: ChampConversion, projet: Projet): ReglageChamp {
  const meta: ChampMeta = CATALOGUE[champ];
  return {
    champ,
    libelle: meta.label,
    visible: meta.visible.includes(projet),
    obligatoire: meta.obligatoire.includes(projet),
    impose: IMPOSES.has(champ),
  };
}

/** L'ordre stocké d'abord, les champs qu'il ignore encore à la suite. */
export function fusionner(
  projet: Projet,
  stockes: readonly ReglageStocke[],
  libres: readonly ChampLibre[],
): ReglagesConversion {
  const vus = new Set<ChampConversion>();
  const champs: ReglageChamp[] = [];

  for (const stocke of stockes) {
    if (!estChampConversion(stocke.champ)) continue;
    if (vus.has(stocke.champ)) continue;
    vus.add(stocke.champ);
    const defaut = parDefaut(stocke.champ, projet);
    champs.push({
      ...defaut,
      visible: defaut.impose || stocke.visible,
      obligatoire: stocke.obligatoire,
    });
  }

  for (const champ of ORDRE_CATALOGUE) {
    if (!vus.has(champ)) champs.push(parDefaut(champ, projet));
  }

  return { champs, libres };
}
