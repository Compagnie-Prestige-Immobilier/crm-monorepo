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
import { StatutsQualificationController } from '../../modules/referentiels/statuts-qualification.controller.js';
import { SupervisionController } from '../../modules/analytics/supervision.controller.js';
import { SyncController } from '../../modules/sync/sync.controller.js';
import { CallOutcomeReasonsController } from '../../modules/referentiels/call-outcome-reasons.controller.js';
import { VisitesController } from '../../modules/visites/visites.controller.js';
import { VisitesImportController } from '../../modules/visites/visites-import.controller.js';
import { DashboardsController } from '../../modules/dashboards/dashboards.controller.js';
import { UsersController } from '../../modules/users/users.controller.js';
import { LotsExportController } from '../../modules/lots-export/lots-export.controller.js';

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
  DashboardsController,
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
  StatutsQualificationController,
  SupervisionController,
  SyncController,
  UsersController,
  VisitesController,
  VisitesImportController,
  LotsExportController,
];

/**
 * LES TROIS ÉTAPES : qualifier un représentant, ajouter un prospect, le
 * convertir. La supervision et la direction les mènent elles-mêmes ; ce que
 * chacune écrit reste borné à ses propres fiches par `assertOwnership`, et son
 * tirage à ses propres prospects par `mineOrAssignedProspect`.
 */
const TROIS_ETAPES: readonly string[] = [
  'Phase2Controller.pullDirectory',
  'Phase2Controller.uploadRecording',

  // La console d'appel POSTE la tentative sur `/sync/push` : sans ces deux
  // routes, l'écran de l'étape 3 n'enregistre rien.
  'SyncController.pull',
  'SyncController.push',

  'ProspectsController.create',
  'ProspectsController.remove',
  'ProspectsController.update',

  'RepCampaignsController.recordAttempt',

  // Le périmètre d'appel de l'appelant : le téléphone en a besoin pour borner
  // son tirage, quel que soit le rôle qui mène les trois étapes.
  'LotsExportController.mesAttributions',

  'RepresentantsController.addComment',
  'RepresentantsController.create',
  'RepresentantsController.lookup',
  'RepresentantsController.remove',
  'RepresentantsController.update',

  // L'encadrement tranche les numéros suggérés comme le téléconseiller.
  'SuggestionsController.setStatus',
];

/**
 * Ranger son propre écran de chiffres. Aucune donnée métier n'y passe : la
 * disposition ne dit que l'ordre des cartes de qui la sauvegarde.
 */
const DISPOSITION: readonly string[] = [
  'DashboardsController.get',
  'DashboardsController.put',
  'DashboardsController.remove',
];

/**
 * TOUT ce qu'un SUPERVISEUR atteint, nommément.
 *
 * Hors des trois étapes, le rôle reste un rôle de LECTURE : la liste est donc
 * aussi la preuve de ce qu'il n'atteint pas. Une route ouverte sans figurer ici
 * fait rougir le balayage, y compris une route ajoutée demain sous un `@Roles`
 * de classe.
 */
const ADMISES: readonly string[] = [
  ...TROIS_ETAPES,

  'AdminController.supervisionOverview',

  'AnalyticsController.ambassadorConversion',
  'AnalyticsController.bankAging',
  'AnalyticsController.byBanque',
  'AnalyticsController.byDepartement',
  'AnalyticsController.byEnrollmentMethod',
  'AnalyticsController.byPhase2Status',
  'AnalyticsController.bySegment',
  'AnalyticsController.bySyndicat',
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

  'AuthController.changeMyPassword',
  'AuthController.me',
  'CallOutcomeReasonsController.list',
  'StatutsQualificationController.list',
  'CallbacksController.list',
  'AuthController.switchWorkspace',
  'NotificationsController.mine',
  'NotificationsController.markRead',

  // Lecture seule: un superviseur ecoute une note audio, il n'en televerse pas.
  'Phase2Controller.downloadRecording',

  'ProspectsController.get',
  'ProspectsController.list',

  'ReferentielsController.bundle',
  'ReferentielsController.listBanques',
  'ReferentielsController.listCanauxProvenance',
  'ReferentielsController.listDepartements',
  'ReferentielsController.listEmployeurs',
  'ReferentielsController.listIefs',
  'ReferentielsController.listIncomeBands',
  'ReferentielsController.listOffers',
  'ReferentielsController.listPays',
  'ReferentielsController.listProfessions',
  'ReferentielsController.listRegions',
  'ReferentielsController.listRegionsWithDepartements',
  'ReferentielsController.listSyndicats',

  'LotsExportController.list',
  'LotsExportController.get',
  'LotsExportController.xlsx',
  'LotsExportController.programme',
  'LotsExportController.programmesZip',
  'ExportController.representantsExport',

  'RepresentantsController.get',
  'RepresentantsController.list',
  'RepresentantsController.listComments',
  'RepresentantsController.relationHistory',

  'SuggestionsController.list',

  'SupervisionController.activite',
  'UsersController.list',
  'VisitesController.bundle',
  ...DISPOSITION,
];

/**
 * Ce que TOUT compte atteint : son identité, les référentiels, ses
 * notifications. C'est aussi, à une route près, tout ce que l'ACCUEIL atteint
 * en dehors du registre.
 */
const SOCLE: readonly string[] = [
  'AppUpdatesController.current',
  'AppUpdatesController.download',
  'AuthController.changeMyPassword',
  'AuthController.login',
  'AuthController.logout',
  'AuthController.me',
  'AuthController.refresh',
  'CallOutcomeReasonsController.list',
  'StatutsQualificationController.list',
  'AuthController.switchWorkspace',
  'HealthController.live',
  'HealthController.ready',
  'NotificationsController.markRead',
  'NotificationsController.mine',
  'ReferentielsController.bundle',
  'ReferentielsController.listBanques',
  'ReferentielsController.listCanauxProvenance',
  'ReferentielsController.listDepartements',
  'ReferentielsController.listEmployeurs',
  'ReferentielsController.listIefs',
  'ReferentielsController.listIncomeBands',
  'ReferentielsController.listOffers',
  'ReferentielsController.listPays',
  'ReferentielsController.listProfessions',
  'ReferentielsController.listRegions',
  'ReferentielsController.listRegionsWithDepartements',
  'ReferentielsController.listSyndicats',
  'VisitesController.bundle',
];

/** Le registre lui-même : ce que l'ACCUEIL tient, et que la DIRECTION relit. */
const REGISTRE: readonly string[] = [
  'ExportController.visitesExportRoute',
  'VisitesController.create',
  'VisitesController.get',
  'VisitesController.list',
  'VisitesController.statistiques',
  'VisitesController.update',
];

/**
 * L'ACCUEIL, c'est le comptoir : le registre, et rien d'autre. Ni prospect, ni
 * représentant, ni statistique d'appel.
 *
 * La synchronisation en fait partie : le comptoir saisit sur un téléphone, et
 * `VISITE_REGISTRE_ROLES` ne servait à rien tant que `/sync` lui répondait 403.
 * Sa portée reste `mineOrAssigned*` — il ne tire aucun portefeuille.
 */
const ADMISES_ACCUEIL: readonly string[] = [
  ...SOCLE,
  ...REGISTRE,
  ...DISPOSITION,
  'SyncController.pull',
  'SyncController.push',
];

/**
 * La DIRECTION lit ce que lit la supervision, mène les trois étapes comme elle,
 * tient le registre avec l'accueil, administre les quatre listes qui
 * l'alimentent et exporte ce qu'elle lit. Elle n'ouvre aucun compte et ne purge
 * rien.
 */
const ADMISES_DIRECTION: readonly string[] = [
  ...ADMISES.filter((route) => route !== 'AnalyticsController.bankAging'),
  ...REGISTRE,
  'ExportController.prospects',
  'VisitesController.createReferentiel',
  'VisitesController.listReferentiel',
  'VisitesController.reorderReferentiel',
  'VisitesController.setReferentielActive',
  'VisitesController.updateReferentiel',
  'VisitesController.usage',
  'VisitesImportController.apply',
  'VisitesImportController.create',
  'VisitesImportController.get',
  'VisitesImportController.revue',
  'VisitesImportController.setSelection',
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

  it('SYNCHRONISE SON PROPRE TRAVAIL, poussée comme tirage', () => {
    for (const method of routesOf(SyncController)) {
      expect(allows(SyncController, method), `sync.${method}`).toBe(true);
    }
  });

  it('mène les trois étapes, sans fusionner, réattribuer ni importer', () => {
    for (const method of ['create', 'update', 'remove']) {
      expect(allows(ProspectsController, method), `prospects.${method}`).toBe(true);
    }
    for (const method of ['merge', 'reassign', 'changeSegment']) {
      expect(allows(ProspectsController, method), `prospects.${method}`).toBe(false);
    }
    for (const method of ['create', 'update', 'remove', 'addComment']) {
      expect(allows(RepresentantsController, method), `representants.${method}`).toBe(true);
    }
    for (const method of ['import', 'removeComment']) {
      expect(allows(RepresentantsController, method), `representants.${method}`).toBe(false);
    }
    expect(allows(SuggestionsController, 'setStatus')).toBe(true);
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
      UsersController,
    ]) {
      for (const method of routesOf(controller)) {
        expect(allowsAs(Role.ACCUEIL, controller, method), `${controller.name}.${method}`).toBe(
          false,
        );
      }
    }
  });

  it('synchronise, parce que le registre se saisit au téléphone', () => {
    for (const method of routesOf(SyncController)) {
      expect(allowsAs(Role.ACCUEIL, SyncController, method), `sync.${method}`).toBe(true);
    }
  });

  it('n’administre pas les listes qu’il utilise', () => {
    for (const method of [
      'listReferentiel',
      'createReferentiel',
      'updateReferentiel',
      'setReferentielActive',
      'reorderReferentiel',
      'usage',
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

  it('SYNCHRONISE SON PROPRE TRAVAIL, poussée comme tirage', () => {
    for (const method of routesOf(SyncController)) {
      expect(allowsAs(Role.DIRECTION, SyncController, method), `sync.${method}`).toBe(true);
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
    for (const method of ['merge', 'reassign', 'changeSegment']) {
      expect(allowsAs(Role.DIRECTION, ProspectsController, method), `prospects.${method}`).toBe(
        false,
      );
    }
    for (const method of routesOf(ImportsController)) {
      expect(allowsAs(Role.DIRECTION, ImportsController, method), `imports.${method}`).toBe(false);
    }
  });

  it('ne fixe pas la disposition par défaut des écrans de chiffres, réservée à l’ADMIN', () => {
    expect(allowsAs(Role.DIRECTION, DashboardsController, 'putDefault')).toBe(false);
    expect(allowsAs(Role.ADMIN, DashboardsController, 'putDefault')).toBe(true);
  });
});
