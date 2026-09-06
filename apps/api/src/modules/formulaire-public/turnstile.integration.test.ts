import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { verifierTurnstile } from './turnstile.js';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const repond = (corps: unknown, status = 200): typeof globalThis.fetch =>
  vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(corps), { status })),
  ) as unknown as typeof globalThis.fetch;

const avecCle = { TURNSTILE_SECRET_KEY: '0x-secret' } as NodeJS.ProcessEnv;

describe('verifierTurnstile', () => {
  describe('sans clé secrète', () => {
    it('refuse en 503 quand la dégradation n’est pas autorisée', async () => {
      const envoyer = repond({ success: true });
      await expect(
        verifierTurnstile('jeton', '1.2.3.4', { env: {}, fetch: envoyer }),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(envoyer).not.toHaveBeenCalled();
    });

    it('refuse aussi quand le drapeau porte autre chose que « true »', async () => {
      const env = { TURNSTILE_ALLOW_DEGRADED: 'oui' } as NodeJS.ProcessEnv;
      await expect(verifierTurnstile('jeton', undefined, { env })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('laisse passer quand TURNSTILE_ALLOW_DEGRADED vaut « true »', async () => {
      const env = { TURNSTILE_ALLOW_DEGRADED: 'true' } as NodeJS.ProcessEnv;
      const envoyer = repond({ success: true });
      await expect(
        verifierTurnstile(undefined, undefined, { env, fetch: envoyer }),
      ).resolves.toBeUndefined();
      expect(envoyer).not.toHaveBeenCalled();
    });
  });

  describe('avec clé secrète', () => {
    it('poste le jeton et l’adresse du visiteur à Cloudflare', async () => {
      const envoyer = repond({ success: true });
      await verifierTurnstile('jeton-du-widget', '41.82.0.7', { env: avecCle, fetch: envoyer });

      expect(envoyer).toHaveBeenCalledTimes(1);
      const [url, init] = vi.mocked(envoyer).mock.calls[0] as [string, RequestInit];
      expect(url).toBe(SITEVERIFY);
      const corps = init.body as URLSearchParams;
      expect(corps.get('secret')).toBe('0x-secret');
      expect(corps.get('response')).toBe('jeton-du-widget');
      expect(corps.get('remoteip')).toBe('41.82.0.7');
    });

    it('n’appelle pas Cloudflare quand le jeton manque', async () => {
      const envoyer = repond({ success: true });
      await expect(
        verifierTurnstile('   ', '41.82.0.7', { env: avecCle, fetch: envoyer }),
      ).rejects.toThrow(BadRequestException);
      expect(envoyer).not.toHaveBeenCalled();
    });

    it('refuse en 400 quand Cloudflare rend success faux', async () => {
      const envoyer = repond({ success: false, 'error-codes': ['invalid-input-response'] });
      await expect(
        verifierTurnstile('jeton', undefined, { env: avecCle, fetch: envoyer }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse en 503 quand Cloudflare est injoignable', async () => {
      const envoyer = vi.fn(() =>
        Promise.reject(new Error('réseau coupé')),
      ) as unknown as typeof globalThis.fetch;
      await expect(
        verifierTurnstile('jeton', undefined, { env: avecCle, fetch: envoyer }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('refuse en 503 quand Cloudflare rend une erreur HTTP', async () => {
      const envoyer = repond({}, 500);
      await expect(
        verifierTurnstile('jeton', undefined, { env: avecCle, fetch: envoyer }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
