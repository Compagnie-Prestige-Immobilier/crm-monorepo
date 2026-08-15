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
  toast.error(apiErrorText(error, fallback));
}
