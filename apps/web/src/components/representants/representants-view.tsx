'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, UsersRoundIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { FilterCombobox } from '@/components/filters/filter-combobox';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchReferenceData } from '@/lib/data/reference';
import {
  DEFAULT_REPRESENTANT_FILTERS,
  fetchRepresentants,
  type RepresentantFilters,
} from '@/lib/data/representants';
import { formatDate, formatNumber, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

/**
 * Représentants — les personnes rencontrées sur le terrain qui remettent les
 * listes de prospects.
 *
 * L'écran est en LECTURE. Une fiche de représentant naît sur le mobile, pendant
 * une tournée, et le numéro de téléphone y sert de clé de déduplication : le
 * laisser modifier depuis le siège, sans le terrain au bout du fil, casserait
 * le rattachement des prospects déjà saisis. La colonne « Prospects » est donc
 * l'information centrale — c'est elle qui dit si une fiche compte.
 */
export function RepresentantsView() {
  const searchId = useId();

  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState<RepresentantFilters>(DEFAULT_REPRESENTANT_FILTERS);

  // Recherche appliquée après une pause de frappe : une requête par caractère
  // saturerait l'API sans rien apporter.
  useEffect(() => {
    if (searchDraft === filters.search) return;
    const timer = setTimeout(() => {
      setFilters((current) => ({ ...current, search: searchDraft, page: 1 }));
    }, 350);
    return () => {
      clearTimeout(timer);
    };
  }, [searchDraft, filters.search]);

  const { data: reference } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.representants(filters),
    queryFn: () => fetchRepresentants(filters),
    placeholderData: (previous) => previous,
  });

  const total = data?.total ?? 0;
  const page = data?.page ?? 1;
  const pageCount = data?.pageCount ?? 1;
  const first = total === 0 ? 0 : (page - 1) * filters.pageSize + 1;
  const last = Math.min(page * filters.pageSize, total);

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
        Personnes qui remettent les listes de prospects. Fiches créées depuis l’application mobile,
        en consultation seule ici.
      </p>

      <section
        aria-label="Filtres"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
      >
        <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
          <Label htmlFor={searchId}>Recherche</Label>
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={searchId}
              type="search"
              value={searchDraft}
              onChange={(event) => {
                setSearchDraft(event.target.value);
              }}
              placeholder="Nom ou téléphone…"
              className="pl-9"
            />
          </div>
        </div>

        <FilterCombobox
          label="Département"
          placeholder="Tous les départements"
          value={filters.departementId}
          options={(reference?.departements ?? []).map((departement) => ({
            value: departement.id,
            label: departement.name,
          }))}
          onChange={(value) => {
            setFilters((current) => ({ ...current, departementId: value, page: 1 }));
          }}
        />

        <FilterCombobox
          label="Commercial"
          placeholder="Tous les commerciaux"
          value={filters.commercialId}
          options={reference?.commerciaux ?? []}
          onChange={(value) => {
            setFilters((current) => ({ ...current, commercialId: value, page: 1 }));
          }}
        />
      </section>

      {isPending ? (
        <TableSkeleton />
      ) : isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="Liste des représentants non chargée."
        />
      ) : (
        <div
          className={cn(
            'overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm transition-opacity',
            isFetching && 'opacity-80',
          )}
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Représentant</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Département</TableHead>
                <TableHead>Saisi par</TableHead>
                <TableHead className="text-right">Prospects</TableHead>
                <TableHead>Première saisie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-16">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <UsersRoundIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                      <p className="font-[600]">Aucun représentant ne correspond à ces critères.</p>
                      <p className="text-[0.8125rem] text-muted-foreground">
                        Élargissez la recherche ou retirez un filtre.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((representant) => (
                  <TableRow key={representant.id}>
                    <TableCell className="font-[600]">{representant.fullName}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatPhone(representant.phoneE164)}
                    </TableCell>
                    <TableCell>{representant.departementName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {representant.createdByName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(representant.prospectCount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(representant.clientCreatedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/*
        Le pied de tableau n'existe QUE sur la branche chargée.

        Auparavant il vivait hors du ternaire d'état : pendant la première
        requête `total` vaut 0, et la région live annonçait donc « Aucun
        résultat » par-dessus le squelette — puis de nouveau par-dessus la carte
        d'erreur, qu'elle contredisait. La pagination affichait « 1 / 1 » dans
        les deux cas.
      */}
      {isPending || isError ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/*
          L'intitulé est DONNÉ EN TEXTE (`sr-only`), pas en `aria-label` :
          `aria-label` est interdit sur un `<p>` (rôle `paragraph`, liste « name
          prohibited » d'ARIA 1.2), et là où un lecteur d'écran l'honore quand
          même, le nom REMPLACE le contenu annoncé — l'utilisateur entendrait
          l'intitulé au lieu du décompte. Le préfixe suffit à distinguer cette
          région de celle du Toaster. `role="status"` implique déjà
          `aria-live="polite"`.
        */}
          <p className="text-[0.8125rem] text-muted-foreground" role="status">
            <span className="sr-only">Représentants affichés&nbsp;: </span>
            {total === 0
              ? 'Aucun résultat'
              : `${formatNumber(first)}–${formatNumber(last)} sur ${formatNumber(total)}`}
          </p>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Page précédente"
              disabled={page <= 1}
              onClick={() => {
                setFilters((current) => ({ ...current, page: current.page - 1 }));
              }}
            >
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
            </Button>
            <span className="min-w-20 text-center text-[0.8125rem] tabular-nums">
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Page suivante"
              disabled={page >= pageCount}
              onClick={() => {
                setFilters((current) => ({ ...current, page: current.page + 1 }));
              }}
            >
              <ChevronRightIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
      <div className="flex h-11 items-center gap-4 border-b border-border px-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {[0, 1, 2, 3, 4, 5, 6].map((index) => (
        <div key={index} className="flex items-center gap-4 border-b border-border px-3 py-4">
          {[0, 1, 2, 3, 4, 5].map((cell) => (
            <Skeleton key={cell} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
