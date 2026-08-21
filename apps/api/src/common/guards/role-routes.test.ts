import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { RolesGuard } from './roles.guard.js';
import type { AuthenticatedUser } from '../decorators/current-user.decorator.js';
import { AdminController } from '../../modules/admin/admin.controller.js';
import { AnalyticsController } from '../../modules/analytics/analytics.controller.js';
import { AppUpdatesController } from '../../modules/app-updates/app-updates.controller.js';
import { AuthController } from '../../modules/auth/auth.controller.js';
import { BankCaseStagesController } from '../../modules/bank-cases/bank-case-stages.controller.js';
import { BankCasesController } from '../../modules/bank-cases/bank-cases.controller.js';
import { BankCasesExportController } from '../../modules/bank-cases/bank-cases-export.controller.js';
import { CallbacksController } from '../../modules/callbacks/callbacks.controller.js';
import { ClientRequestsController } from '../../modules/client-requests/client-requests.controller.js';
import { DbDumpController } from '../../modules/db-dump/db-dump.controller.js';
import { DemoController } from '../../modules/demo/demo.controller.js';
import { ExportController } from '../../modules/export/export.controller.js';
import { HealthController } from '../../modules/health/health.controller.js';
import { ImportsController } from '../../modules/imports/imports.controller.js';
import { NotificationsController } from '../../modules/notifications/notifications.controller.js';
import { NotificationTemplatesController } from '../../modules/notifications/templates.controller.js';
import { Phase2Controller } from '../../modules/phase2/phase2.controller.js';
import { ProspectsController } from '../../modules/prospects/prospects.controller.js';
import { ReferentielsController } from '../../modules/referentiels/referentiels.controller.js';
import { RepCampaignsController } from '../../modules/rep-campaigns/rep-campaigns.controller.js';
import { RepresentantsController } from '../../modules/representants/representants.controller.js';
import { SuggestionsController } from '../../modules/suggestions/suggestions.controller.js';
import { SupervisionController } from '../../modules/analytics/supervision.controller.js';
import { SyncController } from '../../modules/sync/sync.controller.js';
import { CallOutcomeReasonsController } from '../../modules/referentiels/call-outcome-reasons.controller.js';
import { VisitesController } from '../../modules/visites/visites.controller.js';
import { UsersController } from '../../modules/users/users.controller.js';

type Controller = new (...args: never[]) => object;

const CONTROLLERS: readonly Controller[] = [
  AdminController,
  AnalyticsController,
  AppUpdatesController,
  AuthController,
  BankCaseStagesController,
  BankCasesController,
  BankCasesExportController,
  CallbacksController,
  CallOutcomeReasonsController,
  ClientRequestsController,
  DbDumpController,
  DemoController,
  ExportController,
  HealthController,
  ImportsController,
  NotificationsController,
  NotificationTemplatesController,
  Phase2Controller,
  ProspectsController,
  ReferentielsController,
  RepCampaignsController,
  RepresentantsController,
  SuggestionsController,
  SupervisionController,
  SyncController,
  UsersController,
  VisitesController,
];

/**
 * TOUT ce qu'un SUPERVISEUR atteint, nommément.
 *
 * Le rôle est un rôle de LECTURE : la liste est donc aussi la preuve de ce
 * qu'il n'atteint pas. Une route ouverte sans figurer ici fait rougir le
 * balayage, y compris une route ajoutée demain sous un `@Roles` de classe.
 */
const ADMISES: readonly string[] = [
  'AdminController.supervisionOverview',

  'AnalyticsController.ambassadorConversion',
  'AnalyticsController.bankAging',
  'AnalyticsController.byBanque',
  'AnalyticsController.byDepartement',
  'AnalyticsController.byEnrollmentMethod',
  'AnalyticsController.byPhase2Status',
  'AnalyticsController.bySegment',
  'AnalyticsController.bySyndicat',
  'AnalyticsController.campaignPilotage',
  'AnalyticsController.dataQuality',
  'AnalyticsController.delays',
  'AnalyticsController.departementYield',
  'AnalyticsController.funnel',
  'AnalyticsController.originBreakdown',
  'AnalyticsController.overTime',
  'AnalyticsController.representantProductivity',
  'AnalyticsController.segmentConversions',
  'AnalyticsController.topCommercials',
  'AnalyticsController.topRepresentants',
  'AnalyticsController.totals',
  'AnalyticsController.weeklyCohorts',

  // Routes `@Public` : sans `@Roles`, elles précèdent toute notion de rôle.
  'AppUpdatesController.current',
  'AppUpdatesController.download',
  'AuthController.login',
  'AuthController.logout',
  'AuthController.refresh',
  'HealthController.live',
  'HealthController.ready',

  'AuthController.me',
  'CallOutcomeReasonsController.list',
  'CallbacksController.list',
  'AuthController.switchWorkspace',
  'NotificationsController.mine',
  'NotificationsController.markRead',

  'Phase2Controller.getCampaign',
  'Phase2Controller.listCampaigns',
  'Phase2Controller.downloadProgramme',
  // Lecture seule: un superviseur ecoute une note audio, il n'en televerse pas.
  'Phase2Controller.downloadRecording',

  'ProspectsController.get',
  'ProspectsController.list',

  'ReferentielsController.bundle',
  'ReferentielsController.listBanques',
  'ReferentielsController.listCanauxProvenance',
  'ReferentielsController.listDepartements',
  'ReferentielsController.listIefs',
  'ReferentielsController.listRegions',
  'ReferentielsController.listRegionsWithDepartements',
  'ReferentielsController.listSyndicats',

  'RepCampaignsController.get',
  'RepCampaignsController.list',
  'RepCampaignsController.downloadProgramme',

  'RepresentantsController.get',
  'RepresentantsController.list',
  'RepresentantsController.listComments',
  'RepresentantsController.relationHistory',

  'SuggestionsController.list',

  'SupervisionController.activite',
  'UsersController.list',
  'VisitesController.bundle',
];

/**
 * Ce que TOUT compte atteint : son identité, les référentiels, ses
 * notifications. C'est aussi, à une route près, tout ce que l'ACCUEIL atteint
 * en dehors du registre.
 */
const SOCLE: readonly string[] = [
  'AppUpdatesController.current',
  'AppUpdatesController.download',
  'AuthController.login',
  'AuthController.logout',
  'AuthController.me',
  'AuthController.refresh',
  'CallOutcomeReasonsController.list',
  'AuthController.switchWorkspace',
  'HealthController.live',
  'HealthController.ready',
  'NotificationsController.markRead',
  'NotificationsController.mine',
  'ReferentielsController.bundle',
  'ReferentielsController.listBanques',
  'ReferentielsController.listCanauxProvenance',
  'ReferentielsController.listDepartements',
  'ReferentielsController.listIefs',
  'ReferentielsController.listRegions',
  'ReferentielsController.listRegionsWithDepartements',
  'ReferentielsController.listSyndicats',
  'VisitesController.bundle',
];

/** Le registre lui-même : ce que l'ACCUEIL tient, et que la DIRECTION relit. */
const REGISTRE: readonly string[] = [
  'VisitesController.create',
  'VisitesController.get',
  'VisitesController.list',
  'VisitesController.statistiques',
  'VisitesController.update',
];

/**
 * L'ACCUEIL, c'est le comptoir : le registre, et rien d'autre. Ni prospect, ni
 * représentant, ni statistique d'appel.
 */
const ADMISES_ACCUEIL: readonly string[] = [...SOCLE, ...REGISTRE];

/**
 * La DIRECTION lit ce que lit la supervision, tient le registre avec l'accueil,
 * administre les quatre listes qui l'alimentent et exporte ce qu'elle lit. Elle
 * n'ouvre aucun compte et ne purge rien.
 */
const ADMISES_DIRECTION: readonly string[] = [
  ...ADMISES.filter((route) => route !== 'AnalyticsController.bankAging'),
  ...REGISTRE,
  'ExportController.prospects',
  'ExportController.representantsExport',
  'VisitesController.createReferentiel',
  'VisitesController.listReferentiel',
  'VisitesController.reorderReferentiel',
  'VisitesController.setReferentielActive',
  'VisitesController.updateReferentiel',
];

const guard = new RolesGuard(new Reflector());

const identityOf = (role: Role): AuthenticatedUser => ({
  id: `${role}-1`,
  email: `${role}@cpi.sn`,
  username: role,
  fullName: 'Awa Sy',
  role,
});

const routesOf = (controller: Controller): string[] =>
  Object.getOwnPropertyNames(controller.prototype).filter((name) => name !== 'constructor');

function allowsAs(role: Role, controller: Controller, method: string): boolean {
  const handler = (controller.prototype as Record<string, unknown>)[method];
  const context = {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user: identityOf(role) }) }),
  } as unknown as ExecutionContext;

  try {
    return guard.canActivate(context);
  } catch (error) {
    if (error instanceof ForbiddenException) return false;
    throw error;
  }
}

const allows = (controller: Controller, method: string): boolean =>
  allowsAs(Role.SUPERVISEUR, controller, method);

const ouvertesDe = (role: Role): string[] =>
  CONTROLLERS.flatMap((controller) =>
    routesOf(controller)
      .filter((method) => allowsAs(role, controller, method))
      .map((method) => `${controller.name}.${method}`),
  ).sort();

const ouvertes = (): string[] => ouvertesDe(Role.SUPERVISEUR);

describe('ce qu’un SUPERVISEUR atteint, route par route', () => {
  it('exactement l’inventaire, ni plus ni moins', () => {
    expect(ouvertes()).toEqual([...ADMISES].sort());
  });

  it('chaque route de l’inventaire existe encore', () => {
    const connues = new Set(
      CONTROLLERS.flatMap((controller) =>
        routesOf(controller).map((method) => `${controller.name}.${method}`),
      ),
    );

    expect(ADMISES.filter((route) => !connues.has(route))).toEqual([]);
  });

  it('LA SYNCHRONISATION MOBILE LUI EST FERMÉE, poussée comme tirage', () => {
    for (const method of routesOf(SyncController)) {
      expect(allows(SyncController, method), `sync.${method}`).toBe(false);
    }
  });

  it('n’écrit aucune fiche, n’émet aucune notification, ne purge rien', () => {
    for (const method of ['create', 'update', 'remove', 'merge', 'reassign', 'changeSegment']) {
      expect(allows(ProspectsController, method), `prospects.${method}`).toBe(false);
    }
    for (const method of ['create', 'update', 'remove', 'import', 'addComment', 'removeComment']) {
      expect(allows(RepresentantsController, method), `representants.${method}`).toBe(false);
    }
    expect(allows(SuggestionsController, 'setStatus')).toBe(false);
    for (const method of routesOf(NotificationTemplatesController)) {
      expect(allows(NotificationTemplatesController, method), `gabarits.${method}`).toBe(false);
    }
    expect(allows(AdminController, 'purge')).toBe(false);
    expect(allows(AdminController, 'catalog')).toBe(false);
    expect(allows(CallbacksController, 'cancel')).toBe(false);
  });

  it('n’administre aucun compte, alors qu’il en lit la liste', () => {
    expect(allows(UsersController, 'list')).toBe(true);
    for (const method of routesOf(UsersController).filter((name) => name !== 'list')) {
      expect(allows(UsersController, method), `users.${method}`).toBe(false);
    }
  });

  it('reste hors du domaine bancaire', () => {
    for (const controller of [
      BankCasesController,
      BankCaseStagesController,
      BankCasesExportController,
      ClientRequestsController,
    ]) {
      for (const method of routesOf(controller)) {
        expect(allows(controller, method), `${controller.name}.${method}`).toBe(false);
      }
    }
  });
});

describe('ce qu’un compte d’ACCUEIL atteint, route par route', () => {
  it('exactement l’inventaire, ni plus ni moins', () => {
    expect(ouvertesDe(Role.ACCUEIL)).toEqual([...ADMISES_ACCUEIL].sort());
  });

  it('ne voit ni prospect, ni représentant, ni statistique d’appel', () => {
    for (const controller of [
      AnalyticsController,
      ProspectsController,
      RepresentantsController,
      RepCampaignsController,
      Phase2Controller,
      SupervisionController,
      SuggestionsController,
      CallbacksController,
      SyncController,
      UsersController,
    ]) {
      for (const method of routesOf(controller)) {
        expect(allowsAs(Role.ACCUEIL, controller, method), `${controller.name}.${method}`).toBe(
          false,
        );
      }
    }
  });

  it('n’administre pas les listes qu’il utilise', () => {
    for (const method of [
      'listReferentiel',
      'createReferentiel',
      'updateReferentiel',
      'setReferentielActive',
      'reorderReferentiel',
    ]) {
      expect(allowsAs(Role.ACCUEIL, VisitesController, method), `visites.${method}`).toBe(false);
    }
  });
});

describe('ce qu’une DIRECTION atteint, route par route', () => {
  it('exactement l’inventaire, ni plus ni moins', () => {
    expect(ouvertesDe(Role.DIRECTION)).toEqual([...ADMISES_DIRECTION].sort());
  });

  it('lit tout ce que lit la supervision, hors dossiers bancaires', () => {
    const direction = new Set(ouvertesDe(Role.DIRECTION));
    expect(ouvertesDe(Role.SUPERVISEUR).filter((route) => !direction.has(route))).toEqual([
      'AnalyticsController.bankAging',
    ]);
  });

  it('reste hors du domaine bancaire', () => {
    for (const controller of [
      BankCasesController,
      BankCaseStagesController,
      BankCasesExportController,
      ClientRequestsController,
    ]) {
      for (const method of routesOf(controller)) {
        expect(allowsAs(Role.DIRECTION, controller, method), `${controller.name}.${method}`).toBe(
          false,
        );
      }
    }
    expect(allowsAs(Role.DIRECTION, AnalyticsController, 'bankAging')).toBe(false);
  });

  it('LA SYNCHRONISATION MOBILE LUI EST FERMÉE, poussée comme tirage', () => {
    for (const method of routesOf(SyncController)) {
      expect(allowsAs(Role.DIRECTION, SyncController, method), `sync.${method}`).toBe(false);
    }
  });

  it('n’ouvre aucun compte, ne purge rien, n’émet aucune notification', () => {
    for (const method of routesOf(UsersController).filter((name) => name !== 'list')) {
      expect(allowsAs(Role.DIRECTION, UsersController, method), `users.${method}`).toBe(false);
    }
    expect(allowsAs(Role.DIRECTION, AdminController, 'purge')).toBe(false);
    expect(allowsAs(Role.DIRECTION, AdminController, 'catalog')).toBe(false);
    for (const method of routesOf(NotificationTemplatesController)) {
      expect(allowsAs(Role.DIRECTION, NotificationTemplatesController, method)).toBe(false);
    }
    for (const method of ['create', 'update', 'remove', 'merge', 'reassign', 'changeSegment']) {
      expect(allowsAs(Role.DIRECTION, ProspectsController, method), `prospects.${method}`).toBe(
        false,
      );
    }
    for (const method of routesOf(ImportsController)) {
      expect(allowsAs(Role.DIRECTION, ImportsController, method), `imports.${method}`).toBe(false);
    }
  });
});
