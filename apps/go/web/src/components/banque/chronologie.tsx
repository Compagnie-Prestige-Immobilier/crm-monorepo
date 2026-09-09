import { formatMontant } from '@/components/banque/montant';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { TransitionBanque } from '@/lib/data/bank-cases';
import { formatDateTime } from '@/lib/format';

function titre(transition: TransitionBanque): string {
  if (transition.fromStage === null) return `Ouverture : ${transition.toStage.label}`;
  return `${transition.fromStage.label} → ${transition.toStage.label}`;
}

function Motif({ transition }: { transition: TransitionBanque }) {
  if (transition.rejectionReason === null) return null;
  return (
    <p className="mt-1 text-[0.875rem]">
      Motif : <span className="font-[600]">{transition.rejectionReason.label}</span>
      {transition.rejectionDetail === null || transition.rejectionDetail === ''
        ? ''
        : `. ${transition.rejectionDetail}`}
    </p>
  );
}

function Etape({ transition }: { transition: TransitionBanque }) {
  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className="absolute top-1.5 -left-7 size-3.5 rounded-full border-2 border-card bg-primary"
      />
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="font-[600]">{titre(transition)}</p>
        {transition.correctionReason === null ? null : (
          <Badge variant="warning">Correction administrateur</Badge>
        )}
      </div>

      <p className="text-[0.75rem] text-muted-foreground">
        <time dateTime={transition.createdAt}>{formatDateTime(transition.createdAt)}</time> ·{' '}
        {transition.performedByName}
      </p>

      {transition.amountXof === null ? null : (
        <p className="mt-1 text-[0.875rem]">
          Montant : <span className="font-[600]">{formatMontant(transition.amountXof)}</span>
        </p>
      )}

      <Motif transition={transition} />

      {transition.comment === null || transition.comment === '' ? null : (
        <p className="mt-1 max-w-prose text-[0.875rem] text-muted-foreground">
          {transition.comment}
        </p>
      )}

      {transition.correctionReason === null ? null : (
        <p className="mt-1 max-w-prose text-[0.8125rem] text-warning">
          Justification : {transition.correctionReason}
        </p>
      )}
    </li>
  );
}

export function Chronologie({ transitions }: { transitions: readonly TransitionBanque[] }) {
  if (transitions.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-[0.875rem] text-muted-foreground">Aucune transition enregistrée.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <ol className="relative flex flex-col gap-6 pl-7">
          <span
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-[0.4375rem] w-px bg-border"
          />
          {transitions.map((transition) => (
            <Etape key={transition.id} transition={transition} />
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
