import { Link } from '@tanstack/react-router';

import { formatMontant } from '@/components/banque/montant';
import { EtapeBadge } from '@/components/banque/pieces';
import { Card, CardContent } from '@/components/ui/card';
import { TableCell, TableRow } from '@/components/ui/table';
import type { DossierBanque } from '@/lib/data/bank-cases';
import { formatDateTime, formatPhone } from '@/lib/format';
import type { Projet } from '@/lib/types';
import { cn } from '@/lib/utils';

function LienDossier({
  projet,
  dossier,
  className,
}: {
  projet: Projet;
  dossier: DossierBanque;
  className?: string | undefined;
}) {
  return (
    <Link
      to="/$projet/dossiers/$dossierId"
      params={{ projet, dossierId: dossier.id }}
      className={cn('rounded-sm hover:underline focus-visible:underline', className)}
    >
      {dossier.reference}
    </Link>
  );
}

export function LigneDossier({ dossier, projet }: { dossier: DossierBanque; projet: Projet }) {
  return (
    <TableRow>
      <TableCell>
        <LienDossier projet={projet} dossier={dossier} className="font-[600]" />
      </TableCell>
      <TableCell>
        <div className="min-w-0">
          <p className="truncate">{dossier.customerName}</p>
          <p className="truncate text-[0.75rem] text-muted-foreground">
            {formatPhone(dossier.customerPhoneE164)}
          </p>
        </div>
      </TableCell>
      <TableCell className="truncate">{dossier.processingBankName}</TableCell>
      <TableCell>
        <EtapeBadge etape={dossier.currentStage} />
      </TableCell>
      {/* « – » et non « 0 FCFA » : un dossier en instruction n'a aucun montant. */}
      <TableCell className="whitespace-nowrap">{formatMontant(dossier.amountXof)}</TableCell>
      <TableCell className="truncate">{dossier.updatedByName ?? dossier.createdByName}</TableCell>
      <TableCell>
        <time dateTime={dossier.updatedAt} className="whitespace-nowrap">
          {formatDateTime(dossier.updatedAt)}
        </time>
      </TableCell>
    </TableRow>
  );
}

export function CarteDossier({ dossier, projet }: { dossier: DossierBanque; projet: Projet }) {
  return (
    <Card className="animate-rise">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
            <LienDossier projet={projet} dossier={dossier} />
          </h3>
          <EtapeBadge etape={dossier.currentStage} />
        </div>
        <div>
          <p className="truncate font-[600]">{dossier.customerName}</p>
          <p className="truncate text-[0.8125rem] text-muted-foreground">
            {formatPhone(dossier.customerPhoneE164)}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[0.8125rem]">
          <div className="min-w-0">
            <dt className="text-muted-foreground">Banque</dt>
            <dd className="truncate font-[600]">{dossier.processingBankName}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Montant</dt>
            <dd className="truncate font-[600]">{formatMontant(dossier.amountXof)}</dd>
          </div>
          <div className="col-span-2 min-w-0">
            <dt className="text-muted-foreground">Dernière intervention</dt>
            <dd className="truncate">
              {dossier.updatedByName ?? dossier.createdByName},{' '}
              <time dateTime={dossier.updatedAt}>{formatDateTime(dossier.updatedAt)}</time>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
