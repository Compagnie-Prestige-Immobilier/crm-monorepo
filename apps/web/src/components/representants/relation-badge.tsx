import { BanIcon, StarIcon } from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  REPRESENTANT_RELATION_LABELS,
  type RepresentantRelation,
} from '@/lib/representant-filters';
import { REP_CALL_OUTCOME_LABELS, type RepCallOutcome } from '@/lib/types';

type Variant = NonNullable<BadgeProps['variant']>;

const RELATION_VARIANTS: Record<RepresentantRelation, Variant> = {
  INCONNU: 'outline',
  CONTACTE: 'info',
  AMBASSADEUR: 'success',
  REFUS: 'destructive',
};

/** Joint en vert, à rappeler en avertissement, refus en rouge, le reste neutre. */
function varianteDeLEffet(effet: string | null): Variant {
  switch (effet) {
    case 'REACHED':
    case 'PROSPECTS_PROMISED':
      return 'success';
    case 'SCHEDULE_CALLBACK':
    case 'CALLBACK':
      return 'warning';
    case 'REFUSED':
      return 'destructive';
    default:
      return 'outline';
  }
}

function texteDeBadge(
  status: RepresentantRelation,
  label: string | null | undefined,
  lastCallOutcome: RepCallOutcome | null | undefined,
  decision: boolean,
): string {
  if (decision) return REPRESENTANT_RELATION_LABELS[status];
  if (label != null) return label;
  return lastCallOutcome == null ? 'Jamais appelé' : REP_CALL_OUTCOME_LABELS[lastCallOutcome];
}

function varianteDeBadge(
  status: RepresentantRelation,
  label: string | null | undefined,
  effect: string | null,
  lastCallOutcome: RepCallOutcome | null | undefined,
  decision: boolean,
): Variant {
  if (decision) return RELATION_VARIANTS[status];
  return varianteDeLEffet(label == null ? (lastCallOutcome ?? null) : effect);
}

/**
 * Sur une fiche, la pastille dit où en est l'appel : le statut de
 * qualification, sinon l'issue du dernier appel, sinon « Jamais appelé ». La
 * relation ne parle pas, elle se voit : étoile pour qui a accepté, interdit
 * pour qui a refusé.
 *
 * Sans `label` ni `lastCallOutcome`, la pastille nomme la relation elle-même :
 * c'est la « décision » d'un statut dans le référentiel, ou une ligne d'import.
 */
export function RelationBadge({
  status,
  label,
  effect = null,
  lastCallOutcome,
}: {
  status: RepresentantRelation;
  label?: string | null;
  effect?: string | null;
  lastCallOutcome?: RepCallOutcome | null;
}) {
  const decision = label === undefined && lastCallOutcome === undefined;
  const texte = texteDeBadge(status, label, lastCallOutcome, decision);
  const variant = varianteDeBadge(status, label, effect, lastCallOutcome, decision);
  return (
    <Badge variant={variant}>
      {status === 'AMBASSADEUR' ? <StarIcon className="fill-current" aria-hidden="true" /> : null}
      {status === 'REFUS' && !decision ? <BanIcon aria-hidden="true" /> : null}
      {texte}
    </Badge>
  );
}
