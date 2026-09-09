import { z } from 'zod';

const turnstileEnvSchema = z.object({
  /** Lu par le panel, qui peint le widget. L'API n'en a pas l'usage. */
  TURNSTILE_SITE_KEY: z.string().optional(),

  TURNSTILE_SECRET_KEY: z.string().optional(),

  /**
   * Sans clé secrète, l'envoi passe SANS vérification anti-robot. À poser
   * sciemment : par défaut l'absence de clé ferme la route.
   */
  TURNSTILE_ALLOW_DEGRADED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type TurnstileEnv = z.infer<typeof turnstileEnvSchema>;

export const readTurnstileEnv = (source: NodeJS.ProcessEnv = process.env): TurnstileEnv => {
  const parsed = turnstileEnvSchema.safeParse(source);
  return parsed.success ? parsed.data : turnstileEnvSchema.parse({});
};
