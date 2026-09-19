'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import { QueryErrorState } from '@/components/query-error-state';
import { RelationBadge } from '@/components/representants/relation-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { fetchRepresentantsAQualifier, ScriptedRepresentant } from '@/lib/data/representants';
import { formatPhone } from '@/lib/format';
import {
  REPRESENTANT_RELATION_CHOICES,
  REPRESENTANT_RELATION_LABELS,
  type RepresentantRelation,
} from '@/lib/representant-filters';
import { cn } from '@/lib/utils';

const RELATION_ITEMS = [
  { value: 'tous', label: 'Tous' },
  ...REPRESENTANT_RELATION_CHOICES.map((relation) => ({
    value: relation,
    label: REPRESENTANT_RELATION_LABELS[relation],
  })),
];

export function ListeSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
    </div>
  );
}

/**
 * L'annuaire, cherché par le SERVEUR : il compare le nom et le numéro réduit à
 * ses chiffres, donc « 77 123 45 67 » trouve la même fiche que « 771234567 ».
 */
export function ResultatsAnnuaire({
  annuaire,
  liste,
  critereEnCours,
  onOuvrir,
}: {
  annuaire: UseQueryResult<Awaited<ReturnType<typeof fetchRepresentantsAQualifier>>>;
  liste: readonly ScriptedRepresentant[];
  critereEnCours: boolean;
  onOuvrir: (row: ScriptedRepresentant) => void;
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

  if (liste.length === 0) {
    return (
      <p className="text-[0.9375rem]">
        {critereEnCours
          ? 'Aucun résultat parmi vos fiches. Vérifiez le nom ou le numéro, ou demandez une campagne.'
          : 'Aucune fiche ne vous est attribuée. Demandez une campagne.'}
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {liste.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => {
              onOuvrir(row);
            }}
            className={cn(
              'flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-border px-3 py-3 text-left',
              'hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[0.9375rem] font-[600]">{row.fullName}</span>
              <span className="text-[0.8125rem] text-muted-foreground">
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {formatPhone(row.phoneE164)}
                </span>
                {row.departementName === null ? '' : ` · ${row.departementName}`}
              </span>
            </span>
            <RelationBadge
              status={row.relationStatus}
              label={row.statutQualificationLabel}
              effect={row.statutQualificationEffect}
            />
          </button>
        </li>
      ))}
    </ol>
  );
}

export function FiltreRelation({
  value,
  onChange,
}: {
  value: RepresentantRelation | null;
  onChange: (valeur: RepresentantRelation | null) => void;
}) {
  const id = useId();

  return (
    <div className="flex min-w-[12rem] flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.875rem] font-[600]">
        Qualification
      </label>
      {/* `items` n'est pas décoratif : sans lui, le déclencheur affiche la
          VALEUR au lieu du libellé de la ligne choisie. */}
      <Select
        items={RELATION_ITEMS}
        value={value ?? 'tous'}
        onValueChange={(valeur) => {
          if (valeur === null) return;
          onChange(valeur === 'tous' ? null : (valeur as RepresentantRelation));
        }}
      >
        <SelectTrigger id={id} className="h-12">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RELATION_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function Pages({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={page <= 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        <ChevronLeftIcon aria-hidden="true" />
        Page précédente
      </Button>
      <span className="min-w-20 text-center text-[0.9375rem] tabular-nums">
        {page} / {pageCount}
      </span>
      <Button
        type="button"
        variant="outline"
        disabled={page >= pageCount}
        onClick={() => {
          onPage(page + 1);
        }}
      >
        Page suivante
        <ChevronRightIcon aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Le champ de recherche, en tête de la liste et jamais replié. */
export function ChampAnnuaire({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    champ.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="rep-annuaire" className="text-[0.875rem] font-[600]">
        Qui avez-vous appelé ?
      </label>
      <Input
        id="rep-annuaire"
        ref={champ}
        type="search"
        autoComplete="off"
        placeholder="Chercher un représentant : nom ou numéro"
        className="h-12 text-[1rem]"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}
