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
 * `ApiError` porte `.status` et le corps parsé (`.body`) — c'est précisément ce
 * que `unwrap()` préserve, et la raison pour laquelle rien ne doit court-circuiter
 * ce passage.
 */
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

  switch (error.status) {
    case 400:
    case 422:
      // Le corps de class-validator liste les champs fautifs ; `ApiError`
      // aplatit déjà ce tableau en une phrase.
      return error.message;
    case 401:
      return 'Session expirée. Rechargez la page.';
    case 403:
      return 'Cette action est réservée à un administrateur.';
    case 404:
      return 'Élément introuvable. Rafraîchissez la liste.';
    case 409:
      return error.message === ''
        ? 'Un enregistrement existe déjà avec ces valeurs.'
        : error.message;
    case 429:
      return 'Trop de requêtes. Patientez quelques secondes.';
    default:
      return error.status >= 500
        ? `Erreur serveur (${String(error.status)}). Réessayez.`
        : fallback;
  }
}

/** Raccourci : `onError: (error) => { toastApiError(error, '…'); }`. */
export function toastApiError(error: unknown, fallback: string): void {
  toast.error(apiErrorText(error, fallback));
}
