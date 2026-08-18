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
  'CallbacksController.list',
  'DemoController.status',
  'NotificationsController.mine',
  'NotificationsController.markRead',

  'Phase2Controller.getCampaign',
  'Phase2Controller.listCampaigns',
  'Phase2Controller.downloadProgramme',

  'ProspectsController.get',
  'ProspectsController.list',

  'ReferentielsController.bundle',
  'ReferentielsController.listBanques',
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
];

const guard = new RolesGuard(new Reflector());

const identity: AuthenticatedUser = {
  id: 'sup-1',
  email: 'sup@cpi.sn',
  username: 'sup',
  fullName: 'Awa Sy',
  role: Role.SUPERVISEUR,
};

const routesOf = (controller: Controller): string[] =>
  Object.getOwnPropertyNames(controller.prototype).filter((name) => name !== 'constructor');

function allows(controller: Controller, method: string): boolean {
  const handler = (controller.prototype as Record<string, unknown>)[method];
  const context = {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user: identity }) }),
  } as unknown as ExecutionContext;

  try {
    return guard.canActivate(context);
  } catch (error) {
    if (error instanceof ForbiddenException) return false;
    throw error;
  }
}

const ouvertes = (): string[] =>
  CONTROLLERS.flatMap((controller) =>
    routesOf(controller)
      .filter((method) => allows(controller, method))
      .map((method) => `${controller.name}.${method}`),
  ).sort();

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
