import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import { Role } from '@crm/database';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Role[]): CustomDecorator => SetMetadata(ROLES_KEY, roles);

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

/**
 * Qui atteint `/sync`. L'accueil tient le registre des visites depuis le
 * téléphone : sans lui ici, `VISITE_REGISTRE_ROLES` était inatteignable et la
 * saisie ne remontait jamais. Sa portée reste `mineOrAssigned*`, il ne tire
 * aucun portefeuille. La DIRECTION reste dehors : elle travaille au panneau,
 * et `role-routes.test.ts` en fait une règle.
 */
export const SYNC_ROLES = [...MOBILE_ROLES, Role.ACCUEIL] as const;
