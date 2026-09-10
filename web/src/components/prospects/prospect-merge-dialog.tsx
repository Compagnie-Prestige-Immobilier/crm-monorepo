'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, ArrowRightIcon, LoaderIcon, SearchIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchProspects, mergeProspects } from '@/lib/data/prospects';
import { EMPTY_FILTERS } from '@/lib/filters';
import { formatDate, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { PROSPECT_STATUT_LABELS, type Paginated, type ProspectRow } from '@/lib/types';
import { useDebouncedSearch } from '@/lib/use-debounced-search';
import { cn } from '@/lib/utils';

function pairForMerge<T extends ProspectRow | null>(
  prospect: ProspectRow,
  duplicate: T,
  keepOriginal: boolean,
): { survivor: ProspectRow | T; absorbed: ProspectRow | T } {
  return keepOriginal
    ? { survivor: prospect, absorbed: duplicate }
    : { survivor: duplicate, absorbed: prospect };
}

function mergeButtonLabel(survivor: ProspectRow | null): string {
  if (survivor === null) return 'Fusionner';
  return `Conserver ${survivor.prenom} ${survivor.nom}`;
}

export function ProspectMergeDialog({
  prospect,
  onOpenChange,
}: {
  prospect: ProspectRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const searchId = useId();

  const [search, setSearch] = useState('');
  const [duplicate, setDuplicate] = useState<ProspectRow | null>(null);
  const [keepOriginal, setKeepOriginal] = useState(true);

  const {
    draft: searchDraft,
    setDraft: setSearchDraft,
    reset: resetSearch,
  } = useDebouncedSearch(search, setSearch);

  useEffect(() => {
    if (prospect === null) return;
    resetSearch('');
    // oxlint-disable-next-line react/set-state-in-effect -- saisie recalée sur le prospect
    setSearch('');
    setDuplicate(null);
    setKeepOriginal(true);
  }, [prospect, resetSearch]);

  const candidateFilters = { ...EMPTY_FILTERS, search, pageSize: 10 };

  const { data: candidates, isFetching } = useQuery({
    queryKey: queryKeys.prospects(candidateFilters),
    queryFn: () => fetchProspects(candidateFilters),
    enabled: prospect !== null && search.trim().length >= 2,
  });

  const merge = useMutation({
    mutationFn: () => {
      if (prospect === null || duplicate === null) {
        throw new Error('Sélectionnez la fiche à fusionner.');
      }
      const { survivor, absorbed } = pairForMerge(prospect, duplicate, keepOriginal);
      return mergeProspects({
        targetId: survivor.id,
        sourceId: absorbed.id,
        preferSource: false,
      });
    },
    onSuccess: (survivor) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
      toast.success(`Fusion effectuée. Fiche conservée : ${survivor.prenom} ${survivor.nom}.`);
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'La fusion a échoué. Aucune fiche n’a été modifiée.');
    },
  });

  if (prospect === null) return null;

  const { survivor, absorbed } = pairForMerge(prospect, duplicate, keepOriginal);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Fusionner deux doublons</DialogTitle>
          <DialogDescription>
            Choisissez la fiche à conserver. L’autre est supprimée, son historique suit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor={searchId}>Fiche en double</Label>
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
              placeholder="Nom ou téléphone (2 caractères minimum)…"
              className="pl-9"
            />
          </div>

          {search.trim().length >= 2 ? (
            <MergeCandidatesList
              isFetching={isFetching}
              candidates={candidates}
              excludeId={prospect.id}
              duplicate={duplicate}
              onSelect={setDuplicate}
            />
          ) : null}
        </div>

        {duplicate === null ? null : (
          <>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-[0.875rem] font-[600]">Fiche conservée</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <ProspectCard
                  prospect={prospect}
                  selected={keepOriginal}
                  onSelect={() => {
                    setKeepOriginal(true);
                  }}
                  name="fusion-survivant"
                />
                <ProspectCard
                  prospect={duplicate}
                  selected={!keepOriginal}
                  onSelect={() => {
                    setKeepOriginal(false);
                  }}
                  name="fusion-survivant"
                />
              </div>
            </fieldset>

            <MergeWarning absorbed={absorbed} survivor={survivor} />
          </>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={duplicate === null || merge.isPending}
            onClick={() => {
              merge.mutate();
            }}
          >
            {merge.isPending ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowRightIcon aria-hidden="true" />
            )}
            {mergeButtonLabel(survivor)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MergeCandidatesList({
  isFetching,
  candidates,
  excludeId,
  duplicate,
  onSelect,
}: {
  isFetching: boolean;
  candidates: Paginated<ProspectRow> | undefined;
  excludeId: string;
  duplicate: ProspectRow | null;
  onSelect: (row: ProspectRow) => void;
}) {
  if (isFetching && candidates === undefined) {
    return (
      <div className="max-h-52 overflow-y-auto rounded-md border border-border scrollbar-thin">
        <MergeCandidatesSkeleton />
      </div>
    );
  }

  const rows = (candidates?.items ?? []).filter((row) => row.id !== excludeId);

  return (
    <div className="max-h-52 overflow-y-auto rounded-md border border-border scrollbar-thin">
      <MergeCandidatesRows rows={rows} selectedId={duplicate?.id ?? null} onSelect={onSelect} />
    </div>
  );
}

function MergeCandidatesSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

function MergeCandidatesRows({
  rows,
  selectedId,
  onSelect,
}: {
  rows: ProspectRow[];
  selectedId: string | null;
  onSelect: (row: ProspectRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="p-4 text-center text-[0.8125rem] text-muted-foreground">
        Aucune autre fiche ne correspond.
      </p>
    );
  }

  return (
    <ul>
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => {
              onSelect(row);
            }}
            aria-pressed={selectedId === row.id}
            className={cn(
              'flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left',
              'transition-colors hover:bg-secondary',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
              selectedId === row.id && 'bg-secondary',
            )}
          >
            <span className="min-w-0">
              <span className="block truncate font-[600]">
                {row.prenom} {row.nom}
              </span>
              <span className="block truncate text-[0.75rem] text-muted-foreground">
                {formatPhone(row.phoneE164)} · {row.representantName}
              </span>
            </span>
            <span className="shrink-0 text-[0.75rem] text-muted-foreground">
              {formatDate(row.clientCreatedAt)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function MergeWarning({
  absorbed,
  survivor,
}: {
  absorbed: ProspectRow | null;
  survivor: ProspectRow | null;
}) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.8125rem] text-destructive"
    >
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        Cette opération est <strong>irréversible</strong>. La fiche{' '}
        <strong>
          {absorbed?.prenom} {absorbed?.nom}
        </strong>{' '}
        sera supprimée ; la fiche conservée sera{' '}
        <strong>
          {survivor?.prenom} {survivor?.nom}
        </strong>
        .
      </span>
    </p>
  );
}

function ProspectCard({
  prospect,
  selected,
  onSelect,
  name,
}: {
  prospect: ProspectRow;
  selected: boolean;
  onSelect: () => void;
  name: string;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col gap-2 rounded-md border-2 p-3 transition-colors',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
        selected ? 'border-primary bg-secondary' : 'border-border hover:bg-secondary/50',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <input
            type="radio"
            name={name}
            checked={selected}
            onChange={onSelect}
            className="sr-only"
          />
          <span className="font-[600]">
            {prospect.prenom} {prospect.nom}
          </span>
        </span>
        {selected ? <Badge>Conservée</Badge> : <Badge variant="outline">Absorbée</Badge>}
      </span>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.8125rem]">
        <dt className="text-muted-foreground">Téléphone</dt>
        <dd className="truncate tabular-nums">{formatPhone(prospect.phoneE164)}</dd>
        <dt className="text-muted-foreground">Statut</dt>
        <dd>{PROSPECT_STATUT_LABELS[prospect.statut]}</dd>
        <dt className="text-muted-foreground">Représentant</dt>
        <dd className="truncate">{prospect.representantName}</dd>
        <dt className="text-muted-foreground">Banque</dt>
        <dd className="truncate">{prospect.banqueName}</dd>
        <dt className="text-muted-foreground">Syndicat</dt>
        <dd className="truncate">{prospect.syndicatSigle}</dd>
        <dt className="text-muted-foreground">Téléconseiller</dt>
        <dd className="truncate">{prospect.ownedByCommercialName}</dd>
        <dt className="text-muted-foreground">Saisi le</dt>
        <dd className="tabular-nums">{formatDate(prospect.clientCreatedAt)}</dd>
      </dl>
    </label>
  );
}
