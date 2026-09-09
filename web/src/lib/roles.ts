import type { Role } from '@/lib/types';

/** Les rôles qui font eux-mêmes les trois étapes du projet CHUES. */
export const TERRAIN: readonly Role[] = [
  'COMMERCIAL',
  'CHARGE_CLIENTELE',
  'SUPERVISEUR',
  'DIRECTION',
];

/** Ceux qui, en plus de leurs propres appels, suivent le travail des autres. */
export const ENCADREMENT: readonly Role[] = ['SUPERVISEUR', 'DIRECTION'];

/**
 * Les rôles qui reçoivent des notifications lisibles dans le panneau. Le
 * téléconseiller et le chargé de clientèle en sont absents.
 */
export const INBOX_ROLES: readonly Role[] = [
  'ADMIN',
  'DIRECTION',
  'SUPERVISEUR',
  'BANQUE_FINANCE',
  'ACCUEIL',
];

/** Ceux qui passent les appels sans encadrer personne. */
export const TELECONSEIL: readonly Role[] = ['COMMERCIAL', 'CHARGE_CLIENTELE'];

export const ADMIN_SEUL: readonly Role[] = ['ADMIN'];

export const BANQUE_SEULE: readonly Role[] = ['BANQUE_FINANCE'];

export const PILOTAGE: readonly Role[] = ['ADMIN', 'SUPERVISEUR', 'DIRECTION'];

export const BANQUE: readonly Role[] = ['ADMIN', 'BANQUE_FINANCE'];

export const APPELANTS: readonly Role[] = [
  'ADMIN',
  'COMMERCIAL',
  'CHARGE_CLIENTELE',
  'SUPERVISEUR',
  'DIRECTION',
];

/** L'accueil du projet CHUES : l'agent bancaire y entre aussi. */
export const APPELANTS_ET_BANQUE: readonly Role[] = [...APPELANTS, 'BANQUE_FINANCE'];

export const SAISIE_GRAND_PUBLIC: readonly Role[] = ['ADMIN', 'COMMERCIAL', 'CHARGE_CLIENTELE'];

export const ACCUEIL_LECTURE: readonly Role[] = ['ADMIN', 'DIRECTION', 'ACCUEIL'];

export const ACCUEIL_ADMINISTRATION: readonly Role[] = ['ADMIN', 'DIRECTION'];

/** Route absente de ce projet : elle n'existe pas plus qu'une adresse inventée. */
export const AUCUN: readonly Role[] = [];
