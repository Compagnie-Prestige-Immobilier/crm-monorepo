import { z } from 'zod';

/**
 * Contrat d'environnement de l'API. Le fichier `.env.example` à la racine du
 * dépôt documente chacune de ces clés ; les deux doivent rester synchronisés.
 *
 * Toute anomalie fait échouer le démarrage. Un secret trop court n'est pas une
 * dégradation acceptable : c'est une clé de signature connue mise en ligne.
 */

const originList = z
  .string()
  .default('http://localhost:3000')
  .transform((value, context) => {
    const origins = value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (!origins.length) {
      context.addIssue({ code: 'custom', message: 'At least one CORS origin is required' });
      return z.NEVER;
    }

    for (const origin of origins) {
      try {
        const url = new URL(origin);
        if (url.origin !== origin) throw new Error('Origin must not include a path');
      } catch {
        context.addIssue({ code: 'custom', message: `Invalid CORS origin: ${origin}` });
        return z.NEVER;
      }
    }

    return origins;
  });

// z.coerce.boolean() transforme la chaîne "false" en true, ce qui inverse
// silencieusement tout drapeau d'opt-out. On analyse le littéral.
const booleanFlag = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .default(fallback ? 'true' : 'false')
    .transform((value) => value === 'true');

export const envSchema = z
  .object({
    // Volontairement requis : un NODE_ENV absent doit faire échouer le
    // démarrage plutôt que de dégrader silencieusement une production.
    NODE_ENV: z.enum(['development', 'test', 'production']),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    // --- API ---
    PORT: z.coerce.number().int().positive().default(3001),
    PUBLIC_WEB_URL: z.url().default('http://localhost:3000'),
    API_CORS_ORIGINS: originList,
    API_DOCS_ENABLED: booleanFlag(false),
    // À n'activer que derrière un proxy qui réécrit X-Forwarded-For : sinon
    // l'IP utilisée par le throttler devient falsifiable.
    API_TRUST_PROXY_HEADERS: booleanFlag(false),

    // --- Données ---
    DATABASE_URL: z.url(),

    // --- Authentification ---
    // 32 caractères minimum. Les valeurs d'exemple sont plus courtes exprès :
    // une copie non éditée de .env.example échoue ici au lieu d'expédier une
    // clé de signature publiquement connue.
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.string().min(1).default('15m'),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
    AUTH_LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(10),
    API_GLOBAL_RATE_LIMIT: z.coerce.number().int().positive().default(300),

    // --- Règles métier ---
    BUSINESS_TIME_ZONE: z.string().min(1).default('Africa/Dakar'),
    // Région utilisée pour interpréter un numéro saisi au format local. C'est
    // la clé de déduplication : elle doit correspondre à la valeur compilée
    // dans l'app mobile.
    PHONE_DEFAULT_REGION: z
      .string()
      .regex(/^[A-Z]{2}$/, 'PHONE_DEFAULT_REGION must be an ISO 3166-1 alpha-2 code')
      .default('SN'),
    SYNC_MAX_BATCH_SIZE: z.coerce.number().int().positive().max(2000).default(200),
    IDEMPOTENCY_TTL_DAYS: z.coerce.number().int().positive().default(7),

    // APK Android servi depuis le volume persistant du VPS. Le chemin doit
    // être monté hors de l'image : un redeploy ne doit jamais effacer la
    // dernière release disponible.
    APK_RELEASE_DIR: z.string().min(1).default('./storage/releases'),
    APK_MAX_SIZE_BYTES: z.coerce.number().int().positive().max(1_073_741_824).default(524_288_000),

    // Garde-fou du mode démonstration. L'interrupteur lui-même vit en base
    // (table app_settings) et se manœuvre depuis le panel admin ; cette
    // variable est distincte et volontairement hors de portée de l'interface :
    // en production, activer la démonstration reste refusé tant qu'elle ne vaut
    // pas true. Des prospects fictifs dans un export réel seraient un incident.
    DEMO_MODE_ALLOWED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production') return;

    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
      });
    }

    if (env.API_DOCS_ENABLED) {
      context.addIssue({
        code: 'custom',
        path: ['API_DOCS_ENABLED'],
        message: 'API_DOCS_ENABLED must be false in production',
      });
    }

    for (const origin of env.API_CORS_ORIGINS) {
      if (!origin.startsWith('https://')) {
        context.addIssue({
          code: 'custom',
          path: ['API_CORS_ORIGINS'],
          message: `Production CORS origins must use https: ${origin}`,
        });
      }
    }
  });

export type ApiEnv = z.infer<typeof envSchema>;

export const readEnv = (source: NodeJS.ProcessEnv = process.env): ApiEnv => envSchema.parse(source);

/**
 * Vrai pendant `pnpm openapi:generate`. Le générateur instancie le conteneur
 * Nest complet pour lire les métadonnées Swagger, mais ne doit jamais ouvrir de
 * connexion : avec Prisma 7 + @prisma/adapter-pg le pool pg est créé
 * immédiatement, et la génération se bloquerait sans base joignable.
 */
export const isOpenApiGeneration = (): boolean => process.env.OPENAPI_GENERATION === '1';
