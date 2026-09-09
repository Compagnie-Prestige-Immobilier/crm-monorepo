import { notFound } from '@tanstack/react-router';

import { estProjet, type Projet, type Role, type SessionUser } from '@/lib/types';

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

function verifier(roles: readonly Role[], role: Role): void {
  if (!roles.includes(role)) throw new RefusPermission(role);
}

export function guardRoles(roles: readonly Role[]) {
  return ({ context }: Contexte): void => {
    verifier(roles, context.user.role);
  };
}

/**
 * Les deux projets partagent un arbre de routes mais pas leurs écrans : une
 * liste vide dit que l'adresse n'existe pas de ce côté.
 */
export function guardProjet(parProjet: Readonly<Record<Projet, readonly Role[]>>) {
  // Générique sur les paramètres : un type fixe les clouerait à ce seul segment,
  // et `$campagneId` disparaîtrait de `Route.useParams()`.
  return <P extends { projet: string }>({ context, params }: Contexte & { params: P }): void => {
    const roles = estProjet(params.projet) ? parProjet[params.projet] : [];
    if (roles.length === 0) throw notFound();
    verifier(roles, context.user.role);
  };
}
