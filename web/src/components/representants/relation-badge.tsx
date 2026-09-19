import { BanIcon, StarIcon } from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  REPRESENTANT_RELATION_LABELS,
  type RepresentantRelation,
} from '@/lib/representant-filters';

type Variant = NonNullable<BadgeProps['variant']>;

export const RELATION_VARIANTS: Record<RepresentantRelation, Variant> = {
  INCONNU: 'outline',
  CONTACTE: 'info',
  AMBASSADEUR: 'success',
  REFUS: 'destructive',
};

export type StatutEffect =
  'REACHED' | 'REFUSED' | 'SCHEDULE_CALLBACK' | 'UNREACHABLE' | 'WRONG_NUMBER';

/** Joint en vert, à rappeler en avertissement, refus en rouge, le reste neutre. */
export function varianteDeLEffet(effect: StatutEffect | null): Variant {
  switch (effect) {
    case 'REACHED':
      return 'success';
    case 'SCHEDULE_CALLBACK':
      return 'warning';
    case 'REFUSED':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * Sur une fiche, la pastille dit où en est l'appel : le statut de
 * qualification, sinon « Jamais appelé ». La relation ne parle pas, elle se
 * voit : étoile pour qui a accepté, interdit pour qui a refusé.
 *
 * Sans `label`, la pastille nomme la relation elle-même : c'est la
 * « décision » d'un statut dans le référentiel, ou une ligne d'import.
 */
export function RelationBadge({
  status,
  label,
  effect = null,
}: {
  status: RepresentantRelation;
  label?: string | null;
  effect?: StatutEffect | null;
}) {
  const decision = label === undefined;
  const texte = decision ? REPRESENTANT_RELATION_LABELS[status] : (label ?? 'Jamais appelé');
  const variant = decision ? RELATION_VARIANTS[status] : varianteDeLEffet(effect);
  return (
    <Badge variant={variant}>
      {status === 'AMBASSADEUR' ? <StarIcon className="fill-current" aria-hidden="true" /> : null}
      {status === 'REFUS' && !decision ? <BanIcon aria-hidden="true" /> : null}
      {texte}
    </Badge>
  );
}
