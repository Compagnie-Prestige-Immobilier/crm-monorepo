'use client';

import { BuildingIcon, ClockIcon, FolderPlusIcon } from 'lucide-react';
import Link from 'next/link';

import { nomClient } from '@/components/bank/bank-a-ouvrir-view';
import { AnimatedNumber } from '@/components/live/animated-number';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials } from '@/lib/format';
import { formatXof } from '@/lib/money';
import {
  stageBadgeVariant,
  type BankCase,
  type BankCaseStage,
  type InscriptionAOuvrir,
} from '@/lib/types';
import { cn } from '@/lib/utils';

export const JOURS_RETARD = 7;

/** Couleur de l'étape, propagée aux cartes de la colonne par la variable héritée `--teinte`. */
export const TEINTE: Record<ReturnType<typeof stageBadgeVariant>, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  destructive: 'var(--destructive)',
  info: 'var(--info)',
  default: 'var(--primary)',
  secondary: 'var(--muted-foreground)',
  outline: 'var(--border)',
};

export function teinteDe(color: string): string {
  return TEINTE[stageBadgeVariant(color)];
}

function joursDepuis(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Libellé, compte, total encaissé et part du flux occupée par l'étape. */
export function EnteteColonne({
  etape,
  compte,
  part,
  total,
}: {
  etape: Pick<BankCaseStage, 'label'>;
  compte: number;
  part: number;
  total?: number | undefined;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold text-[0.8125rem] text-foreground uppercase tracking-[0.06em]">
          {etape.label}
        </span>
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full font-semibold text-[0.75rem] tabular-nums',
            '[background:color-mix(in_oklab,var(--teinte)_16%,transparent)] [color:var(--teinte)]',
          )}
        >
          <AnimatedNumber value={compte} />
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full rounded-full [background:var(--teinte)] transition-[width] duration-500"
          style={{ width: `${String(Math.round(part * 100))}%` }}
        />
      </div>
      {total === undefined ? null : (
        <span className="font-semibold text-[0.8125rem] tabular-nums [color:var(--teinte)]">
          <AnimatedNumber
            value={total}
            format={(v) => formatXof(String(Math.round(v)), '0 FCFA')}
          />
        </span>
      )}
    </div>
  );
}

export function ContenuDossier({ dossier, base }: { dossier: BankCase; base: string }) {
  const age = joursDepuis(dossier.createdAt);
  const enRetard = !dossier.isTerminal && age > JOURS_RETARD;
  const montant = dossier.currentStage.type === 'CASHED' ? dossier.amountXof : null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`${base}/dossiers/${dossier.id}`}
          className="truncate font-semibold text-[0.9375rem] leading-tight underline-offset-4 hover:underline"
        >
          {dossier.customerName}
        </Link>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-[0.6875rem] tabular-nums',
            enRetard ? 'bg-warning-surface text-warning' : 'bg-muted text-muted-foreground',
          )}
        >
          <ClockIcon className="size-3" aria-hidden="true" />
          {age} j
        </span>
      </div>
      <p className="truncate font-mono text-[0.6875rem] text-muted-foreground tabular-nums tracking-tight">
        {dossier.reference}
      </p>
      <p className="flex min-w-0 items-center gap-1.5 text-[0.75rem] text-muted-foreground">
        <BuildingIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{dossier.processingBankName}</span>
      </p>
      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <span className="flex min-w-0 items-center gap-1.5 text-[0.75rem] text-muted-foreground">
          <Avatar className="size-5">
            <AvatarFallback className="text-[0.5625rem]">
              {initials(dossier.suiviParName ?? '?')}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{dossier.suiviParName ?? 'Aucun téléconseiller'}</span>
        </span>
        {montant === null ? null : (
          <span className="shrink-0 rounded-md bg-success-surface px-1.5 py-0.5 font-semibold text-[0.75rem] text-success tabular-nums">
            {formatXof(montant)}
          </span>
        )}
      </div>
    </div>
  );
}

export function ContenuInscription({
  inscription,
  base,
}: {
  inscription: InscriptionAOuvrir;
  base: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="truncate font-semibold text-[0.9375rem] leading-tight">
        {nomClient(inscription)}
      </p>
      <p className="flex min-w-0 items-center gap-1.5 text-[0.75rem] text-muted-foreground">
        <BuildingIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{inscription.banqueName ?? 'Banque à choisir'}</span>
      </p>
      <Link
        href={`${base}/dossiers/nouveau?ouvrir=${inscription.id}`}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 font-semibold text-[0.75rem] text-primary transition-colors hover:bg-primary/15"
      >
        <FolderPlusIcon className="size-3.5" aria-hidden="true" />
        Ouvrir le dossier
      </Link>
    </div>
  );
}
