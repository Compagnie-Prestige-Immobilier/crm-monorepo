export const ACCESS_COOKIE = 'cpi_at';
export const REFRESH_COOKIE = 'cpi_rt';

export const API_PREFIX = '/api/v1';

export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export const REFRESH_SKEW_SECONDS = 60;

const CONFIG_ERROR_CODE = 'CONFIGURATION_MANQUANTE';

export class ApiConfigurationError extends Error {
  readonly variable: string;

  constructor(variable: string) {
    super(
      `Configuration incomplète : ${variable} est absent de l’environnement du panel. ` +
        'Renseignez cette variable, puis redémarrez le service.',
    );
    this.name = 'ApiConfigurationError';
    this.variable = variable;
  }
}

export function configErrorMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const { code, error } = body as { code?: unknown; error?: unknown };
  if (code !== CONFIG_ERROR_CODE) return null;
  return typeof error === 'string' && error !== '' ? error : null;
}

export function isConfigurationError(error: unknown): boolean {
  if (error instanceof ApiConfigurationError) return true;
  if (typeof error !== 'object' || error === null) return false;
  return configErrorMessage((error as { body?: unknown }).body) !== null;
}

export function serverApiOrigin(): string {
  const url = process.env.API_URL ?? process.env.API_INTERNAL_URL;
  if (url === undefined || url === '') throw new ApiConfigurationError('API_URL');
  return url.replace(/\/+$/, '');
}

export function configErrorBody(error: ApiConfigurationError): {
  error: string;
  code: string;
  variable: string;
} {
  return { error: error.message, code: CONFIG_ERROR_CODE, variable: error.variable };
}

export function browserApiOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}
