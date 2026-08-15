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
 * LE MODE DÉMONSTRATION : un refus TRANSVERSE, traité une fois pour toutes.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tant que le mode démonstration est actif, l'API refuse TOUTE requête POST,
 * PATCH, PUT ou DELETE avec un 409 portant `code: 'DEMO_MODE_READ_ONLY'`. Ce
 * refus ne vient d'aucune opération en particulier : il décrit l'état de la
 * plateforme, et il peut donc revenir de n'importe lequel des trente écrans qui
 * mutent quelque chose. Le brancher écran par écran serait une trentaine
 * d'occasions d'oublier, et l'oubli ne se verrait qu'en démonstration.
 *
 * On branche donc sur le CODE, ici, au seul endroit que traversent toutes les
 * mutations. Sur le code et non sur le statut : `ApiErrorDto.code` est la clé
 * stable du contrat, alors que 409 sert aussi aux conflits d'unicité ordinaires.
 *
 * Le `message` du serveur est rendu TEL QUEL : il est rédigé pour l'écran, il
 * nomme la cause et le remède (« demandez à un administrateur de désactiver le
 * mode démonstration »), et le réécrire ici ferait diverger deux formulations
 * de la même règle.
 */
export const DEMO_MODE_READ_ONLY = 'DEMO_MODE_READ_ONLY';

/**
 * Phrase de secours quand le corps porte le CODE mais pas de prose.
 *
 * Elle n'est pas décorative. Sans elle, un tel corps retomberait sur la branche
 * 409 générique, c'est-à-dire sur « Un enregistrement existe déjà avec ces
 * valeurs » : un mensonge, qui envoie l'utilisateur chercher un doublon
 * inexistant pendant que la vraie cause est un interrupteur au bureau.
 */
const DEMO_MODE_READ_ONLY_FALLBACK =
  'La plateforme est en mode démonstration : les écritures sont suspendues. ' +
  'Demandez à un administrateur de désactiver le mode démonstration.';

/** Code machinable porté par le corps d'erreur, ou `null`. */
function errorCode(error: ApiError): string | null {
  const body: unknown = error.body;
  if (typeof body !== 'object' || body === null) return null;
  const { code } = body as { code?: unknown };
  return typeof code === 'string' && code !== '' ? code : null;
}

/**
 * Le message du refus de démonstration, ou `null` si l'erreur est autre chose.
 *
 * Exportée pour qu'un écran qui aurait besoin de RÉAGIR au refus (et pas
 * seulement de l'annoncer) puisse le reconnaître sans réimplémenter la lecture
 * du corps.
 */
export function demoReadOnlyMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (errorCode(error) !== DEMO_MODE_READ_ONLY) return null;
  const reason = serverReason(error);
  return reason === '' ? DEMO_MODE_READ_ONLY_FALLBACK : reason;
}

/**
 * Durée d'affichage du refus de démonstration.
 *
 * Sonner retire un toast au bout de quatre secondes. Le message du serveur fait
 * trois phrases : il expliquerait quoi faire, mais il disparaît avant d'avoir
 * été lu, et l'utilisateur ne retient que « ça a échoué ». Les autres messages
 * gardent le défaut : ils tiennent en une ligne.
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

  // AVANT le `switch` : le refus de démonstration se reconnaît à son code, et
  // la branche 409 générique le confondrait avec un conflit d'unicité.
  const demoReadOnly = demoReadOnlyMessage(error);
  if (demoReadOnly !== null) return demoReadOnly;

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
   * Le refus de démonstration reçoit un IDENTIFIANT STABLE, et c'est le point.
   *
   * Il ne frappe pas une mutation, il frappe la plateforme : une vue qui en
   * lance plusieurs (une réaffectation en lot, un écran à mise à jour
   * optimiste) prend donc autant de refus identiques que d'appels partis, et
   * empile trois fois le même pavé de trois phrases dans le coin de l'écran.
   * Sonner remplace un toast qui porte un identifiant déjà affiché : il n'en
   * reste qu'un, celui qui décrit l'état réel.
   */
  const demoReadOnly = demoReadOnlyMessage(error);
  if (demoReadOnly !== null) {
    toast.error(demoReadOnly, { id: DEMO_MODE_READ_ONLY, duration: DEMO_MODE_TOAST_MS });
    return;
  }

  toast.error(apiErrorText(error, fallback));
}
