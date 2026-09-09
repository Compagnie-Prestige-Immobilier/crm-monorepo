import { BanIcon, StarIcon } from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  LIBELLES_ISSUE_APPEL,
  type IssueAppelRepresentant,
  type RelationRepresentant,
} from '@/lib/data/representants';

type Variante = NonNullable<BadgeProps['variant']>;

/** Joint en vert, à rappeler en avertissement, refus en rouge, le reste neutre. */
function varianteDeLEffet(effet: string | null): Variante {
  if (effet === 'REACHED' || effet === 'PROSPECTS_PROMISED') return 'success';
  if (effet === 'SCHEDULE_CALLBACK' || effet === 'CALLBACK') return 'warning';
  if (effet === 'REFUSED') return 'destructive';
  return 'outline';
}

/**
 * Où en est l'appel : le statut de qualification, sinon l'issue du dernier
 * appel, sinon « Jamais appelé ». La relation ne parle pas, elle se voit :
 * étoile pour qui a accepté, interdit pour qui a refusé.
 */
export function PastilleRelation({
  status,
  label,
  effect = null,
  lastCallOutcome,
}: {
  status: RelationRepresentant;
  label: string | null;
  effect?: string | null;
  lastCallOutcome: IssueAppelRepresentant | null;
}) {
  const texte =
    label ?? (lastCallOutcome === null ? 'Jamais appelé' : LIBELLES_ISSUE_APPEL[lastCallOutcome]);
  const variante = varianteDeLEffet(label === null ? lastCallOutcome : effect);

  return (
    <Badge variant={variante}>
      {status === 'AMBASSADEUR' ? <StarIcon className="fill-current" aria-hidden="true" /> : null}
      {status === 'REFUS' ? <BanIcon aria-hidden="true" /> : null}
      {texte}
    </Badge>
  );
}
