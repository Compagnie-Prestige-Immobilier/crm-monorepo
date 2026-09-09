import { toast } from 'sonner';

import { ApiError } from '@/api/client';
import { apiErrorMessage } from '@/lib/utils';

/** Statuts dont le message du serveur n'apporte rien à qui lit l'écran. */
const MESSAGE_IMPOSE: Readonly<Record<number, string>> = {
  401: 'Session expirée. Rechargez la page.',
  403: 'Cette action est réservée à un autre rôle.',
  429: 'Trop de requêtes. Patientez quelques secondes.',
};

export function apiErrorText(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return 'Serveur injoignable. Vérifiez la connexion, puis réessayez.';
  }
  const impose = MESSAGE_IMPOSE[error.status];
  if (impose !== undefined) return impose;
  if (error.status >= 500) return `Erreur serveur (${String(error.status)}). Réessayez.`;
  return apiErrorMessage(error.payload, fallback);
}

export function toastApiError(error: unknown, fallback: string): void {
  toast.error(apiErrorText(error, fallback));
}

function lireChaine(source: Record<string, unknown>, cle: string): string | null {
  const valeur = source[cle];
  return typeof valeur === 'string' && valeur !== '' ? valeur : null;
}

export function apiErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const payload = error.payload;
  if (typeof payload !== 'object' || payload === null) return null;
  return lireChaine(payload as Record<string, unknown>, 'code');
}

/**
 * `errors[].location` vaut `body.username` : la clé rendue est le nom du champ
 * tel que le formulaire le connaît.
 */
export function champsRefuses(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const payload = error.payload;
  if (typeof payload !== 'object' || payload === null) return {};
  const liste = (payload as { errors?: unknown }).errors;
  if (!Array.isArray(liste)) return {};

  const champs: Record<string, string> = {};
  for (const entree of liste) {
    if (typeof entree !== 'object' || entree === null) continue;
    const detail = entree as Record<string, unknown>;
    const location = lireChaine(detail, 'location');
    const message = lireChaine(detail, 'message');
    if (location === null || message === null) continue;
    champs[location.replace(/^body\./u, '')] = message;
  }
  return champs;
}
