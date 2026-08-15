import { ApiError } from '@crm/api-client/query';
import { toast } from 'sonner';

import { ApiConfigurationError, configErrorMessage } from '@/lib/api/config';

/**
 * Message d'erreur ACTIONNABLE pour une mutation.
 *
 * « Erreur » tout court ne dit ni ce qui a échoué, ni quoi faire ensuite :
 * l'utilisateur reclique, échoue à nouveau, et finit par appeler le support.
 * On traduit donc les statuts que l'API émet réellement en une phrase qui
 * indique la suite.
 *
 * `ApiError` porte `.status` et le corps parsé (`.body`) : c'est précisément ce
 * que `unwrap()` préserve, et la raison pour laquelle rien ne doit court-circuiter
 * ce passage.
 */
/**
 * Le message que le SERVEUR a réellement écrit, ou la chaîne vide.
 *
 * `ApiError` ne laisse jamais `message` vide : faute de corps, son constructeur
 * pose `Request failed with status 403`. Cette phrase-là est du vocabulaire de
 * journal, en anglais, et elle ne doit JAMAIS atteindre l'écran : on la traite
 * donc comme une absence, au même titre qu'une chaîne vide.
 */
function serverReason(error: ApiError): string {
  const message = error.message.trim();
  if (message === '') return '';
  return /^Request failed with status \d+$/u.test(message) ? '' : message;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE MODE DÉMONSTRATION : DEUX refus TRANSVERSES, traités une fois pour toutes.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'API refuse une requête POST, PATCH, PUT ou DELETE par un 409 dans deux cas
 * qui ne dépendent d'AUCUNE opération en particulier :
 *
 *  - `DEMO_MODE_READ_ONLY` tant que le mode démonstration est actif ;
 *  - `DEMO_MODE_STATE_UNKNOWN` quand le serveur n'arrive pas à lire l'état de ce
 *    mode, et refuse d'écrire une ligne dont il ne saurait pas dire si elle est
 *    réelle.
 *
 * Tous deux décrivent l'état de la plateforme, et peuvent donc revenir de
 * n'importe lequel des trente écrans qui mutent quelque chose. Les brancher
 * écran par écran serait une trentaine d'occasions d'oublier, et l'oubli ne se
 * verrait qu'en démonstration ou pendant une panne de base.
 *
 * On branche donc sur le CODE, ici, au seul endroit que traversent toutes les
 * mutations. Sur le code et non sur le statut : `ApiErrorDto.code` est la clé
 * stable du contrat, alors que 409 sert aussi aux conflits d'unicité ordinaires.
 *
 * Le `message` du serveur est rendu TEL QUEL : il est rédigé pour l'écran, il
 * nomme la cause et le geste à faire, et le réécrire ici ferait diverger deux
 * formulations de la même règle.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Les DEUX codes se traitent ensemble, mais ne DISENT PAS la même chose.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ils partagent le traitement de forme (durée de lecture, dédoublonnage), parce
 * que ce traitement découle de leur caractère transverse, qu'ils ont en commun.
 * Ils ne partagent PAS leur prose : `DEMO_MODE_STATE_UNKNOWN` n'annonce aucune
 * démonstration en cours, il invite à réessayer. Lui faire dire « demandez à un
 * administrateur de désactiver le mode démonstration » enverrait éteindre un
 * interrupteur qui n'est peut-être pas allumé, pendant que la vraie cause est
 * une base en difficulté.
 */
export const DEMO_MODE_READ_ONLY = 'DEMO_MODE_READ_ONLY';

export const DEMO_MODE_STATE_UNKNOWN = 'DEMO_MODE_STATE_UNKNOWN';

/**
 * Phrases de secours quand le corps porte le CODE mais pas de prose.
 *
 * Le contrat garantit un `message` non vide, mais c'est une garantie du
 * serveur, pas une propriété du réseau : un relais qui tronque, un corps mal
 * formé, et le repli redevient la seule chose lisible. Sans lui, un tel corps
 * retomberait sur la branche 409 générique, c'est-à-dire sur « Un
 * enregistrement existe déjà avec ces valeurs » : un mensonge, qui envoie
 * l'utilisateur chercher un doublon inexistant.
 */
const DEMO_FALLBACKS: Record<string, string> = {
  [DEMO_MODE_READ_ONLY]:
    'La plateforme est en mode démonstration : les écritures sont suspendues. ' +
    'Demandez à un administrateur de désactiver le mode démonstration.',
  [DEMO_MODE_STATE_UNKNOWN]:
    'Impossible de lire l’état du mode démonstration : l’écriture est refusée pour ne pas ' +
    'enregistrer une ligne dont on ne saurait pas dire si elle est réelle. Réessayez.',
};

/** Code machinable porté par le corps d'erreur, ou `null`. */
function errorCode(error: ApiError): string | null {
  const body: unknown = error.body;
  if (typeof body !== 'object' || body === null) return null;
  const { code } = body as { code?: unknown };
  return typeof code === 'string' && code !== '' ? code : null;
}

/**
 * Le refus transverse porté par cette erreur, ou `null` si elle est autre chose.
 *
 * Rend le CODE en plus du message : c'est lui qui sert d'identifiant de toast,
 * et deux refus de nature différente ne doivent pas se remplacer l'un l'autre.
 */
function demoRefusal(error: unknown): { code: string; message: string } | null {
  if (!(error instanceof ApiError)) return null;
  const code = errorCode(error);
  if (code === null) return null;
  const fallback = DEMO_FALLBACKS[code];
  if (fallback === undefined) return null;
  const reason = serverReason(error);
  return { code, message: reason === '' ? fallback : reason };
}

/**
 * Le message du refus de LECTURE SEULE, ou `null` pour toute autre erreur.
 *
 * Exportée pour qu'un écran qui aurait besoin de RÉAGIR au refus (et pas
 * seulement de l'annoncer) puisse le reconnaître sans réimplémenter la lecture
 * du corps.
 *
 * Volontairement ÉTROITE : elle ne reconnaît PAS `DEMO_MODE_STATE_UNKNOWN`. Un
 * écran qui réagit à ce prédicat en conclut « une démonstration est en cours »,
 * et c'est précisément ce que l'état inconnu ne permet pas d'affirmer. Élargir
 * cette fonction ferait afficher un bandeau de démonstration pendant une panne
 * de base.
 */
export function demoReadOnlyMessage(error: unknown): string | null {
  const refusal = demoRefusal(error);
  return refusal !== null && refusal.code === DEMO_MODE_READ_ONLY ? refusal.message : null;
}

/**
 * Durée d'affichage d'un refus transverse.
 *
 * Sonner retire un toast au bout de quatre secondes. Les deux messages font
 * deux à trois phrases : ils expliqueraient quoi faire, mais ils disparaissent
 * avant d'avoir été lus, et l'utilisateur ne retient que « ça a échoué ». Les
 * autres messages gardent le défaut : ils tiennent en une ligne.
 */
const DEMO_MODE_TOAST_MS = 12_000;

export function apiErrorText(error: unknown, fallback: string): string {
  // Une CONFIGURATION incomplète n'est pas une coupure réseau. Elle nomme donc
  // la variable manquante : « Vérifiez la connexion » enverrait chercher un
  // câble là où il manque une variable d'environnement.
  if (error instanceof ApiConfigurationError) return error.message;

  if (!(error instanceof ApiError)) {
    return 'Serveur injoignable. Vérifiez la connexion, puis réessayez.';
  }

  // Le 500 du relais porte le message de configuration dans son corps : il
  // traverse le réseau, et c'est le seul lien entre la cause serveur et l'écran.
  const configuration = configErrorMessage(error.body);
  if (configuration !== null) return configuration;

  // AVANT le `switch` : les refus transverses se reconnaissent à leur code, et
  // la branche 409 générique les confondrait avec un conflit d'unicité.
  const refusal = demoRefusal(error);
  if (refusal !== null) return refusal.message;

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * La RAISON du serveur passe avant la phrase générique.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Les statuts 401, 403 et 404 rendaient une chaîne fixe et JETAIENT
   * `error.message`, alors que 400, 409 et 422 le laissaient passer. Deux
   * politiques opposées dans le même `switch`, et c'est la mauvaise qui gagnait
   * là où le serveur en dit le plus :
   *
   *  - un 403 de l'API dit « Ce dossier appartient à une autre banque » ou
   *    « La campagne est clôturée » ; l'écran affichait « Cette action est
   *    réservée à un administrateur », c'est-à-dire une explication FAUSSE, qui
   *    envoie l'utilisateur demander des droits dont il dispose déjà ;
   *  - un 404 sur une suppression concurrente dit « Ce représentant a déjà été
   *    supprimé » ; l'écran répondait « Rafraîchissez la liste », geste que
   *    l'utilisateur fait avant de rappeler le support.
   *
   * Le repli reste indispensable : `ApiError.message` vaut la chaîne vide quand
   * l'API n'envoie pas de corps (proxy, 502 nu, timeout). C'est le seul cas où
   * la phrase générique doit parler.
   */
  const reason = serverReason(error);

  switch (error.status) {
    case 400:
    case 422:
      // Le corps de class-validator liste les champs fautifs ; `ApiError`
      // aplatit déjà ce tableau en une phrase.
      return reason === '' ? fallback : reason;
    case 401:
      // Seule exception à la règle : la session expirée. Le message du serveur
      // (« Unauthorized », « jwt expired ») est du vocabulaire de journal, et
      // il ne dit pas le geste à faire.
      return 'Session expirée. Rechargez la page.';
    case 403:
      return reason === '' ? 'Cette action est réservée à un autre rôle.' : reason;
    case 404:
      return reason === '' ? 'Élément introuvable. Rafraîchissez la liste.' : reason;
    case 409:
      return reason === '' ? 'Un enregistrement existe déjà avec ces valeurs.' : reason;
    case 429:
      return 'Trop de requêtes. Patientez quelques secondes.';
    default:
      if (error.status >= 500) return `Erreur serveur (${String(error.status)}). Réessayez.`;
      return reason === '' ? fallback : reason;
  }
}

/** Raccourci : `onError: (error) => { toastApiError(error, '…'); }`. */
export function toastApiError(error: unknown, fallback: string): void {
  /**
   * Un refus transverse reçoit un IDENTIFIANT STABLE, et c'est le point.
   *
   * Il ne frappe pas une mutation, il frappe la plateforme : une vue qui en
   * lance plusieurs (une réaffectation en lot, un écran à mise à jour
   * optimiste) prend donc autant de refus identiques que d'appels partis, et
   * empile trois fois le même pavé de plusieurs phrases dans le coin de
   * l'écran. Sonner remplace un toast qui porte un identifiant déjà affiché :
   * il n'en reste qu'un, celui qui décrit l'état réel.
   *
   * L'identifiant est le CODE, et non une constante unique : les deux refus
   * décrivent des états différents, et si les deux survenaient (une bascule
   * pendant une panne de base), le second doit remplacer le premier plutôt que
   * de s'y ajouter, mais un troisième message de même code ne doit pas effacer
   * un refus de nature distincte.
   */
  const refusal = demoRefusal(error);
  if (refusal !== null) {
    toast.error(refusal.message, { id: refusal.code, duration: DEMO_MODE_TOAST_MS });
    return;
  }

  toast.error(apiErrorText(error, fallback));
}
