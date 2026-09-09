import type { components } from '@/api/schema';

export type SessionUser = components['schemas']['Utilisateur'];
export type Role = SessionUser['role'];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  COMMERCIAL: 'Téléconseiller',
  BANQUE_FINANCE: 'Banque & Finance',
  SUPERVISEUR: 'Supervision',
  DIRECTION: 'Direction',
  ACCUEIL: 'Accueil',
  CHARGE_CLIENTELE: 'Chargé de clientèle',
};

/** Segment d'URL des deux projets, et sa valeur côté API. */
export const PROJETS = ['chues', 'grand-public'] as const;

export type Projet = (typeof PROJETS)[number];

export const PROJET_API = {
  chues: 'CHUES',
  'grand-public': 'GRAND_PUBLIC',
} as const satisfies Record<Projet, string>;

export type ProjetApi = (typeof PROJET_API)[Projet];

export function estProjet(valeur: string): valeur is Projet {
  return (PROJETS as readonly string[]).includes(valeur);
}
