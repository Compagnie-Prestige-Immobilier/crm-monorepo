import createClient from 'openapi-fetch';

import type { paths } from '@/api/schema';
import { apiErrorMessage } from '@/lib/utils';

export const apiClient = createClient<paths>({
  baseUrl: '',
  credentials: 'same-origin',
});

/** Refus de l'API : le corps est un `application/problem+json` (RFC 9457). */
export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

/** Le résultat d'`openapi-fetch`, ramené à sa donnée ou à une `ApiError`. */
export function unwrap<T>(result: {
  data?: T | undefined;
  error?: unknown;
  response: Response;
}): T {
  // Un 204 n'a pas de corps : seule une réponse en échec est une erreur.
  if (result.data === undefined && !result.response.ok) {
    const message = apiErrorMessage(result.error, 'Requête refusée par le serveur.');
    throw new ApiError(result.response.status, result.error, message);
  }
  return result.data as T;
}
