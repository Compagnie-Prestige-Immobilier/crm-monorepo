import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { LotsExportController } from './lots-export.controller.js';

const guard = new RolesGuard(new Reflector());

function ouvre(role: Role, methode: string): boolean {
  const handler = (LotsExportController.prototype as unknown as Record<string, unknown>)[methode];
  const identite: AuthenticatedUser = {
    id: `${role}-1`,
    email: `${role}@cpi.sn`,
    username: role,
    fullName: 'Awa Sy',
    role,
  };
  const context = {
    getHandler: () => handler,
    getClass: () => LotsExportController,
    switchToHttp: () => ({ getRequest: () => ({ user: identite }) }),
  } as unknown as ExecutionContext;

  try {
    return guard.canActivate(context);
  } catch (error) {
    if (error instanceof ForbiddenException) return false;
    throw error;
  }
}

describe('EB-15 : le superviseur mène les campagnes, l’ADMIN seul les supprime', () => {
  it.each(['create', 'preview', 'update', 'reaffecter', 'retirer'])(
    'le superviseur atteint %s',
    (methode) => {
      expect(ouvre(Role.SUPERVISEUR, methode)).toBe(true);
      expect(ouvre(Role.ADMIN, methode)).toBe(true);
    },
  );

  it('la suppression reste fermée au superviseur et à la direction', () => {
    expect(ouvre(Role.ADMIN, 'remove')).toBe(true);
    expect(ouvre(Role.SUPERVISEUR, 'remove')).toBe(false);
    expect(ouvre(Role.DIRECTION, 'remove')).toBe(false);
  });

  it.each(['create', 'preview', 'update', 'reaffecter', 'retirer', 'remove'])(
    'un téléconseiller ne pilote pas les campagnes : %s lui est fermé',
    (methode) => {
      expect(ouvre(Role.COMMERCIAL, methode)).toBe(false);
    },
  );
});
