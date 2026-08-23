import type { ChangeSource, Prisma, RepresentantRelation } from '@crm/database';

import { REPRESENTANT_RELATION_TRANSITIONS, assertTransition } from '../../common/transitions.js';
import type { RepresentantRelationChangeDto } from './dto.js';

export interface RelationChange {
  readonly representantId: string;
  readonly fromStatus: RepresentantRelation;
  readonly toStatus: RepresentantRelation;
  /** Facultatif : aucun payload existant ne le porte, et l'exiger les casserait. */
  readonly reason?: string | null;
  readonly changedById: string;
  readonly source: ChangeSource;
  /** Un ADMIN corrige une saisie, y compris depuis un statut terminal. */
  readonly bypassTransitionRules?: boolean;
}

/**
 * Bascule le statut de relation ET écrit son histoire, dans la transaction de
 * l'appelant.
 *
 * La garde porte sur le statut de DÉPART et vit dans la mise à jour elle-même,
 * jamais dans une lecture préalable : deux appels concurrents la passeraient
 * tous les deux, et le second écrirait une transition partant d'un statut que
 * le premier a déjà quitté. Ici c'est PostgreSQL qui arbitre, et la ligne
 * d'histoire ne naît que si la bascule a réellement eu lieu.
 *
 * Un geste qui ne change rien n'écrit rien : le statut se relit sur la fiche,
 * et une file de lignes identiques ferait passer une relation stable pour une
 * relation agitée.
 */
export async function applyRelationChange(
  tx: Prisma.TransactionClient,
  change: RelationChange,
): Promise<boolean> {
  if (change.toStatus === change.fromStatus) return false;

  // `AMBASSADEUR` et `REFUS` sont terminaux. La règle n'existait que dans le
  // panneau, qui cessait simplement de proposer les choix : l'API acceptait
  // `REFUS → AMBASSADEUR`, et le mobile comme un `curl` la faisaient passer.
  assertTransition(REPRESENTANT_RELATION_TRANSITIONS, change.fromStatus, change.toStatus, {
    code: 'REPRESENTANT_RELATION_TRANSITION_REFUSED',
    label: 'Relation du représentant',
    ...(change.bypassTransitionRules === true ? { bypass: true } : {}),
  });

  const updated = await tx.representant.updateMany({
    where: { id: change.representantId, relationStatus: change.fromStatus, deletedAt: null },
    data: { relationStatus: change.toStatus, rev: { increment: 1 } },
  });
  if (updated.count !== 1) return false;

  await tx.representantRelationChange.create({
    data: {
      representantId: change.representantId,
      fromStatus: change.fromStatus,
      toStatus: change.toStatus,
      reason: change.reason ?? null,
      changedById: change.changedById,
      source: change.source,
    },
  });
  return true;
}

export interface RelationChangeRow {
  id: string;
  representantId: string;
  fromStatus: RepresentantRelation;
  toStatus: RepresentantRelation;
  reason: string | null;
  changedById: string;
  changedBy: { fullName: string };
  source: ChangeSource;
  changedAt: Date;
}

export function toRelationChangeDto(row: RelationChangeRow): RepresentantRelationChangeDto {
  return {
    id: row.id,
    representantId: row.representantId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    reason: row.reason,
    changedById: row.changedById,
    changedByName: row.changedBy.fullName,
    source: row.source,
    changedAt: row.changedAt.toISOString(),
  };
}
