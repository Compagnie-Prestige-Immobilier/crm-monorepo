import { Role } from '@crm/database';

/**
 * EB-29 : les reglages metier de CHUES, leur valeur d'usine et qui les change.
 *
 * Un seul endroit les nomme. Le formulaire de conversion, le formulaire public
 * et les messages envoyes les lisent, ils ne les redisent pas.
 */
export interface ParametresChues {
  plateformeChuesUrl: string;
  plateformeGrandPublicUrl: string;
  emailChues: string;
  whatsappChuesE164: string;
  messageWhatsapp: string;
  accuseReceptionObjet: string;
  accuseReceptionCorps: string;
  destinatairesEnrolement: string[];
  destinatairesBpe: string[];
  destinatairesSupervision: string[];
  destinatairesDirection: string[];
}

export type CleParametre = keyof ParametresChues;

/**
 * Les deux textes que la supervision et la direction ecrivent aussi. Tout le
 * reste engage l'entreprise au dela d'un message : un lien ou une adresse
 * faux detournent des inscriptions, et la liste des destinataires decide qui
 * lit les demandes.
 */
const TEXTES_PARTAGES: readonly CleParametre[] = [
  'messageWhatsapp',
  'accuseReceptionObjet',
  'accuseReceptionCorps',
];

export function peutEcrire(role: Role, cle: CleParametre): boolean {
  if (role === Role.ADMIN) return true;
  if (role !== Role.SUPERVISEUR && role !== Role.DIRECTION) return false;
  return TEXTES_PARTAGES.includes(cle);
}

/**
 * Les valeurs d'usine. Les deux textes viennent mot pour mot de l'expression
 * de besoins ; les liens, l'adresse et le numero naissent VIDES : inventer une
 * URL enverrait les prospects nulle part sans que personne ne s'en apercoive.
 */
export const PARAMETRES_USINE: ParametresChues = {
  plateformeChuesUrl: '',
  plateformeGrandPublicUrl: '',
  emailChues: '',
  whatsappChuesE164: '',
  messageWhatsapp:
    'Bonjour {prenom}, suite à notre échange, voici le lien pour compléter votre demande ' +
    'd’adhésion CPI CHUES : {lien}. Je reste joignable au {telephoneTeleconseiller}. ' +
    '{teleconseiller}, CPI.',
  accuseReceptionObjet: 'Votre demande CPI CHUES a bien été reçue',
  accuseReceptionCorps:
    'Bonjour {prenomNom}, nous avons bien reçu votre demande du {date}. ' +
    'Récapitulatif : {informations}. Un chargé de clientèle CPI vous contactera au {telephone}. ' +
    'Pour toute question : {emailChues} ou {whatsappChues}. CPI.',
  destinatairesEnrolement: [],
  destinatairesBpe: [],
  destinatairesSupervision: [],
  destinatairesDirection: [],
};

export const CLES = Object.keys(PARAMETRES_USINE) as CleParametre[];

const LISTES: readonly CleParametre[] = [
  'destinatairesEnrolement',
  'destinatairesBpe',
  'destinatairesSupervision',
  'destinatairesDirection',
];

const estUneListe = (cle: CleParametre): boolean => LISTES.includes(cle);

/** `AppSetting` est partagee : le prefixe evite qu'un reglage CHUES en ecrase un autre. */
export const cleStockee = (cle: CleParametre): string => `chues.${cle}`;

/**
 * Une liste voyage en JSON dans la colonne `value`, comme la disposition du
 * tableau de bord. Une valeur illisible retombe sur l'usine plutot que de faire
 * echouer l'ecran entier.
 */
export function lireValeur(cle: CleParametre, brut: string): string | string[] {
  if (!estUneListe(cle)) return brut;
  try {
    const lu: unknown = JSON.parse(brut);
    if (!Array.isArray(lu)) return [];
    return lu.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

export const ecrireValeur = (valeur: string | string[]): string =>
  Array.isArray(valeur) ? JSON.stringify(valeur) : valeur;
