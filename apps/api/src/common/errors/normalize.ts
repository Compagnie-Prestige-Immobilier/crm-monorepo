import { HttpStatus } from '@nestjs/common';

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

const FALLBACK_MESSAGE = 'Une erreur est survenue.';

export interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: string[];
  requestId?: string;
  [key: string]: unknown;
}

export function normalizeErrorBody(
  status: number,
  payload: unknown,
  requestId?: string,
): NormalizedError {
  const base = typeof payload === 'object' && payload !== null ? { ...payload } : {};
  const record = base as Record<string, unknown>;

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
