import { Badge } from '@/components/ui/badge';
import {
  PHASE2_STATUS_LABELS,
  type BadgeVariant,
  type Phase2Status,
  type ProspectRow,
} from '@/lib/types';

const PHASE2_VARIANT: Record<Phase2Status, BadgeVariant> = {
  PENDING: 'secondary',
  METHOD_OBTAINED: 'success',
  INTERESTED: 'success',
  HESITANT: 'info',
  APPOINTMENT: 'info',
  REACHED: 'outline',
  REFUSED: 'destructive',
  UNREACHABLE: 'secondary',
  WRONG_NUMBER: 'warning',
};

/** Le statut de qualification de la fiche. */
export function EtiquettesStatut({
  prospect,
}: {
  prospect: Pick<ProspectRow, 'phase2Status' | 'statutQualification'>;
}) {
  const statut = prospect.statutQualification ?? PHASE2_STATUS_LABELS[prospect.phase2Status];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge variant={PHASE2_VARIANT[prospect.phase2Status]}>{statut}</Badge>
    </span>
  );
}
