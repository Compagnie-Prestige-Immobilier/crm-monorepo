import { z } from 'zod';

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

const booleanFlag = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .default(fallback ? 'true' : 'false')
    .transform((value) => value === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    PORT: z.coerce.number().int().positive().default(3001),
    PUBLIC_WEB_URL: z.url().default('http://localhost:3000'),
    API_CORS_ORIGINS: originList,
    API_DOCS_ENABLED: booleanFlag(false),
    API_TRUST_PROXY_HEADERS: booleanFlag(false),

    DATABASE_URL: z.url(),
    DATABASE_POOL_SIZE: z.coerce.number().int().min(2).default(10),
    /** Absent : aucun cache, tout retombe sur Postgres. Obligatoire en production. */
    REDIS_URL: z.url().optional(),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.string().min(1).default('15m'),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
    AUTH_LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(10),
    API_GLOBAL_RATE_LIMIT: z.coerce.number().int().positive().default(300),

    BUSINESS_TIME_ZONE: z.string().min(1).default('Africa/Dakar'),
    PHONE_DEFAULT_REGION: z
      .string()
      .regex(/^[A-Z]{2}$/, 'PHONE_DEFAULT_REGION must be an ISO 3166-1 alpha-2 code')
      .default('SN'),
    SYNC_MAX_BATCH_SIZE: z.coerce.number().int().positive().max(2000).default(200),
    IDEMPOTENCY_TTL_DAYS: z.coerce.number().int().positive().default(7),
    PASSWORD_MIN_LENGTH: z.coerce.number().int().min(1).default(8),
    PASSWORD_MAX_LENGTH: z.coerce.number().int().positive().max(200).default(24),

    APK_RELEASE_DIR: z.string().min(1).default('./storage/releases'),
    APK_MAX_SIZE_BYTES: z.coerce.number().int().positive().max(1_073_741_824).default(524_288_000),

    /** Empreinte SHA-256 du certificat de signature attendu, avec ou sans deux-points. */
    APK_SIGNER_SHA256: z
      .string()
      .trim()
      .transform((value) => value.replaceAll(':', '').toLowerCase())
      .refine(
        (value) => value === '' || /^[0-9a-f]{64}$/.test(value),
        'APK_SIGNER_SHA256 must be a SHA-256 fingerprint (64 hex characters)',
      )
      .default(''),
    APK_DOWNLOAD_RATE_LIMIT: z.coerce.number().int().positive().default(1000),

    CALL_RECORDING_DIR: z.string().min(1).default('./storage/call-recordings'),
    CALL_RECORDING_MAX_SIZE_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(100_000_000)
      .default(25_000_000),

    /**
     * Duree de conservation d'une note audio. Deux jours: le superviseur ecoute
     * dans la foulee, et on ne garde pas la voix d'un salarie au-dela. Passe ce
     * delai l'historique d'appel reste, sans son audio.
     */
    CALL_RECORDING_RETENTION_HOURS: z.coerce.number().int().positive().max(8_760).default(48),

    DB_DUMP_DIR: z.string().min(1).default('./storage/db-dumps'),

    DB_DUMP_ENABLED: booleanFlag(false),

    DEMO_WORKSPACE_ENABLED: booleanFlag(false),

    /**
     * Les deux plateformes d'enrôlement, en LECTURE seule. `servers[0].url` des
     * specs porte déjà `/api` : l'URL attendue est donc `https://<hôte>/api`.
     *
     * Vides par défaut, et c'est le cas normal en développement comme en test :
     * le connecteur ne tire alors rien et l'écran d'administration le dit, au
     * lieu de faire échouer le démarrage de toute l'API.
     */
    PLATEFORME_CHUES_URL: z.union([z.url(), z.literal('')]).default(''),
    PLATEFORME_CHUES_TOKEN: z.string().default(''),
    PLATEFORME_GRAND_PUBLIC_URL: z.union([z.url(), z.literal('')]).default(''),
    PLATEFORME_GRAND_PUBLIC_TOKEN: z.string().default(''),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production') return;

    if (!env.REDIS_URL) {
      context.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required in production',
      });
    }

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

    // La fabrique de démonstration écrit neuf cent mille lignes : elle n'a rien
    // à faire sur la base qui porte les vraies fiches.
    if (env.DEMO_WORKSPACE_ENABLED) {
      context.addIssue({
        code: 'custom',
        path: ['DEMO_WORKSPACE_ENABLED'],
        message: 'DEMO_WORKSPACE_ENABLED must be false in production',
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

    // Une URL sans jeton tirerait en anonyme et remonterait un 401 toutes les
    // quinze minutes, sans que personne ne sache que le jeton n'a jamais été posé.
    const plateformes = [
      ['PLATEFORME_CHUES_URL', 'PLATEFORME_CHUES_TOKEN', env.PLATEFORME_CHUES_URL, env.PLATEFORME_CHUES_TOKEN],
      [
        'PLATEFORME_GRAND_PUBLIC_URL',
        'PLATEFORME_GRAND_PUBLIC_TOKEN',
        env.PLATEFORME_GRAND_PUBLIC_URL,
        env.PLATEFORME_GRAND_PUBLIC_TOKEN,
      ],
    ] as const;

    for (const [cleUrl, cleJeton, url, jeton] of plateformes) {
      if (url !== '' && jeton.trim() === '') {
        context.addIssue({
          code: 'custom',
          path: [cleJeton],
          message: `${cleJeton} is required when ${cleUrl} is set`,
        });
      }
    }
  });

export type ApiEnv = z.infer<typeof envSchema>;

export const readEnv = (source: NodeJS.ProcessEnv = process.env): ApiEnv => envSchema.parse(source);

export const isOpenApiGeneration = (): boolean => process.env.OPENAPI_GENERATION === '1';
