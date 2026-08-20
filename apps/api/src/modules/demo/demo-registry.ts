import type { Prisma } from '@crm/database';

// Discipline du registre : toute table que le semeur écrit doit être déclarée ici, sinon la purge
// ne sait pas la défaire et laisse ses lignes de démonstration en base. La purge ne supprime que
// les identifiants enregistrés, jamais par heuristique de nom ou de date.
// L'ordre de cette liste est l'ordre de CRÉATION, un parent avant ses enfants ; la purge la
// parcourt à l'envers, et c'est lui, pas la séquence, qui satisfait les clés étrangères.
export const DEMO_ENTITY_TYPES = [
  'user',
  'visite',
  'representant',
  'prospect',
  'callCampaign',
  'callCampaignCommercial',
  'callTask',
  'callAttempt',
  'repCallCampaign',
  'repCallCampaignCommercial',
  'repCallTask',
  'repCallAttempt',
  'bankCase',
  'bankCaseTransition',
  'clientCreationRequest',
] as const;

export type DemoEntityType = (typeof DEMO_ENTITY_TYPES)[number];

export const DEMO_DELETERS: Readonly<
  Record<DemoEntityType, (tx: Prisma.TransactionClient, ids: string[]) => Promise<unknown>>
> = {
  // Une demande approuvée pointe vers le prospect qu'elle a créé : elle doit disparaître avant lui,
  // ce que garantit sa position après `prospect` dans `DEMO_ENTITY_TYPES`.
  clientCreationRequest: (tx, ids) =>
    tx.clientCreationRequest.deleteMany({ where: { id: { in: ids } } }),
  bankCaseTransition: (tx, ids) => tx.bankCaseTransition.deleteMany({ where: { id: { in: ids } } }),
  bankCase: (tx, ids) => tx.bankCase.deleteMany({ where: { id: { in: ids } } }),
  repCallAttempt: (tx, ids) => tx.repCallAttempt.deleteMany({ where: { id: { in: ids } } }),
  repCallTask: (tx, ids) => tx.repCallTask.deleteMany({ where: { id: { in: ids } } }),
  repCallCampaignCommercial: (tx, ids) =>
    tx.repCallCampaignCommercial.deleteMany({ where: { id: { in: ids } } }),
  repCallCampaign: (tx, ids) => tx.repCallCampaign.deleteMany({ where: { id: { in: ids } } }),
  callAttempt: (tx, ids) => tx.callAttempt.deleteMany({ where: { id: { in: ids } } }),
  callTask: (tx, ids) => tx.callTask.deleteMany({ where: { id: { in: ids } } }),
  callCampaignCommercial: (tx, ids) =>
    tx.callCampaignCommercial.deleteMany({ where: { id: { in: ids } } }),
  callCampaign: (tx, ids) => tx.callCampaign.deleteMany({ where: { id: { in: ids } } }),
  prospect: (tx, ids) => tx.prospect.deleteMany({ where: { id: { in: ids } } }),
  representant: (tx, ids) => tx.representant.deleteMany({ where: { id: { in: ids } } }),
  user: (tx, ids) => tx.user.deleteMany({ where: { id: { in: ids } } }),
  // Ne dépend que de `user` (créateur, `onDelete: Restrict`) : sans registre, une visite
  // fictive bloquerait la suppression du compte semé qui l'a inscrite.
  visite: (tx, ids) => tx.visite.deleteMany({ where: { id: { in: ids } } }),
};

export { DEMO_MODE_SETTING } from '../../prisma/demo-visibility.service.js';

export const DEMO_SEEDED_AT_SETTING = 'demo_seeded_at';

// Accumulateur : les lignes ne sont insérées qu'à la fin, DANS la transaction qui écrit les
// données, pour qu'un échec ne laisse jamais des lignes de démonstration sans registre.
export class DemoRegistry {
  private readonly entries: { entityType: DemoEntityType; entityId: string }[] = [];

  record(entityType: DemoEntityType, entityId: string): void {
    this.entries.push({ entityType, entityId });
  }

  recordMany(entityType: DemoEntityType, entityIds: readonly string[]): void {
    for (const entityId of entityIds) this.record(entityType, entityId);
  }

  get size(): number {
    return this.entries.length;
  }

  toRows(): { entityType: string; entityId: string; sequence: number }[] {
    return this.entries.map((entry, index) => ({
      entityType: entry.entityType,
      entityId: entry.entityId,
      sequence: index,
    }));
  }
}
