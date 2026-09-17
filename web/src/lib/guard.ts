import { type Permission, peut, type Role, type SessionUser } from '@/lib/types';

/** Refus de rôle : la coque le rend en `PermissionDenied`, sans quitter l'écran. */
export class RefusPermission extends Error {
  readonly role: Role;

  constructor(role: Role) {
    super('Accès refusé');
    this.name = 'RefusPermission';
    this.role = role;
  }
}

export interface Contexte {
  context: { user: SessionUser };
}

export function guardPermission(permission: Permission) {
  return ({ context }: Contexte): void => {
    if (!peut(context.user, permission)) throw new RefusPermission(context.user.role);
  };
}

export function guardRoles(roles: readonly Role[]) {
  return ({ context }: Contexte): void => {
    if (!roles.includes(context.user.role)) throw new RefusPermission(context.user.role);
  };
}
