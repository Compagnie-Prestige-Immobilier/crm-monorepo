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
  Role.CHARGE_CLIENTELE,
] as const;

/**
 * Qui règle ce qui encadre le travail des autres : listes de référence,
 * paramètres partagés. La supervision et la direction en répondent au même
 * titre que l'administrateur.
 */
export const ENCADREMENT = [Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION] as const;

/**
 * Qui MÈNE les trois étapes : qualifier un représentant, ajouter un prospect,
 * le convertir. La supervision et la direction les mènent elles-mêmes, comme un
 * téléconseiller ; la portée de leurs écritures reste celle de leurs propres
 * fiches, l'encadrement passant par `manages()`.
 */
export const PARCOURS_ROLES = [
  Role.COMMERCIAL,
  Role.ADMIN,
  Role.SUPERVISEUR,
  Role.DIRECTION,
  Role.CHARGE_CLIENTELE,
] as const;

/** Les comptes servis par CPI GO. */
const MOBILE_ROLES = [
  Role.ADMIN,
  Role.COMMERCIAL,
  Role.BANQUE_FINANCE,
  Role.CHARGE_CLIENTELE,
] as const;

/**
 * Qui atteint `/sync`. L'accueil tient le registre des visites depuis le
 * téléphone : sans lui ici, `VISITE_REGISTRE_ROLES` était inatteignable et la
 * saisie ne remontait jamais.
 *
 * La supervision et la direction y sont parce que la console d'appel POSTE sur
 * `/sync/push` : sans elles ici, leur écran d'étape 3 n'enregistre rien. Elles
 * synchronisent leur PROPRE travail — `ownerScope` et `mineOrAssignedProspect`
 * bornent leur tirage à leurs fiches, plus l'annuaire commun des représentants.
 * La supervision du travail des AUTRES passe toujours par le panneau.
 */
export const SYNC_ROLES = [
  ...MOBILE_ROLES,
  Role.ACCUEIL,
  Role.SUPERVISEUR,
  Role.DIRECTION,
] as const;
