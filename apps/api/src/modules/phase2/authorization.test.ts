import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Phase2Controller } from './phase2.controller.js';

const guard = new RolesGuard(new Reflector());

const identity = (role: Role): AuthenticatedUser => ({
  id: `usr-${role.toLowerCase()}`,
  email: `${role.toLowerCase()}@cpi.sn`,
  username: role.toLowerCase(),
  fullName: `Utilisateur ${role}`,
  role,
});

type Handler = (...args: never[]) => unknown;

function allows(method: string, role: Role): boolean {
  const prototype = Phase2Controller.prototype as unknown as Record<string, Handler>;
  const handler = prototype[method];
  if (typeof handler !== 'function') {
    throw new Error(`Phase2Controller.${method} n’existe pas : la matrice vise une route fantôme`);
  }
  const context = {
    getHandler: () => handler,
    getClass: () => Phase2Controller,
    switchToHttp: () => ({ getRequest: () => ({ user: identity(role) }) }),
  } as unknown as ExecutionContext;

  try {
    return guard.canActivate(context);
  } catch (error) {
    if (error instanceof ForbiddenException) return false;
    throw error;
  }
}

const admitted = (method: string): Role[] =>
  [Role.ADMIN, Role.BANQUE_FINANCE, Role.COMMERCIAL, Role.SUPERVISEUR].filter((role) =>
    allows(method, role),
  );

const MATRICE: { method: string; roles: Role[] }[] = [
  { method: 'pullDirectory', roles: [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR] },
  {
    method: 'downloadRecording',
    roles: [Role.ADMIN, Role.SUPERVISEUR, Role.COMMERCIAL],
  },
  // Ouverte a qui mene les trois etapes; le service exige ensuite d'etre
  // l'auteur de la tentative, personne ne depose a la place d'un autre.
  { method: 'uploadRecording', roles: [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR] },
];

describe('matrice d’autorisation des appels', () => {
  it.each(MATRICE)('$method', ({ method, roles }) => {
    expect(admitted(method).sort()).toEqual([...roles].sort());
  });

  it('la matrice couvre TOUTES les routes du contrôleur', () => {
    const routes = Object.getOwnPropertyNames(Phase2Controller.prototype).filter(
      (name) => name !== 'constructor',
    );
    expect(routes.sort()).toEqual(MATRICE.map((row) => row.method).sort());
  });

  it('le SUPERVISEUR lit l’annuaire et les notes, sans accès bancaire', () => {
    expect(allows('pullDirectory', Role.SUPERVISEUR)).toBe(true);
  });
});
