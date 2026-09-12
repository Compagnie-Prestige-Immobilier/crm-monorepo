import { ApiError } from '@crm/api-client/query';
import { toast } from 'sonner';

import { ApiConfigurationError, configErrorMessage } from '@/lib/api/config';

function serverReason(error: ApiError): string {
  const message = error.message.trim();
  if (message === '') return '';
  return /^Request failed with status \d+$/u.test(message) ? '' : message;
}

/** Statuts dont le message du serveur n'apporte rien à qui lit l'écran. */
const MESSAGE_IMPOSE: Readonly<Record<number, string>> = {
  401: 'Session expirée. Rechargez la page.',
  429: 'Trop de requêtes. Patientez quelques secondes.',
};

/** Repli par statut quand le serveur n'a pas motivé son refus. */
const REPLI_PAR_STATUT: Readonly<Record<number, string>> = {
  403: 'Cette action est réservée à un autre rôle.',
  404: 'Élément introuvable. Rafraîchissez la liste.',
  409: 'Un enregistrement existe déjà avec ces valeurs.',
};

export function apiErrorText(error: unknown, fallback: string): string {
  if (error instanceof ApiConfigurationError) return error.message;

  if (!(error instanceof ApiError)) {
    return 'Serveur injoignable. Vérifiez la connexion, puis réessayez.';
  }

  const configuration = configErrorMessage(error.body);
  if (configuration !== null) return configuration;

  const impose = MESSAGE_IMPOSE[error.status];
  if (impose !== undefined) return impose;
  if (error.status >= 500) return `Erreur serveur (${String(error.status)}). Réessayez.`;

  const reason = serverReason(error);
  return reason === '' ? (REPLI_PAR_STATUT[error.status] ?? fallback) : reason;
}

/** Plus du double des 4 s d'un succès : une erreur se lit jusqu'au bout avant d'agir. */
const DUREE_ERREUR_MS = 10_000;

export function toastApiError(error: unknown, fallback: string): void {
  toast.error(apiErrorText(error, fallback), { duration: DUREE_ERREUR_MS });
}
