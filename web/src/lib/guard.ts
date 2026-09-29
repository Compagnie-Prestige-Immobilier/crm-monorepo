import { type Permission, peut, type SessionUser } from '@/lib/types';

/** Refus de permission : la coque le rend en `PermissionDenied`, sans quitter l'écran. */
export class RefusPermission extends Error {
  readonly user: SessionUser;

  constructor(user: SessionUser) {
    super('Accès refusé');
    this.name = 'RefusPermission';
    this.user = user;
  }
}

export interface Contexte {
  context: { user: SessionUser };
}

export function guardPermission(permission: Permission) {
  return ({ context }: Contexte): void => {
    if (!peut(context.user, permission)) throw new RefusPermission(context.user);
  };
}
