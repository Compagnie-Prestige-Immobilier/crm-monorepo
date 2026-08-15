import type { Prisma } from '@crm/database';

/**
 * Registre des entités de démonstration.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * C'EST LA PIÈCE QUI REND L'INTERRUPTEUR SÛR. Lire avant de modifier.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le semeur enregistre ici CHAQUE ligne qu'il crée. La désactivation supprime
 * exactement ces identifiants, et rien d'autre.
 *
 * L'alternative tentante, supprimer par heuristique : « tout ce dont le nom
 * commence par Démo », « tout ce qui a été créé après telle heure », « tout ce
 * qui appartient aux comptes de démonstration », est à proscrire. Le jour où
 * un vrai commercial saisit un prospect pendant une démonstration, l'heuristique
 * l'efface, et personne ne comprend pourquoi la fiche a disparu. Une donnée
 * réelle perdue ne se retrouve pas.
 *
 * `sequence` fixe l'ordre de création ; la suppression le parcourt à l'envers,
 * ce qui satisfait les clés étrangères sans coder de tri topologique.
 */

/**
 * Types d'entités traçables. L'ordre de cette liste EST l'ordre de création :
 * un parent précède toujours ses enfants.
 */
export const DEMO_ENTITY_TYPES = [
  'user',
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

/**
 * Suppression Prisma correspondant à chaque type.
 *
 * Écrit en table de correspondance plutôt qu'en `switch` disséminé : un type
 * ajouté à `DEMO_ENTITY_TYPES` sans sa suppression ici casse la compilation,
 * au lieu de laisser silencieusement des lignes de démonstration derrière lui.
 */
export const DEMO_DELETERS: Readonly<
  Record<DemoEntityType, (tx: Prisma.TransactionClient, ids: string[]) => Promise<unknown>>
> = {
  // Une demande approuvée POINTE vers le prospect qu'elle a créé : elle doit
  // donc disparaître avant lui, sinon la clé étrangère refuse la suppression.
  // L'ordre inverse de `DEMO_ENTITY_TYPES` s'en charge, à condition que la
  // demande y figure APRÈS le prospect, ce qui est le cas.
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
};

/**
 * Clé du réglage portant l'état de l'interrupteur.
 *
 * Définie dans `prisma/demo-visibility.service.ts`, avec le service qui la lit
 * pour tous les autres modules, et seulement réexportée ici.
 */
export { DEMO_MODE_SETTING } from '../../prisma/demo-visibility.service.js';

/** Clé du réglage portant la date du dernier ensemencement. */
export const DEMO_SEEDED_AT_SETTING = 'demo_seeded_at';

/**
 * Accumulateur d'identifiants, à passer au fil de l'ensemencement.
 *
 * Il ne sert à rien de l'écrire ligne par ligne : tout est inséré en une fois à
 * la fin, DANS la même transaction que les données elles-mêmes. Si la
 * transaction échoue, ni les données ni le registre ne subsistent, jamais l'un
 * sans l'autre, ce qui laisserait des lignes de démonstration intraçables.
 */
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

  /** Lignes prêtes pour `createMany`, numérotées dans l'ordre de création. */
  toRows(): { entityType: string; entityId: string; sequence: number }[] {
    return this.entries.map((entry, index) => ({
      entityType: entry.entityType,
      entityId: entry.entityId,
      sequence: index,
    }));
  }
}
