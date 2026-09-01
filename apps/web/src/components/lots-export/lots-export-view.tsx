'use client';

import { useQuery } from '@tanstack/react-query';
import { BoxesIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { LotCreateDialog } from '@/components/lots-export/lot-create-dialog';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
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
import { fetchLotsExport, type LotExportQuery } from '@/lib/data/lots-export';
import { formatDate, formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { useDebouncedValue } from '@/lib/use-debounced-value';

const TOUTES = 'TOUTES';

type FiltreCible = typeof TOUTES | 'PROSPECTS' | 'REPRESENTANTS';

const CIBLE_OPTIONS = [
  { value: TOUTES, label: 'Toutes les cibles' },
  { value: 'PROSPECTS', label: 'Prospects' },
  { value: 'REPRESENTANTS', label: 'Représentants' },
] as const;

function requeteLots(page: number, recherche: string, cible: FiltreCible): LotExportQuery {
  return {
    page,
    ...(recherche.trim() === '' ? {} : { search: recherche.trim() }),
    ...(cible === TOUTES ? {} : { cible }),
  };
}

export function LotsExportView({ canCreate }: { canCreate: boolean }) {
  const [recherche, setRecherche] = useState('');
  const [cible, setCible] = useState<FiltreCible>(TOUTES);
  const [page, setPage] = useState(1);
  const [creationOuverte, setCreationOuverte] = useState(false);

  const rechercheDifferee = useDebouncedValue(recherche);
  const requete = requeteLots(page, rechercheDifferee, cible);

  const lots = useQuery({
    queryKey: queryKeys.lotsExport(requete),
    queryFn: () => fetchLotsExport(requete),
    placeholderData: (precedent) => precedent,
  });

  const filtre = rechercheDifferee.trim() !== '' || cible !== TOUTES;

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
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lots-cible">Cible</Label>
          <Select
            items={[...CIBLE_OPTIONS]}
            value={cible}
            onValueChange={(value) => {
              if (value === null) return;
              setCible(value);
              setPage(1);
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
            </div>
          );

        return (
          <ul className="flex flex-col gap-3">
            {lots.data.items.map((lot) => (
              <li key={lot.id}>
                <article className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-elev-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 className="font-display text-[1.0625rem] font-[700]">
                      <Link
                        href={`/chues/campagnes/${lot.id}`}
                        className="hover:underline focus-visible:underline"
                      >
                        {lot.name}
                      </Link>
                    </h2>
                    <p className="text-[0.8125rem] text-muted-foreground">
                      {formatDate(lot.createdAt)}, par {lot.createdByName}
                    </p>
                  </div>
                  <p className="text-[0.875rem]">
                    {lot.scopeLabel} ·{' '}
                    <span className="tabular-nums">{formatNumber(lot.itemCount)}</span> fiche
                    {lot.itemCount > 1 ? 's' : ''}
                  </p>
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
              setPage(page - 1);
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
              setPage(page + 1);
            }}
          >
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {canCreate ? (
        <LotCreateDialog open={creationOuverte} onOpenChange={setCreationOuverte} />
      ) : null}
    </div>
  );
}
