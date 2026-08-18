import { z } from 'zod';

export const importsEnvSchema = z.object({
  IMPORTS_DIR: z.string().min(1).default('./storage/imports'),

  IMPORTS_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(268_435_456)
    .default(25 * 1_024 * 1_024),

  IMPORTS_CHUNK_SIZE: z.coerce.number().int().positive().max(5_000).default(500),

  IMPORTS_TTL_HOURS: z.coerce.number().int().positive().max(168).default(24),

  IMPORTS_SWEEP_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

export type ImportsEnv = z.infer<typeof importsEnvSchema>;

export const readImportsEnv = (source: NodeJS.ProcessEnv = process.env): ImportsEnv => {
  const parsed = importsEnvSchema.safeParse(source);
  return parsed.success ? parsed.data : importsEnvSchema.parse({});
};
