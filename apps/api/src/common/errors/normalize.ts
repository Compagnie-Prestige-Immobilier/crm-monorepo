import { HttpStatus } from '@nestjs/common';

/**
 * Normalisation des corps d'erreur vers la forme unique `ApiErrorDto`.
 *
 * Écrit ici, et non dans le filtre, pour être testable sans monter un contexte
 * HTTP : c'est une fonction pure, et c'est le genre de code dont chaque cas
 * limite compte.
 *
 * PRINCIPE : on n'efface jamais rien. Une exception métier qui portait déjà un
 * `code` le garde, et ses champs supplémentaires (le dossier en conflit, la
 * révision courante) survivent tels quels. On se contente d'AJOUTER ce qui
 * manquait, c'est à dire `statusCode` quand il était absent et `code` quand il
 * n'avait jamais été posé.
 */

/** Code générique déduit du statut, quand l'erreur n'en portait aucun. */
const GENERIC_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

export const genericCode = (status: number): string =>
  GENERIC_CODES[status] ?? (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED');

/** Message de repli, pour ne jamais publier une erreur sans phrase. */
const FALLBACK_MESSAGE = 'Une erreur est survenue.';

export interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: string[];
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Ramène le corps d'une exception HTTP à la forme canonique.
 *
 * `payload` est ce que rend `HttpException.getResponse()` : soit une chaîne
 * (Nest l'a construite depuis le statut), soit un objet posé par le service.
 *
 * Le cas qui motive tout : la `ValidationPipe` met un TABLEAU de phrases dans
 * `message`. Un client qui affiche `body.message` rendait alors
 * `[object Object]`, et un client qui le concaténait produisait une bouillie.
 * Le tableau part donc dans `details`, et `message` redevient une chaîne, ce
 * qu'il est partout ailleurs.
 */
export function normalizeErrorBody(
  status: number,
  payload: unknown,
  requestId?: string,
): NormalizedError {
  const base = typeof payload === 'object' && payload !== null ? { ...payload } : {};
  const record = base as Record<string, unknown>;

  // `error` est le libellé anglais que Nest ajoute à ses corps par défaut
  // (« Bad Request »). Il fait double emploi avec `code`, qui est stable et
  // machinable, alors que `error` suit la casse et la langue de Nest.
  delete record.error;

  const rawMessage = typeof payload === 'string' ? payload : record.message;
  let message: string;
  let details: string[] | undefined;

  if (Array.isArray(rawMessage)) {
    details = rawMessage.map(String);
    message = details.length > 0 ? details.join(' ') : FALLBACK_MESSAGE;
  } else if (typeof rawMessage === 'string' && rawMessage !== '') {
    message = rawMessage;
  } else {
    message = FALLBACK_MESSAGE;
  }

  const code = typeof record.code === 'string' && record.code !== '' ? record.code : undefined;

  return {
    ...record,
    statusCode: status,
    code: code ?? genericCode(status),
    message,
    ...(details ? { details } : {}),
    ...(requestId ? { requestId } : {}),
  };
}
