'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BoxesIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import { LotCreateDialog } from '@/components/lots-export/lot-create-dialog';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  campagnesPath,
  deleteLotExport,
  fetchLotsExport,
  type LotExportQuery,
} from '@/lib/data/lots-export';
import { formatDate, formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { readEnum, readPositiveInt, readString } from '@/lib/search-params';
import type { Projet } from '@/lib/types';
import { useDebouncedSearch } from '@/lib/use-debounced-search';

const TOUTES = 'TOUTES';

type FiltreCible = typeof TOUTES | 'PROSPECTS' | 'REPRESENTANTS';

const CIBLE_OPTIONS = [
  { value: TOUTES, label: 'Toutes les cibles' },
  { value: 'PROSPECTS', label: 'Prospects' },
  { value: 'REPRESENTANTS', label: 'Représentants' },
] as const;

type FiltresCampagnes = { search: string; cible: FiltreCible; page: number };

const FILTRES_VIDES: FiltresCampagnes = { search: '', cible: TOUTES, page: 1 };

const ADAPTATEUR: UrlFilterAdapter<FiltresCampagnes> = {
  parse: (params) => ({
    search: readString(params, 'search') ?? '',
    cible: readEnum(params, 'cible', ['PROSPECTS', 'REPRESENTANTS']) ?? TOUTES,
    page: readPositiveInt(params, 'page', 1),
  }),
  serialize: ({ search, cible, page }) => {
    const params = new URLSearchParams();
    if (search.trim() !== '') params.set('search', search.trim());
    if (cible !== TOUTES) params.set('cible', cible);
    if (page !== 1) params.set('page', String(page));
    return params;
  },
  cleared: () => FILTRES_VIDES,
};

function requeteLots({ search, cible, page }: FiltresCampagnes, projet: Projet): LotExportQuery {
  return {
    page,
    projet,
    ...(search.trim() === '' ? {} : { search: search.trim() }),
    ...(cible === TOUTES ? {} : { cible }),
  };
}

export function LotsExportView({
  canCreate,
  canDelete,
  projet,
}: {
  canCreate: boolean;
  canDelete: boolean;
  projet: Projet;
}) {
  const { filters, setFilters, resetFilters } = useUrlFilters(ADAPTATEUR);
  const { page, cible } = filters;
  const { draft: recherche, setDraft: setRecherche } = useDebouncedSearch(
    filters.search,
    (search) => {
      setFilters({ search });
    },
  );
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [aSupprimer, setASupprimer] = useState<{ id: string; name: string } | null>(null);

  const queryClient = useQueryClient();
  const suppression = useMutation({
    mutationFn: (lot: { id: string; name: string }) => deleteLotExport(lot.id),
    onSuccess: async (_reponse, lot) => {
      toast.success(`Campagne « ${lot.name} » supprimée.`);
      setASupprimer(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportRoot });
    },
    onError: (error) => {
      toastApiError(error, 'La campagne n’a pas pu être supprimée.');
    },
  });

  const requete = requeteLots(filters, projet);

  const lots = useQuery({
    queryKey: queryKeys.lotsExport(requete),
    queryFn: () => fetchLotsExport(requete),
    placeholderData: (precedent) => precedent,
  });

  const filtre = filters.search.trim() !== '' || cible !== TOUTES;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Le titre de la page est l'unique `h1`, rendu par la barre du panel. */}
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Une campagne répartit des fiches entre les téléconseillers et suit leur traitement.
        </p>
        {canCreate ? (
          <Button
            type="button"
            onClick={() => {
              setCreationOuverte(true);
            }}
          >
            <PlusIcon aria-hidden="true" />
            Nouvelle campagne
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="lots-recherche">Rechercher une campagne</Label>
          <Input
            id="lots-recherche"
            value={recherche}
            placeholder="Nom de la campagne"
            onChange={(event) => {
              setRecherche(event.target.value);
            }}
          />
        </div>
        {/* Pas de choix de cible en Grand Public : un lot de représentants est
            toujours CHUES, le filtre n'y rendrait jamais rien. */}
        {projet === 'GRAND_PUBLIC' ? null : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lots-cible">Cible</Label>
            <Select
              items={[...CIBLE_OPTIONS]}
              value={cible}
              onValueChange={(value) => {
                if (value !== null) setFilters({ cible: value });
              }}
            >
              <SelectTrigger id="lots-cible" className="min-w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CIBLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {(() => {
        if (lots.isPending)
          return (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-28 rounded-lg" />
              ))}
            </div>
          );

        if (lots.isError)
          return (
            <QueryErrorState
              error={lots.error}
              onRetry={() => {
                void lots.refetch();
              }}
              fallback="Les campagnes n’ont pas pu être chargées."
            />
          );

        if (lots.data.items.length === 0)
          return (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card py-16 text-center shadow-elev-sm">
              <BoxesIcon className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="font-[600]">
                {filtre
                  ? 'Aucune campagne ne correspond à ces critères.'
                  : 'Aucune campagne pour l’instant.'}
              </p>
              <p className="max-w-md text-[0.8125rem] text-muted-foreground">
                {filtre
                  ? 'Élargissez la recherche ou changez la cible.'
                  : 'Créez-en une pour répartir des fiches.'}
              </p>
              {filtre ? (
                <Button type="button" variant="outline" className="mt-2" onClick={resetFilters}>
                  <RotateCcwIcon aria-hidden="true" />
                  Effacer les filtres
                </Button>
              ) : null}
            </div>
          );

        return (
          <ul className="flex flex-col gap-3">
            {lots.data.items.map((lot) => (
              <li key={lot.id}>
                <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-elev-sm transition-all hover:border-primary/40">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                    <h2 className="flex flex-wrap items-center gap-2 font-display text-[1.0625rem] font-[700]">
                      <Link
                        href={`${campagnesPath(projet)}/${lot.id}`}
                        className="hover:underline focus-visible:underline"
                      >
                        {lot.name}
                      </Link>
                      {lot.pausedAt === null ? null : <Badge variant="warning">En pause</Badge>}
                    </h2>
                    <div className="flex items-center gap-2">
                      <p className="text-[0.8125rem] text-muted-foreground">
                        {formatDate(lot.createdAt)}, par {lot.createdByName}
                      </p>
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Supprimer ${lot.name}`}
                          onClick={() => {
                            setASupprimer({ id: lot.id, name: lot.name });
                          }}
                        >
                          <Trash2Icon className="size-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[0.875rem]">
                    <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                      {lot.scopeLabel}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatNumber(lot.itemCount)}
                    </span>{' '}
                    <span className="text-muted-foreground">
                      fiche{lot.itemCount > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[0.8125rem] text-muted-foreground">
                    {lot.callsSince === 0
                      ? 'Aucun appel consigné depuis la création.'
                      : `${formatNumber(lot.callsSince)} appels sur ${formatNumber(lot.fichesAppelees)} fiches depuis la création.`}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        );
      })()}

      {lots.data !== undefined && lots.data.pageCount > 1 ? (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Page précédente"
            disabled={page <= 1}
            onClick={() => {
              setFilters({ page: page - 1 });
            }}
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-20 text-center text-[0.8125rem] tabular-nums">
            {page} / {lots.data.pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Page suivante"
            disabled={page >= lots.data.pageCount}
            onClick={() => {
              setFilters({ page: page + 1 });
            }}
          >
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {canCreate ? (
        <LotCreateDialog open={creationOuverte} onOpenChange={setCreationOuverte} projet={projet} />
      ) : null}

      <ConfirmDialog
        open={aSupprimer !== null}
        onOpenChange={(ouvert) => {
          if (!ouvert) setASupprimer(null);
        }}
        title={`Supprimer « ${aSupprimer?.name ?? ''} » ?`}
        description="La campagne et sa répartition disparaissent. Les fiches et les appels déjà consignés restent en base."
        confirmLabel="Supprimer"
        pending={suppression.isPending}
        onConfirm={() => {
          if (aSupprimer) suppression.mutate(aSupprimer);
        }}
      />
    </div>
  );
}
