'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';

import { Pages } from '@/components/console/rep-annuaire';
import {
  FilterableTableHead,
  type FiltreColonne,
} from '@/components/filters/filterable-table-head';
import { ProjetBadge } from '@/components/prospects/projet-badge';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ListeCartes } from '@/components/ui/liste-cartes';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { fetchProspectsAQualifier } from '@/lib/data/prospects';
import { formatDateTime, formatPhone } from '@/lib/format';
import { PHASE2_STATUS_LABELS, type ProspectRow } from '@/lib/types';
import { cn } from '@/lib/utils';

const nouveauHref = (): string => '/teleconseil/prospects';

const CLASSE_CHOIX = cn(
  'flex min-h-11 w-full items-center gap-2 rounded-sm text-left text-[0.9375rem] font-[600]',
  'underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
);

function texteListeVide(cherche: string, seulementARappeler: boolean): string {
  if (cherche !== '') return 'Aucun résultat. Vérifiez le nom ou le numéro.';
  if (seulementARappeler)
    return 'Rien ne reste à appeler. Affichez toutes vos fiches, ou demandez une campagne à votre superviseur.';
  return 'Aucune fiche ne vous est attribuée. Ajoutez un prospect, ou demandez une campagne à votre superviseur.';
}

/** « Fiches 21 à 40 sur 256 » : la liste entière se parcourt, jamais tronquée en silence. */
function PiedAnnuaire({
  page,
  liste,
  onPage,
}: {
  page: number;
  liste: { total: number; pageSize: number; pageCount: number };
  onPage: (page: number) => void;
}) {
  const debut = (page - 1) * liste.pageSize + 1;
  const fin = Math.min(page * liste.pageSize, liste.total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[0.875rem] text-muted-foreground">
      <span className="tabular-nums">
        Fiches {debut} à {fin} sur {liste.total}
      </span>
      <Pages page={page} pageCount={liste.pageCount} onPage={onPage} />
    </div>
  );
}

export function ListeAnnuaire({
  annuaire,
  cherche,
  page,
  onPage,
  canCreateProspect,
  seulementARappeler,
  filtreStatut,
  onChoisir,
}: {
  annuaire: UseQueryResult<Awaited<ReturnType<typeof fetchProspectsAQualifier>>>;
  cherche: string;
  page: number;
  onPage: (page: number) => void;
  canCreateProspect: boolean;
  seulementARappeler: boolean;
  filtreStatut: FiltreColonne;
  onChoisir: (row: ProspectRow) => void;
}) {
  if (annuaire.isError) {
    return (
      <QueryErrorState
        error={annuaire.error}
        fallback="L’annuaire n’a pas pu être lu."
        onRetry={() => {
          void annuaire.refetch();
        }}
      />
    );
  }

  if (annuaire.isPending) return <ListeSkeleton />;

  if (annuaire.data.items.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[0.9375rem]">{texteListeVide(cherche, seulementARappeler)}</p>
        {canCreateProspect ? (
          <Link href={nouveauHref()} className={cn(buttonVariants(), 'self-start')}>
            Ajouter un prospect
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden md:block">
        <TableauAnnuaire
          lignes={annuaire.data.items}
          filtreStatut={filtreStatut}
          onChoisir={onChoisir}
        />
      </div>
      <ListeCartes
        libelle="Fiches"
        items={annuaire.data.items}
        cle={(row) => row.id}
        titre={(row) => (
          <span className="flex flex-wrap items-center gap-2">
            <NomProspect row={row} />
            <ProjetBadge projet={row.projet} />
          </span>
        )}
        sousTitre={(row) => (
          <>
            <StatutAnnuaire row={row} />
            <EnCoursPar row={row} />
          </>
        )}
        numero={(row) => row.phoneE164}
        action={(row) => (
          <Button
            variant="outline"
            className="w-full"
            aria-label={`Ouvrir la fiche de ${row.nom} ${row.prenom}`}
            onClick={() => {
              onChoisir(row);
            }}
          >
            Ouvrir la fiche
          </Button>
        )}
      />
      <PiedAnnuaire page={page} liste={annuaire.data} onPage={onPage} />
    </div>
  );
}

function EnCoursPar({ row }: { row: ProspectRow }) {
  if (row.enCoursPar == null) return null;
  return <Badge variant="warning">En cours · {row.enCoursPar}</Badge>;
}

function TableauAnnuaire({
  lignes,
  filtreStatut,
  onChoisir,
}: {
  lignes: readonly ProspectRow[];
  filtreStatut: FiltreColonne;
  onChoisir: (row: ProspectRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom et prénom</TableHead>
          <TableHead>Projet</TableHead>
          <TableHead>Numéro</TableHead>
          <FilterableTableHead label="Statut / Qualification" filtre={filtreStatut} />
          <TableHead>Dernier appel</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <button
                type="button"
                onClick={() => {
                  onChoisir(row);
                }}
                className={CLASSE_CHOIX}
              >
                <NomProspect row={row} />
              </button>
              <EnCoursPar row={row} />
            </TableCell>
            <TableCell>
              <ProjetBadge projet={row.projet} />
            </TableCell>
            <TableCell className="whitespace-nowrap font-mono text-[0.875rem]">
              {formatPhone(row.phoneE164)}
            </TableCell>
            <TableCell>
              <StatutAnnuaire row={row} />
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {row.lastAttemptAt === null ? 'Jamais appelé' : formatDateTime(row.lastAttemptAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function variantDuCode(code: string | null): 'success' | 'destructive' | 'warning' | 'info' {
  if (code === 'METHOD_OBTAINED') return 'success';
  if (code === 'REFUSED' || code === 'WRONG_NUMBER') return 'destructive';
  if (code === 'CALLBACK') return 'warning';
  return 'info';
}

function variantDuStatut(row: ProspectRow): 'success' | 'destructive' | 'warning' | 'info' {
  if (row.phase2Status === 'METHOD_OBTAINED') return variantDuCode(row.phase2Status);
  return row.lastJoignable === false ? 'warning' : 'info';
}

function StatutAnnuaire({ row }: { row: ProspectRow }) {
  if (row.lastAttemptAt === null)
    return <span className="text-[0.8125rem] text-muted-foreground">Non qualifié</span>;
  const label = row.lastReasonLabel ?? 'Qualifié';
  const variant = variantDuStatut(row);

  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant={variant} className="w-fit">
        {label}
      </Badge>
      {row.lastAttemptAt ? (
        <span className="text-[0.75rem] text-muted-foreground">
          {formatDateTime(row.lastAttemptAt)}
        </span>
      ) : null}
      {row.lastComment ? (
        <span
          className="max-w-xs truncate text-[0.75rem] text-muted-foreground"
          title={row.lastComment}
        >
          « {row.lastComment} »
        </span>
      ) : null}
    </div>
  );
}

function NomProspect({ row }: { row: ProspectRow }) {
  return (
    <>
      <span className="truncate">
        {row.nom} {row.prenom}
      </span>
      {row.phase2Status === 'PENDING' ? null : (
        <Badge variant={variantDuCode(row.phase2Status)} className="shrink-0 font-[400]">
          {PHASE2_STATUS_LABELS[row.phase2Status]}
        </Badge>
      )}
    </>
  );
}

export function ListeSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
    </div>
  );
}
