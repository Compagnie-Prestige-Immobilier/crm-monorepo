import { afterEach, describe, expect, it } from 'vitest';

import {
  ApiConfigurationError,
  CONFIG_ERROR_CODE,
  configErrorBody,
  configErrorMessage,
  isConfigurationError,
  serverApiOrigin,
} from '@/lib/api/config';
import { apiErrorText } from '@/lib/mutation-feedback';
import { ApiError } from '@crm/api-client/query';

const ORIGINAL_API_URL = process.env.API_URL;
const ORIGINAL_INTERNAL = process.env.API_INTERNAL_URL;

afterEach(() => {
  if (ORIGINAL_API_URL === undefined) delete process.env.API_URL;
  else process.env.API_URL = ORIGINAL_API_URL;
  if (ORIGINAL_INTERNAL === undefined) delete process.env.API_INTERNAL_URL;
  else process.env.API_INTERNAL_URL = ORIGINAL_INTERNAL;
});

describe('serverApiOrigin', () => {
  it('lève une erreur de configuration qui nomme la variable absente', () => {
    delete process.env.API_URL;
    delete process.env.API_INTERNAL_URL;

    expect(() => serverApiOrigin()).toThrow(ApiConfigurationError);
    try {
      serverApiOrigin();
      expect.unreachable('serverApiOrigin aurait dû lever');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiConfigurationError);
      expect((error as ApiConfigurationError).variable).toBe('API_URL');
      expect((error as ApiConfigurationError).message).toContain('API_URL');
    }
  });

  it('traite une chaîne vide comme une variable absente', () => {
    process.env.API_URL = '';
    delete process.env.API_INTERNAL_URL;
    expect(() => serverApiOrigin()).toThrow(ApiConfigurationError);
  });

  it('retire les barres obliques finales', () => {
    process.env.API_URL = 'http://api.internal:3001///';
    expect(serverApiOrigin()).toBe('http://api.internal:3001');
  });
});

describe('reconnaissance d’une erreur de configuration', () => {
  it('reconnaît l’exception levée côté serveur', () => {
    expect(isConfigurationError(new ApiConfigurationError('API_URL'))).toBe(true);
  });

  it('reconnaît le corps renvoyé par un Route Handler', () => {
    const body = configErrorBody(new ApiConfigurationError('API_URL'));
    expect(body.code).toBe(CONFIG_ERROR_CODE);
    expect(body.variable).toBe('API_URL');
    expect(configErrorMessage(body)).toContain('API_URL');

    const error = new ApiError(body, new Response(null, { status: 500 }));
    expect(isConfigurationError(error)).toBe(true);
  });

  it('ne confond pas une panne de serveur avec une configuration absente', () => {
    const error = new ApiError({ message: 'boom' }, new Response(null, { status: 500 }));
    expect(isConfigurationError(error)).toBe(false);
    expect(isConfigurationError(new Error('fetch failed'))).toBe(false);
    expect(isConfigurationError(null)).toBe(false);
    expect(configErrorMessage({ code: 'AUTRE_CHOSE', error: 'x' })).toBeNull();
  });
});

describe('apiErrorText', () => {
  it('nomme la variable manquante plutôt que la connexion', () => {
    const text = apiErrorText(new ApiConfigurationError('API_URL'), 'repli');
    expect(text).toContain('API_URL');
    expect(text).not.toContain('Vérifiez la connexion');
  });

  it('nomme la variable même quand la cause a traversé le réseau', () => {
    const error = new ApiError(
      configErrorBody(new ApiConfigurationError('API_URL')),
      new Response(null, { status: 500 }),
    );
    const text = apiErrorText(error, 'repli');
    expect(text).toContain('API_URL');
    expect(text).not.toContain('Erreur serveur');
  });

  it('garde la formulation générique pour une vraie panne de réseau', () => {
    expect(apiErrorText(new TypeError('Failed to fetch'), 'repli')).toBe(
      'Serveur injoignable. Vérifiez la connexion, puis réessayez.',
    );
  });

  it('garde « Erreur serveur » pour un 500 qui n’est pas un défaut de configuration', () => {
    const error = new ApiError({}, new Response(null, { status: 503 }));
    expect(apiErrorText(error, 'repli')).toContain('Erreur serveur');
  });
});
