import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { UsersController } from '../users/users.controller.js';
import { Phase2Controller } from '../phase2/phase2.controller.js';
import { ReferentielsController } from '../referentiels/referentiels.controller.js';
import { BankCasesController } from './bank-cases.controller.js';
import { BankCaseStagesController } from './bank-case-stages.controller.js';
import { BankCasesExportController } from './bank-cases-export.controller.js';
import { ProspectSearchItemDto } from './dto.js';

/**
 * Matrice d'autorisation, éprouvée sur le VRAI garde.
 *
 * On n'inspecte pas la métadonnée `@Roles` : on instancie `RolesGuard` et on lui
 * présente chaque route avec chacun des trois rôles. Un test qui se contenterait
 * de lire la métadonnée passerait encore si le garde était retiré des providers
 * globaux, ou si sa logique de surcharge classe/méthode était inversée — or
 * c'est précisément cette surcharge qui décide qui peut corriger un dossier
 * encaissé.
 */

const guard = new RolesGuard(new Reflector());

const identity = (role: Role): AuthenticatedUser => ({
  id: `usr-${role.toLowerCase()}`,
  email: `${role.toLowerCase()}@cpi.sn`,
  username: role.toLowerCase(),
  fullName: `Utilisateur ${role}`,
  role,
});

type Handler = (...args: never[]) => unknown;

/** Contexte d'exécution minimal : exactement ce que `RolesGuard` consulte. */
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

/** Rôles effectivement admis sur une route, calculés par le garde. */
const admitted = (controller: new (...args: never[]) => object, method: string): Role[] =>
  [Role.ADMIN, Role.BANQUE_FINANCE, Role.COMMERCIAL].filter((role) =>
    allows(controller, method, role),
  );

// ─────────────────────────────────────────────────────────────────────────────
// Le module Banque & Finance
// ─────────────────────────────────────────────────────────────────────────────

/** Toutes les routes du module, avec les rôles attendus. Exhaustive à dessein. */
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
  // La correction est le seul point du module réservé à l'ADMIN.
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

describe('matrice d’autorisation du module', () => {
  it.each(MATRICE)('$controller.name.$method', ({ controller, method, roles }) => {
    expect(admitted(controller, method).sort()).toEqual([...roles].sort());
  });

  /**
   * Un COMMERCIAL fait de la prospection terrain. Il n'a aucune raison de voir
   * les montants encaissés, ni les motifs de rejet des banques.
   */
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

  /**
   * `@Roles(Role.ADMIN)` sur la méthode REMPLACE celui de la classe, il ne s'y
   * ajoute pas — `getAllAndOverride` prend la première valeur trouvée. Un agent
   * BANQUE_FINANCE est donc refusé sur la correction alors qu'il passe sur la
   * transition ordinaire du même contrôleur.
   */
  it('le décorateur de méthode surcharge bien celui de la classe', () => {
    expect(allows(BankCasesController, 'transition', Role.BANQUE_FINANCE)).toBe(true);
    expect(allows(BankCasesController, 'correct', Role.BANQUE_FINANCE)).toBe(false);

    expect(allows(BankCaseStagesController, 'list', Role.BANQUE_FINANCE)).toBe(true);
    expect(allows(BankCaseStagesController, 'create', Role.BANQUE_FINANCE)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ce que l'agent Banque & Finance ne doit PAS atteindre ailleurs
// ─────────────────────────────────────────────────────────────────────────────

describe('cloisonnement hors module', () => {
  it('l’administration des utilisateurs lui est fermée', () => {
    for (const method of Object.getOwnPropertyNames(UsersController.prototype).filter(
      (name) => name !== 'constructor',
    )) {
      expect(allows(UsersController, method, Role.BANQUE_FINANCE)).toBe(false);
      expect(allows(UsersController, method, Role.ADMIN)).toBe(true);
    }
  });

  it('les campagnes d’appels lui sont fermées', () => {
    for (const method of ['listCampaigns', 'createCampaign', 'getCampaign', 'closeCampaign']) {
      expect(allows(Phase2Controller, method, Role.BANQUE_FINANCE)).toBe(false);
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

  /**
   * La confidentialité de la fiche prospect ne se joue pas sur un garde de rôle
   * mais sur la PROJECTION : `prospect-search` est le seul accès aux prospects
   * offert par ce module, et il ne rend que l'identité, le téléphone et la
   * banque courante. Le commercial propriétaire, le syndicat, le représentant,
   * le statut de prospection et l'historique d'appels n'y figurent pas — ils ne
   * sont pas filtrés côté client, ils ne sont jamais lus.
   */
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
