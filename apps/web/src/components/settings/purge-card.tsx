'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseIcon, LoaderIcon, ShieldAlertIcon, TrashIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  canSubmitPurge,
  expandSelection,
  fetchPurgeCatalog,
  impliedDomains,
  runPurge,
  selectionRows,
  type PurgeDomain,
  type PurgeDomainKey,
} from '@/lib/data/admin';
import { formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

function resumeSelection(domaines: number, rows: number): string {
  if (domaines === 0) return 'Aucun domaine sélectionné.';
  const pluriel = rows > 1 ? 's' : '';
  return `${formatNumber(rows)} ligne${pluriel} concernée${pluriel}.`;
}

function phraseSuppression(rows: number): string {
  const pluriel = rows > 1 ? 's' : '';
  return `${formatNumber(rows)} ligne${pluriel} ser${rows > 1 ? 'ont' : 'a'} supprimée${pluriel}.`;
}

function ChoixDomaines({
  domains,
  selected,
  expanded,
  disabled,
  onToggle,
}: {
  domains: readonly PurgeDomain[];
  selected: readonly PurgeDomainKey[];
  expanded: readonly PurgeDomainKey[];
  disabled: boolean;
  onToggle: (key: PurgeDomainKey, checked: boolean) => void;
}) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">Domaines à supprimer</legend>
      {domains.map((domain) => {
        const checked = selected.includes(domain.key);
        const entrained = !checked && expanded.includes(domain.key);
        return (
          <label
            key={domain.key}
            className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 text-[0.875rem] transition-colors duration-(--dur-1) ease-(--ease-out-cpi) focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring ${
              checked || entrained
                ? 'border-destructive/40 bg-destructive-surface'
                : 'border-border'
            }`}
          >
            <input
              type="checkbox"
              checked={checked || entrained}
              disabled={disabled}
              className="mt-0.5 size-4 shrink-0 accent-[var(--destructive)]"
              onChange={(event) => {
                onToggle(domain.key, event.target.checked);
              }}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-[600]">{domain.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(domain.rows)}
                </span>
              </span>
              <span className="mt-0.5 block text-[0.75rem] text-muted-foreground">
                {domain.hint}
              </span>
              {entrained ? (
                <span className="mt-1 block text-[0.75rem] text-destructive">
                  Entraîné par un autre domaine sélectionné.
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function PurgeCard() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [selected, setSelected] = useState<PurgeDomainKey[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const confirmId = useId();

  const catalog = useQuery({
    queryKey: queryKeys.purgeCatalog,
    queryFn: () => fetchPurgeCatalog(),
  });

  const domains = useMemo<PurgeDomain[]>(() => catalog.data?.domains ?? [], [catalog.data]);
  const expanded = useMemo(() => expandSelection(selected, domains), [selected, domains]);
  const implied = useMemo(() => impliedDomains(selected, domains), [selected, domains]);
  const rows = useMemo(() => selectionRows(selected, domains), [selected, domains]);

  const purge = useMutation({
    mutationFn: () => runPurge({ domains: selected, confirmation }),
    onSuccess: (result) => {
      setConfirming(false);
      setConfirmation('');
      setSelected([]);
      void queryClient.invalidateQueries();
      router.refresh();
      toast.success(`${formatNumber(result.total)} lignes supprimées.`);
    },
    onError: (error) => {
      toastApiError(error, 'La suppression a échoué. Réessayez.');
    },
  });

  if (catalog.isPending) return <PurgeSkeleton />;

  if (catalog.isError) {
    return (
      <QueryErrorState
        error={catalog.error}
        onRetry={() => {
          void catalog.refetch();
        }}
        fallback="Les domaines n’ont pas pu être lus. Réessayez."
      />
    );
  }

  const data = catalog.data;
  const allSelected = selected.length === domains.length && domains.length > 0;

  function toggle(key: PurgeDomainKey, checked: boolean): void {
    setSelected((current) =>
      checked ? [...new Set([...current, key])] : current.filter((entry) => entry !== key),
    );
  }

  return (
    <>
      <Card className="animate-rise">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <DatabaseIcon className="size-4" aria-hidden="true" />
                Suppression des données
              </CardTitle>
              <CardDescription>
                Sélection par domaine. La suppression est définitive.
              </CardDescription>
            </div>
            <Badge variant="destructive">Irréversible</Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {!data.allowed ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-md border border-accent-border/40 bg-accent-surface px-3 py-2.5 text-[0.8125rem] text-warning"
            >
              <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>Réservé au premier compte administrateur.</span>
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[0.8125rem] text-muted-foreground">
                  {resumeSelection(selected.length, rows)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelected(allSelected ? [] : domains.map((domain) => domain.key));
                  }}
                >
                  {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                </Button>
              </div>

              <ChoixDomaines
                domains={domains}
                selected={selected}
                expanded={expanded}
                disabled={purge.isPending}
                onToggle={toggle}
              />

              {implied.length > 0 ? (
                <p
                  role="status"
                  className="rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.8125rem] text-destructive"
                >
                  <span className="font-[600]">Domaines entraînés :</span>{' '}
                  {implied
                    .map((key) => domains.find((domain) => domain.key === key)?.label ?? key)
                    .join(', ')}
                  .
                </p>
              ) : null}

              <div>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={selected.length === 0 || purge.isPending}
                  onClick={() => {
                    setConfirmation('');
                    setConfirming(true);
                  }}
                >
                  <TrashIcon aria-hidden="true" />
                  Supprimer la sélection
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open && purge.isPending) return;
          setConfirming(open);
          if (!open) setConfirmation('');
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Supprimer définitivement ?</DialogTitle>
            <DialogDescription>
              {phraseSuppression(rows)} Aucune restauration n’est possible.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1 rounded-md border border-border p-3 text-[0.875rem]">
              {expanded.map((key) => {
                const domain = domains.find((entry) => entry.key === key);
                return (
                  <li key={key} className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">{domain?.label ?? key}</span>
                    <span className="font-[600] tabular-nums">
                      {formatNumber(domain?.rows ?? 0)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="rounded-md border border-border px-3 py-2.5 text-[0.875rem]">
              Les comptes administrateurs sont conservés.
            </p>

            <div className="flex flex-col gap-2">
              {/* Le libellé NOMME le champ ; c'est le repère grisé qui montre
                  ce qu'il attend. Une phrase impérative en guise de libellé
                  (« Saisissez untel pour confirmer ») transforme un formulaire
                  en mode d'emploi, et se lit deux fois moins vite. */}
              <label htmlFor={confirmId} className="text-[0.875rem] font-[600]">
                Identifiant de connexion
              </label>
              <Input
                id={confirmId}
                value={confirmation}
                placeholder={data.confirmationHint}
                autoComplete="off"
                spellCheck={false}
                disabled={purge.isPending}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={purge.isPending}
              onClick={() => {
                setConfirming(false);
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                !canSubmitPurge({
                  catalog: data,
                  selected,
                  confirmation,
                  pending: purge.isPending,
                })
              }
              onClick={() => {
                purge.mutate();
              }}
            >
              {purge.isPending ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                  Suppression
                </>
              ) : (
                <>
                  <TrashIcon aria-hidden="true" />
                  Supprimer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PurgeSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-3 w-full max-w-md" />
        <div className="grid gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
        <Skeleton className="h-11 w-56" />
      </CardContent>
    </Card>
  );
}
