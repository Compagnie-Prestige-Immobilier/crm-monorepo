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

/**
 * Matrice d'autorisation, éprouvée sur le VRAI garde.
 *
 * On n'inspecte pas la métadonnée `@Roles` : on instancie `RolesGuard` et on lui
 * présente chaque route avec chacun des trois rôles. Un test qui se contenterait
 * de lire la métadonnée passerait encore si le garde était retiré des providers
 * globaux, ou si sa logique de surcharge classe/méthode était inversée, or
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

/**
 * Rangées étiquetées.
 *
 * `it.each` ne sait pas déréférencer `$controller.name` : chaque rangée
 * s'affichait « undefined », si bien qu'une matrice au rouge ne disait pas
 * QUELLE route avait changé de rôle. On calcule donc le libellé ici.
 */
const labelled = <T extends { controller: new (...args: never[]) => object; method: string }>(
  rows: T[],
): (T & { label: string })[] =>
  rows.map((row) => ({ ...row, label: `${row.controller.name}.${row.method}` }));

describe('matrice d’autorisation du module', () => {
  it.each(labelled(MATRICE))('$label', ({ controller, method, roles }) => {
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
   * ajoute pas, `getAllAndOverride` prend la première valeur trouvée. Un agent
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
// Les modules arrivés après cette matrice
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Même méthode, mêmes garanties, étendues aux quatre contrôleurs récents.
 *
 * Chaque bloc fige l'INVENTAIRE COMPLET des routes du contrôleur : une route
 * ajoutée demain sans être inscrite ici met le test au rouge, ce qui est le
 * seul moyen d'empêcher qu'elle naisse sans rôle et sans que personne ne s'en
 * aperçoive.
 */
const MATRICE_NOUVEAUX: {
  controller: new (...args: never[]) => object;
  method: string;
  roles: Role[];
}[] = [
  // ── Demandes de création de client ────────────────────────────────────────
  // La classe porte @Roles(ADMIN) ; trois routes l'ÉLARGISSENT à
  // BANQUE_FINANCE, deux la laissent telle quelle.
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
  // Approuver CRÉE un prospect réel dans l'annuaire commercial ; rejeter ferme
  // définitivement la demande. Les deux HÉRITENT du rôle de classe.
  { controller: ClientRequestsController, method: 'approve', roles: [Role.ADMIN] },
  { controller: ClientRequestsController, method: 'reject', roles: [Role.ADMIN] },

  // ── Campagnes d'appel des représentants ───────────────────────────────────
  { controller: RepCampaignsController, method: 'preview', roles: [Role.ADMIN] },
  { controller: RepCampaignsController, method: 'list', roles: [Role.ADMIN] },
  { controller: RepCampaignsController, method: 'create', roles: [Role.ADMIN] },
  { controller: RepCampaignsController, method: 'get', roles: [Role.ADMIN] },
  { controller: RepCampaignsController, method: 'close', roles: [Role.ADMIN] },
  { controller: RepCampaignsController, method: 'downloadProgramme', roles: [Role.ADMIN] },
  // Seule route ouverte au terrain : c'est le commercial qui SAISIT l'issue de
  // son appel.
  {
    controller: RepCampaignsController,
    method: 'recordAttempt',
    roles: [Role.ADMIN, Role.COMMERCIAL],
  },

  // ── Annuaire des représentants ────────────────────────────────────────────
  {
    controller: RepresentantsController,
    method: 'list',
    roles: [Role.ADMIN, Role.COMMERCIAL],
  },
  {
    controller: RepresentantsController,
    method: 'lookup',
    roles: [Role.ADMIN, Role.COMMERCIAL],
  },
  { controller: RepresentantsController, method: 'get', roles: [Role.ADMIN, Role.COMMERCIAL] },
  { controller: RepresentantsController, method: 'create', roles: [Role.ADMIN, Role.COMMERCIAL] },
  { controller: RepresentantsController, method: 'update', roles: [Role.ADMIN, Role.COMMERCIAL] },
  { controller: RepresentantsController, method: 'remove', roles: [Role.ADMIN, Role.COMMERCIAL] },
  // L'import de masse écrit des milliers de fiches en une transaction : il
  // RESSERRE le rôle de classe au lieu de l'hériter.
  { controller: RepresentantsController, method: 'import', roles: [Role.ADMIN] },
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

  /**
   * L'HÉRITAGE, éprouvé et non supposé.
   *
   * `approve` et `reject` ne portent aucun `@Roles` : elles dépendent
   * entièrement de celui de la classe. Un test qui lirait la métadonnée de la
   * MÉTHODE ne trouverait rien et conclurait « route ouverte » ou « route
   * fermée » selon l'humeur de son auteur. Ici c'est le garde qui répond, avec
   * la même chaîne `getAllAndOverride` qu'en production : si quelqu'un retire
   * le `@Roles` de la classe, ces deux lignes tombent, et elles seules.
   */
  it('approve et reject HÉRITENT bien du @Roles de classe', () => {
    for (const method of ['approve', 'reject']) {
      // La métadonnée de méthode est bien absente : l'héritage est le SEUL
      // mécanisme en jeu.
      const handler = (ClientRequestsController.prototype as unknown as Record<string, unknown>)[
        method
      ];
      expect(Reflect.getMetadata(ROLES_KEY, handler as object)).toBeUndefined();

      expect(allows(ClientRequestsController, method, Role.ADMIN)).toBe(true);
      expect(allows(ClientRequestsController, method, Role.BANQUE_FINANCE)).toBe(false);
      expect(allows(ClientRequestsController, method, Role.COMMERCIAL)).toBe(false);
    }
  });

  /**
   * Le symétrique : `create`, `list` et `get` du MÊME contrôleur portent leur
   * propre `@Roles`, qui REMPLACE celui de la classe au lieu de s'y ajouter.
   * Un agent BANQUE_FINANCE dépose donc une demande sans pouvoir l'approuver.
   */
  it('le @Roles de méthode élargit là où il est posé, et nulle part ailleurs', () => {
    expect(allows(ClientRequestsController, 'create', Role.BANQUE_FINANCE)).toBe(true);
    expect(allows(ClientRequestsController, 'approve', Role.BANQUE_FINANCE)).toBe(false);
  });

  /**
   * L'import écrit en masse dans l'annuaire. Le `@Roles(Role.ADMIN)` posé sur
   * la méthode doit RESTREINDRE le `@Roles(COMMERCIAL, ADMIN)` de la classe :
   * c'est la surcharge dans le sens qui ferme, et non dans celui qui ouvre.
   */
  it('l’import de représentants resserre le rôle de classe', () => {
    expect(allows(RepresentantsController, 'list', Role.COMMERCIAL)).toBe(true);
    expect(allows(RepresentantsController, 'import', Role.COMMERCIAL)).toBe(false);
    expect(allows(RepresentantsController, 'import', Role.ADMIN)).toBe(true);
  });

  /** Un agent BANQUE_FINANCE n'a rien à faire dans l'annuaire de prospection. */
  it('l’annuaire des représentants est fermé à BANQUE_FINANCE, route par route', () => {
    for (const method of Object.getOwnPropertyNames(RepresentantsController.prototype).filter(
      (name) => name !== 'constructor',
    )) {
      expect(allows(RepresentantsController, method, Role.BANQUE_FINANCE)).toBe(false);
    }
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * Le tableau de bord est fermé à BANQUE_FINANCE, au niveau de la CLASSE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Ce contrôleur n'a longtemps porté AUCUN `@Roles`, et `RolesGuard` laisse
   * passer toute identité authentifiée en l'absence de décorateur : les
   * dix-neuf routes étaient donc ouvertes aux trois rôles.
   *
   * Rien n'a fuité pour autant, parce que `prospectConditions` épingle
   * `p."createdById"` pour tout non-ADMIN et qu'un compte bancaire ne crée
   * aucun prospect : il ne lisait que des ensembles vides. Mais cette
   * protection était une propriété de CHAQUE requête, pas une règle du
   * contrôleur. La première route d'analyse écrite sans ce helper aurait ouvert
   * les dix-huit autres, et rien n'aurait signalé la régression.
   *
   * Le test porte donc sur le garde-fou lui-même, pas sur ses conséquences.
   */
  it('le tableau de bord est fermé à Banque & Finance par la classe', () => {
    const routes = Object.getOwnPropertyNames(AnalyticsController.prototype).filter(
      (name) => name !== 'constructor',
    );
    // Garde-fou : une classe vide ferait passer la boucle à vide.
    expect(routes.length).toBeGreaterThanOrEqual(19);

    for (const method of routes) {
      expect(admitted(AnalyticsController, method).sort()).toEqual(
        [Role.ADMIN, Role.COMMERCIAL].sort(),
      );
      expect(allows(AnalyticsController, method, Role.BANQUE_FINANCE)).toBe(false);
    }

    // La règle vit sur la CLASSE : aucune route ne doit la redéclarer, sinon
    // une nouvelle route sans décorateur hériterait silencieusement du vide.
    expect(Reflect.getMetadata(ROLES_KEY, AnalyticsController)).toEqual([
      Role.ADMIN,
      Role.COMMERCIAL,
    ]);
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
   * le statut de prospection et l'historique d'appels n'y figurent pas, ils ne
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
