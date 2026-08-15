import { z } from 'zod';

import { PROSPECT_STATUTS } from '@/lib/types';

/**
 * Schémas partagés entre le formulaire client et le Route Handler.
 *
 * Une seule définition : le message d'erreur affiché sous le champ est
 * littéralement celui que le serveur appliquerait. Les bornes (longueurs
 * minimales, tailles maximales) reprennent celles de `apps/api/openapi.json` -
 * un formulaire plus permissif que l'API produit un 400 illisible au lieu d'un
 * message sous le champ fautif.
 */

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

// ─── Comptes commerciaux ────────────────────────────────────────────────────

/** `CreateUserDto.password` : 12 caractères minimum côté API. */
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
  // Saisie libre : l'API normalise en E.164 avec la région SN. Refuser un
  // « 77 123 45 67 » écrit naturellement serait absurde.
  phone: z.string().trim().max(40, 'Numéro trop long.'),
  departementId: z.string().trim(),
});

/**
 * Un seul schéma pour la création ET la modification, paramétré par le mode.
 *
 * La forme de sortie est identique dans les deux cas : `password` reste une
 * chaîne, vide en modification : pour que `react-hook-form` n'ait qu'un seul
 * type de valeurs. Deux schémas de formes différentes obligeraient à typer le
 * formulaire en union, et `handleSubmit` ne saurait plus quoi passer.
 */
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

// ─── Référentiels ───────────────────────────────────────────────────────────

const sortOrderField = z.coerce
  .number<number>()
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

// ─── Prospects et représentants ─────────────────────────────────────────────

export const prospectSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire.').max(120, 'Nom trop long.'),
  prenom: z.string().trim().min(1, 'Le prénom est obligatoire.').max(120, 'Prénom trop long.'),
  phone: z.string().trim().min(1, 'Le téléphone est obligatoire.').max(40, 'Numéro trop long.'),
  banqueId: z.string().trim().min(1, 'La banque est obligatoire.'),
  syndicatId: z.string().trim().min(1, 'Le syndicat est obligatoire.'),
  representantId: z.string().trim().min(1, 'Le représentant est obligatoire.'),
  // `PROSPECT_STATUTS` est maintenant un tuple littéral figé (`as const
  // satisfies`) : `z.enum` le consomme directement, sans la conversion vers un
  // tuple mutable qu'exigeait l'ancienne annotation `readonly ProspectStatut[]`.
  statut: z.enum(PROSPECT_STATUTS),
});
export type ProspectFormInput = z.infer<typeof prospectSchema>;

export const representantSchema = z.object({
  fullName: z.string().trim().min(1, 'Le nom complet est obligatoire.').max(160, 'Nom trop long.'),
  phone: z.string().trim().min(1, 'Le téléphone est obligatoire.').max(40, 'Numéro trop long.'),
  departementId: z.string().trim().min(1, 'Le département est obligatoire.'),
  notes: z.string().trim().max(2000, 'Notes trop longues (2000 caractères maximum).'),
});
export type RepresentantFormInput = z.infer<typeof representantSchema>;
