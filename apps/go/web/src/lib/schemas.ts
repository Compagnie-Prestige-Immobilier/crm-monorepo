import { z } from '@/lib/zod';

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'E-mail ou identifiant obligatoire.')
    .max(160, 'Identifiant trop long.'),
  password: z
    .string()
    .min(8, 'Le mot de passe compte au moins 8 caractères.')
    .max(128, 'Mot de passe trop long.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
