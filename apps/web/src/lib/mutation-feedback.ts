import { ApiError } from '@crm/api-client/query';
import { toast } from 'sonner';

import { ApiConfigurationError, configErrorMessage } from '@/lib/api/config';

function serverReason(error: ApiError): string {
  const message = error.message.trim();
  if (message === '') return '';
  return /^Request failed with status \d+$/u.test(message) ? '' : message;
}

export function apiErrorText(error: unknown, fallback: string): string {
  if (error instanceof ApiConfigurationError) return error.message;

  if (!(error instanceof ApiError)) {
    return 'Serveur injoignable. Vérifiez la connexion, puis réessayez.';
  }

  const configuration = configErrorMessage(error.body);
  if (configuration !== null) return configuration;

  const reason = serverReason(error);

  switch (error.status) {
    case 400:
    case 422:
      return reason === '' ? fallback : reason;
    case 401:
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

export function toastApiError(error: unknown, fallback: string): void {
  toast.error(apiErrorText(error, fallback));
}
