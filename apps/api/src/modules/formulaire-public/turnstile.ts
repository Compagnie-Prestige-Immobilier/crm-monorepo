import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';

import { readTurnstileEnv } from './turnstile.env.js';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const TIMEOUT_MS = 10_000;

const logger = new Logger('Turnstile');

const captchaIndisponible = (): ServiceUnavailableException =>
  new ServiceUnavailableException({
    code: 'CAPTCHA_INDISPONIBLE',
    message: 'La vérification anti-robot est indisponible. Réessayez dans un instant.',
  });

const captchaRefuse = (): BadRequestException =>
  new BadRequestException({
    code: 'CAPTCHA_REFUSE',
    message: 'La vérification anti-robot n’a pas abouti. Rechargez la page et recommencez.',
  });

const codesDErreur = (charge: unknown): string => {
  if (typeof charge !== 'object' || charge === null) return 'réponse illisible';
  const codes = (charge as { 'error-codes'?: unknown })['error-codes'];
  return Array.isArray(codes) && codes.length > 0 ? codes.join(', ') : 'sans code';
};

/**
 * La seule barrière anti-robot de la route publique, à côté du champ piège.
 *
 * Sans clé secrète, l'envoi est REFUSÉ : une vérification qui se désactive
 * toute seule quand sa configuration manque ne protège rien, et personne ne
 * s'apercevrait qu'elle est tombée. `TURNSTILE_ALLOW_DEGRADED=true` lève ce
 * refus, et c'est alors un choix consigné dans l'environnement.
 */
export async function verifierTurnstile(
  jeton: string | undefined,
  ip: string | undefined,
): Promise<void> {
  const config = readTurnstileEnv();
  const secret = config.TURNSTILE_SECRET_KEY?.trim();

  if (!secret) {
    if (!config.TURNSTILE_ALLOW_DEGRADED) throw captchaIndisponible();
    logger.warn(
      'TURNSTILE_SECRET_KEY absent et TURNSTILE_ALLOW_DEGRADED=true : demande publique acceptée sans vérification.',
    );
    return;
  }

  const reponse = jeton?.trim();
  if (!reponse) throw captchaRefuse();

  const corps = new URLSearchParams({ secret, response: reponse });
  if (ip !== undefined && ip !== '') corps.set('remoteip', ip);

  let recue: Response;
  try {
    recue = await fetch(SITEVERIFY, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: corps,
    });
  } catch (error) {
    logger.error({ err: error }, 'Cloudflare injoignable : vérification anti-robot impossible.');
    throw captchaIndisponible();
  }

  if (!recue.ok) {
    logger.error(`Cloudflare a répondu ${String(recue.status)} à la vérification anti-robot.`);
    throw captchaIndisponible();
  }

  const charge: unknown = await recue.json().catch(() => null);
  if (typeof charge === 'object' && charge !== null && (charge as { success?: unknown }).success) {
    return;
  }

  logger.warn(`Vérification anti-robot refusée : ${codesDErreur(charge)}.`);
  throw captchaRefuse();
}
