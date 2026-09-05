import { Role, type Prisma } from '@crm/database';

import type { PurgeStepKey } from './purge-plan.js';

export interface PurgeContext {
  readonly actorId: string;
}

export type PurgeClient = Prisma.TransactionClient;

export interface PurgeStep {
  readonly table: string;
  readonly count: (db: PurgeClient, context: PurgeContext) => Promise<number>;
  readonly remove: (db: PurgeClient, context: PurgeContext) => Promise<number>;
}

// Le compte qui exécute la purge n'est JAMAIS supprimé, exclusion explicite et non
// déduite du rôle : elle doit survivre à un futur domaine « Comptes administrateurs ».
function accountsOfRole(role: Role): PurgeStep {
  const where = (context: PurgeContext): Prisma.UserWhereInput => ({
    role,
    id: { not: context.actorId },
  });
  return {
    table: 'users',
    count: (db, context) => db.user.count({ where: where(context) }),
    remove: async (db, context) => (await db.user.deleteMany({ where: where(context) })).count,
  };
}

export const PURGE_STEPS: Readonly<Record<PurgeStepKey, PurgeStep>> = {
  bankCaseTransitions: {
    table: 'bank_case_transitions',
    count: (db) => db.bankCaseTransition.count(),
    remove: async (db) => (await db.bankCaseTransition.deleteMany({})).count,
  },
  bankCases: {
    table: 'bank_cases',
    count: (db) => db.bankCase.count(),
    remove: async (db) => (await db.bankCase.deleteMany({})).count,
  },
  deviceCallDetections: {
    table: 'device_call_detections',
    count: (db) => db.deviceCallDetection.count(),
    remove: async (db) => (await db.deviceCallDetection.deleteMany({})).count,
  },
  ouverturesFiche: {
    table: 'ouvertures_fiche',
    count: (db) => db.ouvertureFiche.count(),
    remove: async (db) => (await db.ouvertureFiche.deleteMany({})).count,
  },
  callAttempts: {
    table: 'call_attempts',
    count: (db) => db.callAttempt.count(),
    remove: async (db) => (await db.callAttempt.deleteMany({})).count,
  },
  lotExportItems: {
    table: 'lot_export_items',
    count: (db) => db.lotExportItem.count(),
    remove: async (db) => (await db.lotExportItem.deleteMany({})).count,
  },
  lotsExport: {
    table: 'lots_export',
    count: (db) => db.lotExport.count(),
    remove: async (db) => (await db.lotExport.deleteMany({})).count,
  },
  scheduledCallbacks: {
    table: 'scheduled_callbacks',
    count: (db) => db.scheduledCallback.count(),
    remove: async (db) => (await db.scheduledCallback.deleteMany({})).count,
  },
  repSuggestions: {
    table: 'representant_suggestions',
    count: (db) => db.representantSuggestion.count(),
    remove: async (db) => (await db.representantSuggestion.deleteMany({})).count,
  },
  repCallAttempts: {
    table: 'rep_call_attempts',
    count: (db) => db.repCallAttempt.count(),
    remove: async (db) => (await db.repCallAttempt.deleteMany({})).count,
  },
  clientRequests: {
    table: 'client_creation_requests',
    count: (db) => db.clientCreationRequest.count(),
    remove: async (db) => (await db.clientCreationRequest.deleteMany({})).count,
  },
  visites: {
    table: 'visites',
    count: (db) => db.visite.count(),
    remove: async (db) => (await db.visite.deleteMany({})).count,
  },
  prospectConversions: {
    table: 'prospect_conversions',
    count: (db) => db.prospectConversion.count(),
    remove: async (db) => (await db.prospectConversion.deleteMany({})).count,
  },
  prospectJourneys: {
    table: 'prospect_journeys',
    count: (db) => db.prospectJourney.count(),
    remove: async (db) => (await db.prospectJourney.deleteMany({})).count,
  },
  prospects: {
    table: 'prospects',
    count: (db) => db.prospect.count(),
    remove: async (db) => (await db.prospect.deleteMany({})).count,
  },
  representants: {
    table: 'representants',
    count: (db) => db.representant.count(),
    remove: async (db) => (await db.representant.deleteMany({})).count,
  },
  notificationDeliveries: {
    table: 'notification_deliveries',
    count: (db) => db.notificationDelivery.count(),
    remove: async (db) => (await db.notificationDelivery.deleteMany({})).count,
  },
  notifications: {
    table: 'notifications',
    count: (db) => db.notification.count(),
    remove: async (db) => (await db.notification.deleteMany({})).count,
  },
  notificationTemplates: {
    table: 'notification_templates',
    count: (db) => db.notificationTemplate.count(),
    remove: async (db) => (await db.notificationTemplate.deleteMany({})).count,
  },
  syncOperations: {
    table: 'sync_operations',
    count: (db) => db.syncOperation.count(),
    remove: async (db) => (await db.syncOperation.deleteMany({})).count,
  },
  syncBatches: {
    table: 'sync_batches',
    count: (db) => db.syncBatch.count(),
    remove: async (db) => (await db.syncBatch.deleteMany({})).count,
  },
  auditLogs: {
    table: 'audit_logs',
    count: (db) => db.auditLog.count(),
    remove: async (db) => (await db.auditLog.deleteMany({})).count,
  },
  commercialAccounts: accountsOfRole(Role.COMMERCIAL),
  financeAccounts: accountsOfRole(Role.BANQUE_FINANCE),
  supervisionAccounts: accountsOfRole(Role.SUPERVISEUR),
  directionAccounts: accountsOfRole(Role.DIRECTION),
  accueilAccounts: accountsOfRole(Role.ACCUEIL),
  bankCaseStages: {
    table: 'bank_case_stages',
    count: (db) => db.bankCaseStage.count(),
    remove: async (db) => (await db.bankCaseStage.deleteMany({})).count,
  },
  callOutcomeReasons: {
    table: 'call_outcome_reasons',
    count: (db) => db.callOutcomeReason.count(),
    remove: async (db) => (await db.callOutcomeReason.deleteMany({})).count,
  },
  bankRejectionReasons: {
    table: 'bank_rejection_reasons',
    count: (db) => db.bankRejectionReason.count(),
    remove: async (db) => (await db.bankRejectionReason.deleteMany({})).count,
  },
  visiteEntreprises: {
    table: 'visite_entreprises',
    count: (db) => db.visiteEntreprise.count(),
    remove: async (db) => (await db.visiteEntreprise.deleteMany({})).count,
  },
  visiteDirections: {
    table: 'visite_directions',
    count: (db) => db.visiteDirection.count(),
    remove: async (db) => (await db.visiteDirection.deleteMany({})).count,
  },
  visiteDestinataires: {
    table: 'visite_destinataires',
    count: (db) => db.visiteDestinataire.count(),
    remove: async (db) => (await db.visiteDestinataire.deleteMany({})).count,
  },
  visiteObjets: {
    table: 'visite_objets',
    count: (db) => db.visiteObjet.count(),
    remove: async (db) => (await db.visiteObjet.deleteMany({})).count,
  },
  canauxProvenance: {
    table: 'canaux_provenance',
    count: (db) => db.canalProvenance.count(),
    remove: async (db) => (await db.canalProvenance.deleteMany({})).count,
  },
  offres: {
    table: 'offers',
    count: (db) => db.offer.count(),
    remove: async (db) => (await db.offer.deleteMany({})).count,
  },
  tranchesRevenu: {
    table: 'income_bands',
    count: (db) => db.incomeBand.count(),
    remove: async (db) => (await db.incomeBand.deleteMany({})).count,
  },
  professions: {
    table: 'professions',
    count: (db) => db.profession.count(),
    remove: async (db) => (await db.profession.deleteMany({})).count,
  },
  employeurs: {
    table: 'employeurs',
    count: (db) => db.employeur.count(),
    remove: async (db) => (await db.employeur.deleteMany({})).count,
  },
  pays: {
    table: 'pays',
    count: (db) => db.pays.count(),
    remove: async (db) => (await db.pays.deleteMany({})).count,
  },
  banques: {
    table: 'banques',
    count: (db) => db.banque.count(),
    remove: async (db) => (await db.banque.deleteMany({})).count,
  },
  syndicats: {
    table: 'syndicats',
    count: (db) => db.syndicat.count(),
    remove: async (db) => (await db.syndicat.deleteMany({})).count,
  },
  iefs: {
    table: 'iefs',
    count: (db) => db.ief.count(),
    remove: async (db) => (await db.ief.deleteMany({})).count,
  },
  departements: {
    table: 'departements',
    count: (db) => db.departement.count(),
    remove: async (db) => (await db.departement.deleteMany({})).count,
  },
  regions: {
    table: 'regions',
    count: (db) => db.region.count(),
    remove: async (db) => (await db.region.deleteMany({})).count,
  },
};
