import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { RolesGuard } from '../../common/guards/roles.guard.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { UsersController } from '../users/users.controller.js';
import { Phase2Controller } from '../phase2/phase2.controller.js';
import { ReferentielsController } from '../referentiels/referentiels.controller.js';
import { ClientRequestsController } from '../client-requests/client-requests.controller.js';
import { RepCampaignsController } from '../rep-campaigns/rep-campaigns.controller.js';
import { RepresentantsController } from '../representants/representants.controller.js';
import { AnalyticsController } from '../analytics/analytics.controller.js';
import { BankCasesController } from './bank-cases.controller.js';
import { BankCaseStagesController } from './bank-case-stages.controller.js';
import { BankCasesExportController } from './bank-cases-export.controller.js';
import { ProspectSearchItemDto } from './dto.js';

const guard = new RolesGuard(new Reflector());

const identity = (role: Role): AuthenticatedUser => ({
  id: `usr-${role.toLowerCase()}`,
  email: `${role.toLowerCase()}@cpi.sn`,
  username: role.toLowerCase(),
  fullName: `Utilisateur ${role}`,
  role,
});

type Handler = (...args: never[]) => unknown;

function contextFor(
  controller: new (...args: never[]) => object,
  method: string,
  role: Role,
): ExecutionContext {
  const prototype = controller.prototype as Record<string, Handler>;
  const handler = prototype[method];
  if (typeof handler !== 'function') {
    throw new Error(
      `${controller.name}.${method} n’existe pas : la matrice vise une route fantôme`,
    );
  }
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user: identity(role) }) }),
  } as unknown as ExecutionContext;
}

const allows = (
  controller: new (...args: never[]) => object,
  method: string,
  role: Role,
): boolean => {
  try {
    return guard.canActivate(contextFor(controller, method, role));
  } catch (error) {
    if (error instanceof ForbiddenException) return false;
    throw error;
  }
};

/** TOUS les rôles du contrat : un rôle ajouté sans être arbitré fait rougir la matrice. */
const admitted = (controller: new (...args: never[]) => object, method: string): Role[] =>
  Object.values(Role).filter((role) => allows(controller, method, role));

const MATRICE: { controller: new (...args: never[]) => object; method: string; roles: Role[] }[] = [
  { controller: BankCasesController, method: 'list', roles: [Role.ADMIN, Role.BANQUE_FINANCE] },
  { controller: BankCasesController, method: 'create', roles: [Role.ADMIN, Role.BANQUE_FINANCE] },
  { controller: BankCasesController, method: 'overview', roles: [Role.ADMIN, Role.BANQUE_FINANCE] },
  {
    controller: BankCasesController,
    method: 'prospectSearch',
    roles: [Role.ADMIN, Role.BANQUE_FINANCE],
  },
  {
    controller: BankCasesController,
    method: 'rejectionReasons',
    roles: [Role.ADMIN, Role.BANQUE_FINANCE],
  },
  { controller: BankCasesController, method: 'get', roles: [Role.ADMIN, Role.BANQUE_FINANCE] },
  { controller: BankCasesController, method: 'update', roles: [Role.ADMIN, Role.BANQUE_FINANCE] },
  {
    controller: BankCasesController,
    method: 'transition',
    roles: [Role.ADMIN, Role.BANQUE_FINANCE],
  },
  { controller: BankCasesController, method: 'correct', roles: [Role.ADMIN] },

  {
    controller: BankCaseStagesController,
    method: 'list',
    roles: [Role.ADMIN, Role.BANQUE_FINANCE],
  },
  { controller: BankCaseStagesController, method: 'create', roles: [Role.ADMIN] },
  { controller: BankCaseStagesController, method: 'update', roles: [Role.ADMIN] },
  { controller: BankCaseStagesController, method: 'reorder', roles: [Role.ADMIN] },
  { controller: BankCaseStagesController, method: 'setActive', roles: [Role.ADMIN] },

  {
    controller: BankCasesExportController,
    method: 'bankCases',
    roles: [Role.ADMIN, Role.BANQUE_FINANCE],
  },
];

const labelled = <T extends { controller: new (...args: never[]) => object; method: string }>(
  rows: T[],
): (T & { label: string })[] =>
  rows.map((row) => ({ ...row, label: `${row.controller.name}.${row.method}` }));

describe('matrice d’autorisation du module', () => {
  it.each(labelled(MATRICE))('$label', ({ controller, method, roles }) => {
    expect(admitted(controller, method).sort()).toEqual([...roles].sort());
  });

  it('un COMMERCIAL est refusé PARTOUT dans ce module, sans exception', () => {
    for (const { controller, method } of MATRICE) {
      expect(allows(controller, method, Role.COMMERCIAL)).toBe(false);
    }
  });

  it('la matrice couvre bien TOUTES les routes des trois contrôleurs', () => {
    const routesOf = (controller: new (...args: never[]) => object): string[] =>
      Object.getOwnPropertyNames(controller.prototype).filter((name) => name !== 'constructor');

    for (const controller of [
      BankCasesController,
      BankCaseStagesController,
      BankCasesExportController,
    ]) {
      const couvertes = MATRICE.filter((row) => row.controller === controller).map(
        (row) => row.method,
      );
      expect(routesOf(controller).sort()).toEqual([...couvertes].sort());
    }
  });

  it('le décorateur de méthode surcharge bien celui de la classe', () => {
    expect(allows(BankCasesController, 'transition', Role.BANQUE_FINANCE)).toBe(true);
    expect(allows(BankCasesController, 'correct', Role.BANQUE_FINANCE)).toBe(false);

    expect(allows(BankCaseStagesController, 'list', Role.BANQUE_FINANCE)).toBe(true);
    expect(allows(BankCaseStagesController, 'create', Role.BANQUE_FINANCE)).toBe(false);
  });
});

const MATRICE_NOUVEAUX: {
  controller: new (...args: never[]) => object;
  method: string;
  roles: Role[];
}[] = [
  {
    controller: ClientRequestsController,
    method: 'create',
    roles: [Role.ADMIN, Role.BANQUE_FINANCE],
  },
  {
    controller: ClientRequestsController,
    method: 'list',
    roles: [Role.ADMIN, Role.BANQUE_FINANCE],
  },
  {
    controller: ClientRequestsController,
    method: 'get',
    roles: [Role.ADMIN, Role.BANQUE_FINANCE],
  },
  { controller: ClientRequestsController, method: 'approve', roles: [Role.ADMIN] },
  { controller: ClientRequestsController, method: 'reject', roles: [Role.ADMIN] },

  {
    controller: RepCampaignsController,
    method: 'recordAttempt',
    roles: [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION],
  },

  {
    controller: RepresentantsController,
    method: 'list',
    roles: [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION],
  },
  {
    controller: RepresentantsController,
    method: 'lookup',
    roles: [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION],
  },
  {
    controller: RepresentantsController,
    method: 'get',
    roles: [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION],
  },
  {
    controller: RepresentantsController,
    method: 'create',
    roles: [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION],
  },
  {
    controller: RepresentantsController,
    method: 'update',
    roles: [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION],
  },
  {
    controller: RepresentantsController,
    method: 'remove',
    roles: [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION],
  },
  { controller: RepresentantsController, method: 'import', roles: [Role.ADMIN] },
  {
    controller: RepresentantsController,
    method: 'relationHistory',
    roles: [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION],
  },
  {
    controller: RepresentantsController,
    method: 'callHistory',
    roles: [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION],
  },
  {
    controller: RepresentantsController,
    method: 'deviceCalls',
    roles: [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION],
  },
  {
    controller: RepresentantsController,
    method: 'listComments',
    roles: [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION],
  },
  {
    controller: RepresentantsController,
    method: 'addComment',
    roles: [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION],
  },
  { controller: RepresentantsController, method: 'removeComment', roles: [Role.ADMIN] },
];

describe('matrice d’autorisation des modules récents', () => {
  it.each(labelled(MATRICE_NOUVEAUX))('$label', ({ controller, method, roles }) => {
    expect(admitted(controller, method).sort()).toEqual([...roles].sort());
  });

  it('la matrice couvre TOUTES les routes des trois contrôleurs', () => {
    const routesOf = (controller: new (...args: never[]) => object): string[] =>
      Object.getOwnPropertyNames(controller.prototype).filter((name) => name !== 'constructor');

    for (const controller of [
      ClientRequestsController,
      RepCampaignsController,
      RepresentantsController,
    ]) {
      const couvertes = MATRICE_NOUVEAUX.filter((row) => row.controller === controller).map(
        (row) => row.method,
      );
      expect(routesOf(controller).sort()).toEqual([...couvertes].sort());
    }
  });

  it('approve et reject HÉRITENT bien du @Roles de classe', () => {
    for (const method of ['approve', 'reject']) {
      const handler = (ClientRequestsController.prototype as unknown as Record<string, unknown>)[
        method
      ];
      expect(Reflect.getMetadata(ROLES_KEY, handler as object)).toBeUndefined();

      expect(allows(ClientRequestsController, method, Role.ADMIN)).toBe(true);
      expect(allows(ClientRequestsController, method, Role.BANQUE_FINANCE)).toBe(false);
      expect(allows(ClientRequestsController, method, Role.COMMERCIAL)).toBe(false);
    }
  });

  it('le @Roles de méthode élargit là où il est posé, et nulle part ailleurs', () => {
    expect(allows(ClientRequestsController, 'create', Role.BANQUE_FINANCE)).toBe(true);
    expect(allows(ClientRequestsController, 'approve', Role.BANQUE_FINANCE)).toBe(false);
  });

  it('l’import de représentants resserre le rôle de classe', () => {
    expect(allows(RepresentantsController, 'list', Role.COMMERCIAL)).toBe(true);
    expect(allows(RepresentantsController, 'import', Role.COMMERCIAL)).toBe(false);
    expect(allows(RepresentantsController, 'import', Role.ADMIN)).toBe(true);
  });

  it('la supervision et la direction qualifient un représentant, sans toucher à l’administration', () => {
    for (const role of [Role.SUPERVISEUR, Role.DIRECTION]) {
      for (const method of ['create', 'update', 'remove', 'addComment']) {
        expect(allows(RepresentantsController, method, role), `${role}.${method}`).toBe(true);
      }
      for (const method of ['import', 'removeComment']) {
        expect(allows(RepresentantsController, method, role), `${role}.${method}`).toBe(false);
      }
    }
  });

  it('l’annuaire des représentants est fermé à l’ACCUEIL, route par route', () => {
    for (const method of Object.getOwnPropertyNames(RepresentantsController.prototype).filter(
      (name) => name !== 'constructor',
    )) {
      expect(allows(RepresentantsController, method, Role.ACCUEIL), method).toBe(false);
    }
  });

  it('l’annuaire des représentants est fermé à BANQUE_FINANCE, route par route', () => {
    for (const method of Object.getOwnPropertyNames(RepresentantsController.prototype).filter(
      (name) => name !== 'constructor',
    )) {
      expect(allows(RepresentantsController, method, Role.BANQUE_FINANCE)).toBe(false);
    }
  });

  it('le tableau de bord est fermé à Banque & Finance par la classe', () => {
    const routes = Object.getOwnPropertyNames(AnalyticsController.prototype).filter(
      (name) => name !== 'constructor',
    );
    expect(routes.length).toBeGreaterThanOrEqual(20);

    for (const method of routes) {
      // Le vieillissement des dossiers est la seule route resserree: il tient du
      // domaine bancaire, qui ne regarde pas la direction commerciale.
      const attendus =
        method === 'bankAging'
          ? [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR]
          : [Role.ADMIN, Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION];
      expect(admitted(AnalyticsController, method).sort(), method).toEqual([...attendus].sort());
      expect(allows(AnalyticsController, method, Role.BANQUE_FINANCE)).toBe(false);
      expect(allows(AnalyticsController, method, Role.ACCUEIL)).toBe(false);
    }

    expect(Reflect.getMetadata(ROLES_KEY, AnalyticsController)).toEqual([
      Role.ADMIN,
      Role.COMMERCIAL,
      Role.SUPERVISEUR,
      Role.DIRECTION,
    ]);
  });
});

describe('cloisonnement hors module', () => {
  it('l’administration des utilisateurs lui est fermée', () => {
    for (const method of Object.getOwnPropertyNames(UsersController.prototype).filter(
      (name) => name !== 'constructor',
    )) {
      expect(allows(UsersController, method, Role.BANQUE_FINANCE)).toBe(false);
      expect(allows(UsersController, method, Role.ADMIN)).toBe(true);
    }
  });

  it('l’annuaire de phase 2 lui est fermé', () => {
    expect(allows(Phase2Controller, 'pullDirectory', Role.BANQUE_FINANCE)).toBe(false);
  });

  it('la modification des référentiels lui est fermée', () => {
    for (const method of [
      'createBanque',
      'updateBanque',
      'createSyndicat',
      'updateSyndicat',
      'createDepartement',
      'updateDepartement',
    ]) {
      expect(allows(ReferentielsController, method, Role.BANQUE_FINANCE)).toBe(false);
      expect(allows(ReferentielsController, method, Role.ADMIN)).toBe(true);
    }
  });

  it('la recherche de prospects n’expose que l’identité, le téléphone et la banque', () => {
    const champs = Object.getOwnPropertyNames(new ProspectSearchItemDto()).sort();
    expect(champs).toEqual(
      ['banqueId', 'banqueName', 'fullName', 'id', 'nom', 'phoneE164', 'prenom'].sort(),
    );

    for (const interdit of [
      'createdById',
      'commercialId',
      'syndicatId',
      'representantId',
      'statut',
      'phase2Status',
      'enrollmentMethod',
      'departementId',
    ]) {
      expect(champs).not.toContain(interdit);
    }
  });
});
