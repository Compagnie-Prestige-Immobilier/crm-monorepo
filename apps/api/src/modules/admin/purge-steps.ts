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
  callAttempts: {
    table: 'call_attempts',
    count: (db) => db.callAttempt.count(),
    remove: async (db) => (await db.callAttempt.deleteMany({})).count,
  },
  scheduledCallbacks: {
    table: 'scheduled_callbacks',
    count: (db) => db.scheduledCallback.count(),
    remove: async (db) => (await db.scheduledCallback.deleteMany({})).count,
  },
  callTasks: {
    table: 'call_tasks',
    count: (db) => db.callTask.count(),
    remove: async (db) => (await db.callTask.deleteMany({})).count,
  },
  campaignMembers: {
    table: 'call_campaign_commerciaux',
    count: (db) => db.callCampaignCommercial.count(),
    remove: async (db) => (await db.callCampaignCommercial.deleteMany({})).count,
  },
  campaigns: {
    table: 'call_campaigns',
    count: (db) => db.callCampaign.count(),
    remove: async (db) => (await db.callCampaign.deleteMany({})).count,
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
  repCallTasks: {
    table: 'rep_call_tasks',
    count: (db) => db.repCallTask.count(),
    remove: async (db) => (await db.repCallTask.deleteMany({})).count,
  },
  repCampaignMembers: {
    table: 'rep_call_campaign_commerciaux',
    count: (db) => db.repCallCampaignCommercial.count(),
    remove: async (db) => (await db.repCallCampaignCommercial.deleteMany({})).count,
  },
  repCampaigns: {
    table: 'rep_call_campaigns',
    count: (db) => db.repCallCampaign.count(),
    remove: async (db) => (await db.repCallCampaign.deleteMany({})).count,
  },
  clientRequests: {
    table: 'client_creation_requests',
    count: (db) => db.clientCreationRequest.count(),
    remove: async (db) => (await db.clientCreationRequest.deleteMany({})).count,
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
  bankCaseStages: {
    table: 'bank_case_stages',
    count: (db) => db.bankCaseStage.count(),
    remove: async (db) => (await db.bankCaseStage.deleteMany({})).count,
  },
  bankRejectionReasons: {
    table: 'bank_rejection_reasons',
    count: (db) => db.bankRejectionReason.count(),
    remove: async (db) => (await db.bankRejectionReason.deleteMany({})).count,
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

// Étapes après lesquelles le registre `demo_entities` ne désigne plus rien : l'interrupteur
// de démonstration est remis à zéro dans la MÊME transaction, sinon l'écran l'annonce encore.
export const DEMO_TRACKED_STEPS: readonly PurgeStepKey[] = [
  'commercialAccounts',
  'representants',
  'prospects',
  'campaigns',
  'campaignMembers',
  'callTasks',
  'callAttempts',
  'repCampaigns',
  'repCampaignMembers',
  'repCallTasks',
  'repCallAttempts',
  'clientRequests',
  'bankCases',
  'bankCaseTransitions',
];
