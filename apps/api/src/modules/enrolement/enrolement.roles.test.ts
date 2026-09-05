import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { RolesGuard } from '../../common/guards/roles.guard.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { EnrolementController } from './enrolement.controller.js';

const guard = new RolesGuard(new Reflector());

const routes = Object.getOwnPropertyNames(EnrolementController.prototype).filter(
  (name) => name !== 'constructor',
);

function ouvre(role: Role, methode: string): boolean {
  const handler = (EnrolementController.prototype as unknown as Record<string, unknown>)[methode];
  const identite: AuthenticatedUser = {
    id: `${role}-1`,
    email: `${role}@cpi.sn`,
    username: role,
    fullName: 'Awa Sy',
    role,
  };
  const context = {
    getHandler: () => handler,
    getClass: () => EnrolementController,
    switchToHttp: () => ({ getRequest: () => ({ user: identite }) }),
  } as unknown as ExecutionContext;

  try {
    return guard.canActivate(context);
  } catch (error) {
    if (error instanceof ForbiddenException) return false;
    throw error;
  }
}

/**
 * Le connecteur ne sert QUE la cellule pilotage, qui tient le rôle ADMIN. Ce
 * balayage vaut pour toute route ajoutée plus tard au contrôleur : il lit ses
 * méthodes, il n'en récite pas une liste.
 */
describe('les plateformes d’enrôlement ne s’ouvrent qu’à l’ADMIN', () => {
  it('le contrôleur expose bien les routes attendues', () => {
    expect(routes.sort()).toEqual([
      'get',
      'indicateursDuProjet',
      'list',
      'majReglages',
      'purger',
      'reglages',
      'supprimer',
      'tirer',
    ]);
  });

  it('le rôle exigé est posé sur la CLASSE : une route ajoutée demain naît fermée', () => {
    expect(new Reflector().get<Role[]>(ROLES_KEY, EnrolementController)).toEqual([Role.ADMIN]);
  });

  it('l’ADMIN atteint chaque route', () => {
    for (const methode of routes) {
      expect(ouvre(Role.ADMIN, methode), `admin.${methode}`).toBe(true);
    }
  });

  it.each([Role.SUPERVISEUR, Role.DIRECTION, Role.COMMERCIAL, Role.BANQUE_FINANCE, Role.ACCUEIL])(
    'un compte %s reçoit 403 sur TOUTES les routes',
    (role) => {
      for (const methode of routes) {
        expect(ouvre(role, methode), `${role}.${methode}`).toBe(false);
      }
    },
  );
});
