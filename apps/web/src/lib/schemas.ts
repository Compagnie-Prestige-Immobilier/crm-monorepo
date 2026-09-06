import { z } from 'zod';

import { PROSPECT_TYPES } from '@/lib/data/grand-public';
import { WHATSAPP_STATUSES } from '@/lib/data/representants';
import { DUREE_ETABLISSEMENT_MAX_MOIS, PAYMENT_MODES, PROSPECT_STATUTS } from '@/lib/types';

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

const passwordField = z
  .string()
  .min(12, 'Le mot de passe compte au moins 12 caractères.')
  .max(200, 'Mot de passe trop long.');

const usernameField = z
  .string()
  .trim()
  .min(3, "L'identifiant compte au moins 3 caractères.")
  .max(40, 'Identifiant trop long.')
  .regex(
    /^[a-zA-Z0-9._]+$/,
    'Lettres, chiffres, point et tiret bas uniquement, sans espace ni accent.',
  );

const userBaseSchema = z.object({
  email: z.email('Adresse e-mail invalide.').max(254, 'Adresse trop longue.'),
  username: usernameField,
  fullName: z.string().trim().min(1, 'Le nom complet est obligatoire.').max(160, 'Nom trop long.'),
  phone: z.string().trim().max(40, 'Numéro trop long.'),
  role: z.enum(
    [
      'ADMIN',
      'COMMERCIAL',
      'BANQUE_FINANCE',
      'SUPERVISEUR',
      'DIRECTION',
      'ACCUEIL',
      'CHARGE_CLIENTELE',
    ],
    { message: 'Choisissez le rôle du compte.' },
  ),
});

export function userFormSchema(mode: 'create' | 'edit') {
  return userBaseSchema.extend({
    password: mode === 'create' ? passwordField : z.string(),
  });
}

export type UserFormInput = z.infer<ReturnType<typeof userFormSchema>>;

export const resetPasswordSchema = z
  .object({ password: passwordField, confirmation: z.string() })
  .refine((values) => values.password === values.confirmation, {
    message: 'Les deux mots de passe diffèrent.',
    path: ['confirmation'],
  });

export type ResetPasswordFormInput = z.infer<typeof resetPasswordSchema>;

export const NEW_PASSWORD_MIN_LENGTH = 8;
export const NEW_PASSWORD_MAX_LENGTH = 24;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Le mot de passe actuel est obligatoire.'),
    newPassword: z
      .string()
      .min(
        NEW_PASSWORD_MIN_LENGTH,
        `Le nouveau mot de passe compte au moins ${String(NEW_PASSWORD_MIN_LENGTH)} caractères.`,
      )
      .max(
        NEW_PASSWORD_MAX_LENGTH,
        `Le nouveau mot de passe compte au plus ${String(NEW_PASSWORD_MAX_LENGTH)} caractères.`,
      ),
    confirmation: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmation, {
    message: 'Les deux mots de passe diffèrent.',
    path: ['confirmation'],
  });

export type ChangePasswordFormInput = z.infer<typeof changePasswordSchema>;

// Un champ vidé devenait 0 par coercition, et l'entrée passait en tête des listes.
const sortOrderField = z.coerce
  .number<number>({ error: "L'ordre est un nombre entier." })
  .int("L'ordre est un nombre entier.")
  .min(0, "L'ordre ne peut pas être négatif.")
  .max(9999, 'Ordre trop grand.');

export const banqueSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire.').max(160, 'Nom trop long.'),
  shortName: z
    .string()
    .trim()
    .min(1, "L'abréviation est obligatoire.")
    .max(32, 'Abréviation trop longue.'),
  sortOrder: sortOrderField,
});
export type BanqueFormInput = z.infer<typeof banqueSchema>;

export const syndicatSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire.').max(200, 'Nom trop long.'),
  sigle: z.string().trim().min(1, 'Le sigle est obligatoire.').max(32, 'Sigle trop long.'),
  secteur: z.string().trim().max(120, 'Secteur trop long.'),
  sortOrder: sortOrderField,
});
export type SyndicatFormInput = z.infer<typeof syndicatSchema>;

export const departementSchema = z.object({
  code: z.string().trim().min(1, 'Le code est obligatoire.').max(16, 'Code trop long.'),
  name: z.string().trim().min(1, 'Le nom est obligatoire.').max(120, 'Nom trop long.'),
  regionId: z.string().trim().min(1, 'La région est obligatoire.'),
});
export type DepartementFormInput = z.infer<typeof departementSchema>;

export const prospectSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire.').max(120, 'Nom trop long.'),
  prenom: z.string().trim().min(1, 'Le prénom est obligatoire.').max(120, 'Prénom trop long.'),
  phone: z.string().trim().min(1, 'Le téléphone est obligatoire.').max(40, 'Numéro trop long.'),
  // Facultatifs, comme à la création et comme côté serveur : une fiche Grand
  // Public n'a ni représentant ni syndicat, et les exiger ici rendait toute
  // modification impossible, jusqu'à la correction d'un prénom.
  banqueId: z.string().trim(),
  syndicatId: z.string().trim(),
  representantId: z.string().trim(),
  statut: z.enum(PROSPECT_STATUTS),
});
export type ProspectFormInput = z.infer<typeof prospectSchema>;

/**
 * Ce que le relais public accepte de transmettre à `DemandePubliqueDto`. Ce qui
 * est réellement EXIGE vient des réglages de l'administrateur, que seule l'API
 * connaît : hors identité et numéro, tout est facultatif ici.
 */
export const demandePubliqueSchema = z.object({
  prenom: z.string().trim().min(1, 'Le prénom est obligatoire.').max(120, 'Prénom trop long.'),
  nom: z.string().trim().min(1, 'Le nom est obligatoire.').max(120, 'Nom trop long.'),
  phone: z.string().trim().min(6, 'Le téléphone est obligatoire.').max(40, 'Numéro trop long.'),
  email: z.email('Adresse e-mail invalide.').max(254, 'Adresse trop longue.').optional(),
  profession: z.string().trim().max(120, 'Profession trop longue.').optional(),
  etablissement: z.string().trim().max(160, 'Établissement trop long.').optional(),
  dureeEtablissementMois: z.number().int().min(0).max(DUREE_ETABLISSEMENT_MAX_MOIS).optional(),
  fonctionnaire: z.boolean().optional(),
  engagementEnCours: z.boolean().optional(),
  syndicatId: z.uuid().optional(),
  banqueId: z.uuid().optional(),
  incomeBandId: z.uuid().optional(),
  type: z.enum(PROSPECT_TYPES).optional(),
  paymentMode: z.enum(PAYMENT_MODES).optional(),
  dureeSystemeMois: z.number().int().min(1).max(300).optional(),
  whatsappStatus: z.enum(WHATSAPP_STATUSES).optional(),
  whatsappE164: z.string().trim().min(6).max(40).optional(),
  champsLibres: z.record(z.string().max(60), z.string().trim().max(500)).optional(),
  message: z.string().trim().max(500, 'Message trop long (500 caractères maximum).').optional(),
  site: z.string().max(200).optional(),
});

export type DemandePubliqueInput = z.infer<typeof demandePubliqueSchema>;
