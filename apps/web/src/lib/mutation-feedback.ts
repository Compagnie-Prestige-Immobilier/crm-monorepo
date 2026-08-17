import { ApiError } from '@crm/api-client/query';
import { toast } from 'sonner';

import { ApiConfigurationError, configErrorMessage } from '@/lib/api/config';

function serverReason(error: ApiError): string {
  const message = error.message.trim();
  if (message === '') return '';
  return /^Request failed with status \d+$/u.test(message) ? '' : message;
}

export const DEMO_MODE_READ_ONLY = 'DEMO_MODE_READ_ONLY';

export const DEMO_MODE_STATE_UNKNOWN = 'DEMO_MODE_STATE_UNKNOWN';

const DEMO_FALLBACKS: Record<string, string> = {
  [DEMO_MODE_READ_ONLY]:
    'La plateforme est en mode démonstration : les écritures sont suspendues. ' +
    'Demandez à un administrateur de désactiver le mode démonstration.',
  [DEMO_MODE_STATE_UNKNOWN]:
    'Impossible de lire l’état du mode démonstration : l’écriture est refusée pour ne pas ' +
    'enregistrer une ligne dont on ne saurait pas dire si elle est réelle. Réessayez.',
};

function errorCode(error: ApiError): string | null {
  const body: unknown = error.body;
  if (typeof body !== 'object' || body === null) return null;
  const { code } = body as { code?: unknown };
  return typeof code === 'string' && code !== '' ? code : null;
}

function demoRefusal(error: unknown): { code: string; message: string } | null {
  if (!(error instanceof ApiError)) return null;
  const code = errorCode(error);
  if (code === null) return null;
  const fallback = DEMO_FALLBACKS[code];
  if (fallback === undefined) return null;
  const reason = serverReason(error);
  return { code, message: reason === '' ? fallback : reason };
}

export function demoReadOnlyMessage(error: unknown): string | null {
  const refusal = demoRefusal(error);
  return refusal !== null && refusal.code === DEMO_MODE_READ_ONLY ? refusal.message : null;
}

const DEMO_MODE_TOAST_MS = 12_000;

export function apiErrorText(error: unknown, fallback: string): string {
  if (error instanceof ApiConfigurationError) return error.message;

  if (!(error instanceof ApiError)) {
    return 'Serveur injoignable. Vérifiez la connexion, puis réessayez.';
  }

  const configuration = configErrorMessage(error.body);
  if (configuration !== null) return configuration;

  const refusal = demoRefusal(error);
  if (refusal !== null) return refusal.message;

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
  const refusal = demoRefusal(error);
  if (refusal !== null) {
    toast.error(refusal.message, { id: refusal.code, duration: DEMO_MODE_TOAST_MS });
    return;
  }

  toast.error(apiErrorText(error, fallback));
}
