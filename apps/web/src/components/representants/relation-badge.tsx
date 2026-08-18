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

export function RelationBadge({ status }: { status: RepresentantRelation }) {
  return (
    <Badge variant={VARIANTS[status]}>
      {status === 'AMBASSADEUR' ? <StarIcon className="fill-current" aria-hidden="true" /> : null}
      {REPRESENTANT_RELATION_LABELS[status]}
    </Badge>
  );
}
