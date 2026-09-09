import { BanIcon, StarIcon } from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { LIBELLES_RELATION, type RelationRepresentant } from '@/components/representants/filtres';
import { LIBELLES_ISSUE_APPEL, type IssueAppelRepresentant } from '@/lib/data/representants';

type Variante = NonNullable<BadgeProps['variant']>;

export const VARIANTES_RELATION: Record<RelationRepresentant, Variante> = {
  INCONNU: 'outline',
  CONTACTE: 'info',
  AMBASSADEUR: 'success',
  REFUS: 'destructive',
};

/** Joint en vert, à rappeler en avertissement, refus en rouge, le reste neutre. */
function varianteDeLEffet(effet: string | null): Variante {
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

function texteDePastille(
  status: RelationRepresentant,
  label: string | null | undefined,
  issue: IssueAppelRepresentant | null | undefined,
  decision: boolean,
): string {
  if (decision) return LIBELLES_RELATION[status];
  if (label != null) return label;
  return issue == null ? 'Jamais appelé' : LIBELLES_ISSUE_APPEL[issue];
}

/**
 * Sur une fiche, la pastille dit où en est l'appel : le statut de
 * qualification, sinon l'issue du dernier appel, sinon « Jamais appelé ». La
 * relation ne parle pas, elle se voit : étoile pour qui a accepté, interdit
 * pour qui a refusé.
 */
export function PastilleRelation({
  status,
  label,
  effect = null,
  lastCallOutcome,
}: {
  status: RelationRepresentant;
  label?: string | null;
  effect?: string | null;
  lastCallOutcome?: IssueAppelRepresentant | null;
}) {
  const decision = label === undefined && lastCallOutcome === undefined;
  const texte = texteDePastille(status, label, lastCallOutcome, decision);
  let variante = VARIANTES_RELATION[status];
  if (!decision) variante = varianteDeLEffet(label == null ? (lastCallOutcome ?? null) : effect);

  return (
    <Badge variant={variante}>
      {status === 'AMBASSADEUR' ? <StarIcon className="fill-current" aria-hidden="true" /> : null}
      {status === 'REFUS' && !decision ? <BanIcon aria-hidden="true" /> : null}
      {texte}
    </Badge>
  );
}
