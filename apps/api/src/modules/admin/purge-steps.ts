import { Role, type Prisma } from '@crm/database';

import type { PurgeStepKey } from './purge-plan.js';

/**
 * Traduction d'une étape de purge en opérations Prisma.
 *
 * Table de correspondance plutôt que `switch` disséminé, pour la même raison que
 * `DEMO_DELETERS` : une étape ajoutée à `PURGE_STEP_ORDER` sans son exécution
 * ici casse la compilation, au lieu d'être silencieusement ignorée, c'est-à-dire
 * au lieu de laisser des lignes derrière une purge annoncée comme complète.
 *
 * `count` et `remove` portent la MÊME clause. C'est ce qui rend l'écran honnête :
 * le nombre annoncé avant la validation est celui des lignes réellement
 * supprimées, et non le décompte d'un autre critère.
 *
 * Les délégués sont écrits en toutes lettres plutôt que dérivés d'une clé
 * générique : Prisma type chaque modèle séparément, et l'indexation dynamique
 * n'y survivrait qu'au prix d'une assertion, exactement la construction qui
 * laisse passer une faute de frappe sur un nom de table.
 */

/** Contexte d'exécution. Le compte qui agit n'est jamais supprimé par sa propre purge. */
export interface PurgeContext {
  readonly actorId: string;
}

/**
 * Sous-ensemble de client Prisma utilisé ici. `PrismaService` comme
 * `Prisma.TransactionClient` y répondent, si bien que le comptage (hors
 * transaction) et la suppression (dans la transaction) partagent le même code.
 */
export type PurgeClient = Prisma.TransactionClient;

export interface PurgeStep {
  /** Table visée. Sert au journal d'audit, jamais à l'interface. */
  readonly table: string;
  readonly count: (db: PurgeClient, context: PurgeContext) => Promise<number>;
  readonly remove: (db: PurgeClient, context: PurgeContext) => Promise<number>;
}

/**
 * Un compte n'est JAMAIS supprimé par l'administrateur qui exécute la purge.
 *
 * La garantie ne repose pas sur le seul filtre de rôle. Le premier
 * administrateur porte le rôle ADMIN, qu'aucune étape ne vise aujourd'hui, mais
 * l'exclusion explicite survivra à un futur domaine « Comptes administrateurs ».
 * Une protection qui dépend d'une condition située ailleurs finit toujours par
 * tomber avec elle.
 */
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

/**
 * Étapes après lesquelles le registre de démonstration ne désigne plus rien.
 *
 * Le registre (`demo_entities`) mémorise les identifiants créés par le semeur.
 * Une purge qui emporte ces lignes le laisse pointer dans le vide : l'écran des
 * paramètres continuerait d'annoncer un jeu de démonstration en place, et la
 * désactivation ne supprimerait rien. On remet donc l'interrupteur à zéro dans
 * la MÊME transaction, plutôt que de laisser deux sources se contredire.
 */
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
