import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import { Role } from '@crm/database';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Role[]): CustomDecorator => SetMetadata(ROLES_KEY, roles);

/**
 * Les routes qu'un compte atteint quel que soit son métier : sa propre
 * identité, les référentiels, ses notifications, l'état du mode démonstration.
 */
export const ANY_AUTHENTICATED = [
  Role.ADMIN,
  Role.COMMERCIAL,
  Role.BANQUE_FINANCE,
  Role.SUPERVISEUR,
  Role.DIRECTION,
  Role.ACCUEIL,
] as const;

/**
 * Les rôles qui SYNCHRONISENT. Volontairement distinct : la synchronisation
 * écrit et tire le portefeuille entier sur l'appareil, ce qu'un superviseur,
 * qui lit le travail de tous, ne doit obtenir sous aucun prétexte.
 */
export const MOBILE_ROLES = [Role.ADMIN, Role.COMMERCIAL, Role.BANQUE_FINANCE] as const;
