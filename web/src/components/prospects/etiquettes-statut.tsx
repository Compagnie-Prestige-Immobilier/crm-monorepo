import { Badge } from '@/components/ui/badge';
import {
  etatRendezVousFiche,
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

const QUALIFICATION_VARIANT: Record<string, BadgeVariant> = {
  Vendu: 'success',
  'Va acheter': 'info',
  'Apporteur d’affaires': 'warning',
  Partenariat: 'secondary',
};

/** La qualification posée au closing ; un texte libre vient de « Autre, à préciser ». */
export function PastilleQualification({ qualification }: { qualification: string | null }) {
  if (qualification === null || qualification === '') return null;
  return <Badge variant={QUALIFICATION_VARIANT[qualification] ?? 'outline'}>{qualification}</Badge>;
}

/** Le statut de qualification de la fiche ; un rendez-vous dit aussi où il en est. */
export function EtiquettesStatut({
  prospect,
}: {
  prospect: Pick<
    ProspectRow,
    | 'phase2Status'
    | 'statutQualification'
    | 'qualificationClosing'
    | 'rendezVousIssue'
    | 'rendezVousConfirmation'
    | 'rendezVousReporteAt'
  >;
}) {
  const statut = prospect.statutQualification ?? PHASE2_STATUS_LABELS[prospect.phase2Status];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge variant={PHASE2_VARIANT[prospect.phase2Status]}>{statut}</Badge>
      {prospect.phase2Status === 'APPOINTMENT' ? (
        <Badge variant="outline">{etatRendezVousFiche(prospect)}</Badge>
      ) : null}
      <PastilleQualification qualification={prospect.qualificationClosing} />
    </span>
  );
}
