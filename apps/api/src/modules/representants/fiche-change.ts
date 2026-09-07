import type { Prisma } from '@crm/database';

/**
 * Le journal du FORMULAIRE de la fiche : ce que chaque écran a écrit sur le
 * représentant, champ par champ. Il vit dans `AuditLog`, sous une action par
 * canal, pour que la fiche puisse rejouer toutes ses versions sans table de
 * plus. Un geste qui ne change rien n'écrit rien.
 */
export const FICHE_CHANGE_ACTION_PREFIX = 'representant.fiche.';

export const FICHE_CHANGE_SOURCES = ['WEB', 'MOBILE', 'APPEL', 'IMPORT'] as const;
export type FicheChangeSource = (typeof FICHE_CHANGE_SOURCES)[number];

export const FICHE_FIELDS = [
  'fullName',
  'prenom',
  'phoneE164',
  'etablissement',
  'notes',
  'departementId',
  'iefId',
  'whatsappStatus',
  'whatsappE164',
  'profession',
  'syndicat',
  'connaitUES',
  'contacte',
] as const;
export type FicheField = (typeof FICHE_FIELDS)[number];

export type FicheSnapshot = Record<FicheField, string | boolean | null>;

export const FICHE_SELECT = Object.fromEntries(FICHE_FIELDS.map((f) => [f, true])) as Record<
  FicheField,
  true
>;

export function ficheSnapshot(row: Record<FicheField, string | boolean | null>): FicheSnapshot {
  return Object.fromEntries(FICHE_FIELDS.map((f) => [f, row[f] ?? null])) as FicheSnapshot;
}

export async function recordFicheChange(
  tx: Pick<Prisma.TransactionClient, 'auditLog'>,
  change: {
    representantId: string;
    userId: string;
    source: FicheChangeSource;
    /** `null` à la création : tout ce qui est renseigné est une nouveauté. */
    before: FicheSnapshot | null;
    after: FicheSnapshot;
  },
): Promise<boolean> {
  const avant: Partial<FicheSnapshot> = {};
  const apres: Partial<FicheSnapshot> = {};
  for (const field of FICHE_FIELDS) {
    const before = change.before?.[field] ?? null;
    const after = change.after[field];
    if (before === after) continue;
    avant[field] = before;
    apres[field] = after;
  }
  if (Object.keys(apres).length === 0) return false;

  await tx.auditLog.create({
    data: {
      userId: change.userId,
      action: `${FICHE_CHANGE_ACTION_PREFIX}${change.source}`,
      entity: 'representant',
      entityId: change.representantId,
      before: avant,
      after: apres,
    },
  });
  return true;
}

export function ficheChangeSourceOf(action: string): FicheChangeSource {
  const suffix = action.slice(FICHE_CHANGE_ACTION_PREFIX.length);
  return FICHE_CHANGE_SOURCES.find((source) => source === suffix) ?? 'WEB';
}
