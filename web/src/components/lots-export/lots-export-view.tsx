'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BoxesIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

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
  deleteLotExport,
  fetchLotsExport,
  TELECONSEIL_CAMPAGNES_PATH,
  type LotExportQuery,
  type LotExportSummary,
} from '@/lib/data/lots-export';
import { formatDate, formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';
import { useDebouncedValue } from '@/lib/use-debounced-value';

const TOUTES = 'TOUTES';
const TOUS_PROJETS = 'TOUS_PROJETS';

type FiltreCible =
  | typeof TOUTES
  | 'PROSPECTS'
  | 'REPRESENTANTS'
  | 'REPRESENTANTS_INJOIGNABLES'
  | 'CONTACTS_RECOMMANDES';

const CIBLE_OPTIONS = [
  { value: TOUTES, label: 'Toutes les cibles' },
  { value: 'PROSPECTS', label: 'Prospects' },
  { value: 'REPRESENTANTS', label: 'Représentants' },
  { value: 'REPRESENTANTS_INJOIGNABLES', label: 'Représentants injoignables' },
  { value: 'CONTACTS_RECOMMANDES', label: 'Contacts recommandés' },
] as const;

const PROJET_OPTIONS = [
  { value: TOUS_PROJETS, label: 'Tous les projets' },
  { value: 'CHUES', label: 'CHUES' },
  { value: 'GRAND_PUBLIC', label: 'Grand Public' },
] as const;

function requeteLots(
  page: number,
  recherche: string,
  cible: FiltreCible,
  projet: Projet | null,
): LotExportQuery {
  return {
    page,
    ...(projet === null ? {} : { projet }),
    ...(recherche.trim() === '' ? {} : { search: recherche.trim() }),
    ...(cible === TOUTES ? {} : { cible }),
  };
}

function LotsFilterBar({
  projetFiltre,
  recherche,
  cible,
  onProjetChange,
  onRechercheChange,
  onCibleChange,
}: {
  projetFiltre: Projet | null;
  recherche: string;
  cible: FiltreCible;
  onProjetChange: (p: Projet | null) => void;
  onRechercheChange: (r: string) => void;
  onCibleChange: (c: FiltreCible) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lots-projet">Projet</Label>
        <Select
          items={[...PROJET_OPTIONS]}
          value={projetFiltre ?? TOUS_PROJETS}
          onValueChange={(value) => {
            if (value === null) return;
            onProjetChange(value === TOUS_PROJETS ? null : (value as Projet));
          }}
        >
          <SelectTrigger id="lots-projet" className="min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROJET_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-56 flex-1 flex-col gap-1.5">
        <Label htmlFor="lots-recherche">Rechercher une campagne</Label>
        <Input
          id="lots-recherche"
          value={recherche}
          placeholder="Nom de la campagne"
          onChange={(event) => onRechercheChange(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lots-cible">Cible</Label>
        <Select
          items={[...CIBLE_OPTIONS]}
          value={cible}
          onValueChange={(value) => {
            if (value === null) return;
            onCibleChange(value as FiltreCible);
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
  );
}

function LotsPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount?: number | undefined;
  onPageChange: (p: number) => void;
}) {
  if (pageCount === undefined || pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="outline"
        size="icon"
        aria-label="Page précédente"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
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
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRightIcon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function LotsExportView({
  canCreate,
  canDelete,
  projet: initialProjet = null,
}: {
  canCreate: boolean;
  canDelete: boolean;
  projet?: Projet | null;
}) {
  const [recherche, setRecherche] = useState('');
  const [cible, setCible] = useState<FiltreCible>(TOUTES);
  const [projetFiltre, setProjetFiltre] = useState<Projet | null>(initialProjet);
  const [page, setPage] = useState(1);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [aSupprimer, setASupprimer] = useState<{ id: string; name: string } | null>(null);

  const queryClient = useQueryClient();
  const suppression = useMutation({
    mutationFn: (id: string) => deleteLotExport(id),
    onSuccess: async () => {
      toast.success('Campagne supprimée.');
      setASupprimer(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportRoot });
    },
    onError: (error) => {
      toastApiError(error, 'La campagne n’a pas pu être supprimée.');
    },
  });

  const rechercheDifferee = useDebouncedValue(recherche);
  const requete = requeteLots(page, rechercheDifferee, cible, projetFiltre);

  const lots = useQuery({
    queryKey: queryKeys.lotsExport(requete),
    queryFn: () => fetchLotsExport(requete),
    placeholderData: (precedent) => precedent,
  });

  const filtre = rechercheDifferee.trim() !== '' || cible !== TOUTES || projetFiltre !== null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Une campagne répartit des fiches entre les téléconseillers et suit leur traitement.
        </p>
        {canCreate ? (
          <Button type="button" onClick={() => setCreationOuverte(true)}>
            <PlusIcon aria-hidden="true" />
            Nouvelle campagne
          </Button>
        ) : null}
      </div>

      <LotsFilterBar
        projetFiltre={projetFiltre}
        recherche={recherche}
        cible={cible}
        onProjetChange={(p) => {
          setProjetFiltre(p);
          setPage(1);
        }}
        onRechercheChange={(r) => {
          setRecherche(r);
          setPage(1);
        }}
        onCibleChange={(c) => {
          setCible(c);
          setPage(1);
        }}
      />

      <LotsContent
        isPending={lots.isPending}
        isError={lots.isError}
        error={lots.error}
        items={lots.data?.items}
        refetch={lots.refetch}
        filtre={filtre}
        canCreate={canCreate}
        canDelete={canDelete}
        onOpenCreate={() => setCreationOuverte(true)}
        onDelete={(item) => setASupprimer(item)}
      />

      <LotsPagination
        page={page}
        pageCount={lots.data?.pageCount}
        onPageChange={(p) => setPage(p)}
      />

      {canCreate ? (
        <LotCreateDialog
          open={creationOuverte}
          onOpenChange={setCreationOuverte}
          projet={projetFiltre}
        />
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
          if (aSupprimer) suppression.mutate(aSupprimer.id);
        }}
      />
    </div>
  );
}

function LotsContent({
  isPending,
  isError,
  error,
  items,
  refetch,
  filtre,
  canCreate,
  canDelete,
  onOpenCreate,
  onDelete,
}: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  items?: LotExportSummary[] | undefined;
  refetch: () => Promise<unknown>;
  filtre: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onOpenCreate: () => void;
  onDelete: (item: { id: string; name: string }) => void;
}) {
  if (isPending)
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>
    );

  if (isError)
    return (
      <QueryErrorState
        error={error}
        onRetry={() => {
          refetch().catch(() => {});
        }}
        fallback="Les campagnes n’ont pas pu être chargées."
      />
    );

  if (items === undefined || items.length === 0)
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-16 text-center shadow-elev-sm">
        <BoxesIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="font-[600]">
            {filtre
              ? 'Aucune campagne ne correspond à ces critères.'
              : 'Aucune campagne pour l’instant.'}
          </p>
          <p className="max-w-md text-[0.8125rem] text-muted-foreground">
            {filtre
              ? 'Élargissez la recherche ou changez la cible.'
              : 'Créez-en une pour répartir des fiches entre les téléconseillers.'}
          </p>
        </div>
        {!filtre && canCreate ? (
          <Button type="button" className="mt-2" onClick={onOpenCreate}>
            <PlusIcon aria-hidden="true" />
            Nouvelle campagne
          </Button>
        ) : null}
      </div>
    );

  return (
    <ul className="flex flex-col gap-3">
      {items.map((lot) => (
        <li key={lot.id}>
          <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-elev-sm transition-all hover:border-primary/40">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <h2 className="flex flex-wrap items-center gap-2 font-display text-[1.0625rem] font-[700]">
                <Link
                  href={`${TELECONSEIL_CAMPAGNES_PATH}/${lot.id}`}
                  className="hover:underline focus-visible:underline"
                >
                  {lot.name}
                </Link>
                {lot.pausedAt === null ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="warning">En pause</Badge>
                )}
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
                      onDelete({ id: lot.id, name: lot.name });
                    }}
                  >
                    <Trash2Icon className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[0.875rem]">
              <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                {lot.scopeLabel}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatNumber(lot.itemCount)}
              </span>{' '}
              <span className="text-muted-foreground">fiche{lot.itemCount > 1 ? 's' : ''}</span>
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
}
