import { StarIcon } from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  REPRESENTANT_RELATION_LABELS,
  type RepresentantRelation,
} from '@/lib/representant-filters';

const VARIANTS: Record<RepresentantRelation, NonNullable<BadgeProps['variant']>> = {
  INCONNU: 'outline',
  CONTACTE: 'info',
  AMBASSADEUR: 'success',
  REFUS: 'destructive',
};

/**
 * Le statut de qualification est le libellé visible ; `relationStatus` ne
 * décide plus que de la couleur et de l'étoile. Les fiches jamais qualifiées
 * retombent sur le libellé de la relation.
 */
export function RelationBadge({
  status,
  label,
}: {
  status: RepresentantRelation;
  label?: string | null;
}) {
  return (
    <Badge variant={VARIANTS[status]}>
      {status === 'AMBASSADEUR' ? <StarIcon className="fill-current" aria-hidden="true" /> : null}
      {label ?? REPRESENTANT_RELATION_LABELS[status]}
    </Badge>
  );
}
