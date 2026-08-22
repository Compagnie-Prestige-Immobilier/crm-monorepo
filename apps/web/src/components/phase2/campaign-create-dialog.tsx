'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, ArrowLeftIcon, CheckIcon, LoaderIcon, UsersIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
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
import { SpreadDaysField, SpreadPreview } from '@/components/phase2/spread-days-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { createCampaign, fetchCampaignPreview, MIN_SPREAD_DAYS } from '@/lib/data/phase2';
import { fetchReferenceData } from '@/lib/data/reference';
import { formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  CAMPAIGN_SCOPES,
  campaignScopeLabel,
  type CampaignScope,
  type FilterOption,
} from '@/lib/types';
import { cn } from '@/lib/utils';

type Step = 'saisie' | 'apercu';

export function CampaignCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const projet = pathname.startsWith('/grand-public') ? 'GRAND_PUBLIC' : 'CHUES';
  const scopes = CAMPAIGN_SCOPES.filter(
    (candidate) =>
      candidate === 'ALL' ||
      (projet === 'GRAND_PUBLIC' ? candidate.startsWith('GP') : candidate.startsWith('BDD')),
  );
  const queryClient = useQueryClient();
  const nameId = useId();

  const [step, setStep] = useState<Step>('saisie');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<CampaignScope>('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [spreadDays, setSpreadDays] = useState(MIN_SPREAD_DAYS);

  const reference = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const commerciaux: readonly FilterOption[] = reference.data?.commerciaux ?? [];

  const preview = useQuery({
    queryKey: queryKeys.campaignPreview(scope, selected.length, spreadDays),
    queryFn: () => fetchCampaignPreview(scope, selected.length, spreadDays, projet),
    enabled: open && step === 'apercu' && selected.length > 0,
    staleTime: 15_000,
  });

  const trimmedName = name.trim();
  const nameValid = trimmedName.length >= 3 && trimmedName.length <= 120;
  const canPreview = nameValid && selected.length > 0;

  const create = useMutation({
    mutationFn: () =>
      createCampaign({ name: trimmedName, projet, scope, commercialIds: selected, spreadDays }),
    onSuccess: (campaign) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaignsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
      toast.success(
        `Campagne « ${campaign.name} » créée : ${formatNumber(campaign.progress.total)} appels répartis entre ${formatNumber(campaign.commercialCount)} téléconseillers.`,
      );
      reset();
      onOpenChange(false);
      router.push(
        `${projet === 'GRAND_PUBLIC' ? '/grand-public' : '/chues'}/campagnes/${campaign.id}`,
      );
    },
    onError: (error) => {
      toastApiError(error, 'La campagne n’a pas pu être créée.');
    },
  });

  function reset(): void {
    setStep('saisie');
    setName('');
    setScope('ALL');
    setSelected([]);
    setSpreadDays(MIN_SPREAD_DAYS);
  }

  function toggle(id: string): void {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  const selectedNames = useMemo(
    () =>
      selected.map(
        (id) => commerciaux.find((option) => option.value === id)?.label ?? 'Téléconseiller',
      ),
    [selected, commerciaux],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && create.isPending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 'saisie' ? 'Nouvelle campagne d’appels' : 'Aperçu du tirage'}
          </DialogTitle>
          <DialogDescription>
            {step === 'saisie'
              ? 'Le tirage est définitif.'
              : 'Les prospects tirés sont retirés des campagnes suivantes.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'saisie' ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={nameId}>
                Nom de la campagne
                <span className="text-destructive" aria-label="obligatoire">
                  *
                </span>
              </Label>
              <Input
                id={nameId}
                value={name}
                maxLength={120}
                autoComplete="off"
                onChange={(event) => {
                  setName(event.target.value);
                }}
                aria-invalid={trimmedName !== '' && !nameValid}
                aria-describedby={`${nameId}-aide`}
              />
              <p id={`${nameId}-aide`} className="text-[0.75rem] text-muted-foreground">
                Trois caractères minimum. Repris sur les programmes imprimés.
              </p>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="pb-1.5 text-[0.8125rem] font-[600] text-foreground">
                Périmètre
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {scopes.map((candidate) => (
                  <label
                    key={candidate}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 text-[0.875rem]',
                      'transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
                      scope === candidate
                        ? 'border-primary bg-secondary text-secondary-foreground'
                        : 'border-border hover:bg-secondary/60',
                    )}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value={candidate}
                      checked={scope === candidate}
                      className="mt-0.5 size-4 accent-[var(--primary)]"
                      onChange={() => {
                        setScope(candidate);
                      }}
                    />
                    <span className="min-w-0">{campaignScopeLabel(candidate)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <SpreadDaysField value={spreadDays} onChange={setSpreadDays} />

            <fieldset className="flex flex-col gap-2">
              <legend className="pb-1.5 text-[0.8125rem] font-[600] text-foreground">
                Téléconseillers
                <span className="text-destructive" aria-label="obligatoire">
                  *
                </span>
              </legend>
              <p className="text-[0.75rem] text-muted-foreground">
                L’ordre de sélection fixe l’ordre du tourniquet.
              </p>

              {reference.isPending ? (
                <div className="flex flex-col gap-2" aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="h-11 w-full" />
                  ))}
                </div>
              ) : commerciaux.length === 0 ? (
                <p role="status" className="rounded-md bg-muted px-3 py-4 text-[0.8125rem]">
                  Aucun compte téléconseiller. Créez-en un depuis l’écran Téléconseillers.
                </p>
              ) : (
                <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border border-border p-1 scrollbar-thin">
                  {commerciaux.map((option) => {
                    const rank = selected.indexOf(option.value);
                    return (
                      <li key={option.value}>
                        <label
                          className={cn(
                            'flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-[0.875rem]',
                            'transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
                            rank >= 0 ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={rank >= 0}
                            className="size-4 accent-[var(--primary)]"
                            onChange={() => {
                              toggle(option.value);
                            }}
                          />
                          <span className="min-w-0 flex-1 truncate">{option.label}</span>
                          {option.hint !== undefined && option.hint !== '' ? (
                            <span className="shrink-0 text-[0.75rem] text-muted-foreground">
                              {option.hint}
                            </span>
                          ) : null}
                          {rank >= 0 ? (
                            <Badge variant="default" className="shrink-0 tabular-nums">
                              {rank + 1}
                            </Badge>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
          </div>
        ) : (
          <CampaignPreviewPanel
            scope={scope}
            selectedNames={selectedNames}
            isPending={preview.isPending}
            isError={preview.isError}
            data={preview.data ?? null}
            onRetry={() => {
              void preview.refetch();
            }}
          />
        )}

        <DialogFooter>
          {step === 'saisie' ? (
            <>
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
                disabled={!canPreview}
                onClick={() => {
                  setStep('apercu');
                }}
              >
                Voir l’aperçu
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={create.isPending}
                onClick={() => {
                  setStep('saisie');
                }}
              >
                <ArrowLeftIcon aria-hidden="true" />
                Modifier
              </Button>
              <Button
                type="button"
                disabled={create.isPending || preview.isPending || preview.isError}
                onClick={() => {
                  create.mutate();
                }}
              >
                {create.isPending ? (
                  <>
                    <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                    Tirage en cours…
                  </>
                ) : (
                  <>
                    <CheckIcon aria-hidden="true" />
                    Lancer la campagne
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampaignPreviewPanel({
  scope,
  selectedNames,
  isPending,
  isError,
  data,
  onRetry,
}: {
  scope: CampaignScope;
  selectedNames: readonly string[];
  isPending: boolean;
  isError: boolean;
  data: {
    pending: number;
    alreadyAssigned: number;
    maximum: number;
    perCommercial: number[];
    spreadDays: number;
    perDay: number[];
  } | null;
  onRetry: () => void;
}) {
  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-md border border-destructive/30 bg-destructive-surface p-4"
      >
        <p className="text-[0.875rem] text-destructive">
          Le décompte des prospects éligibles n’a pas pu être calculé. Réessayez.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (isPending || data === null) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-24 w-full rounded-md" />
        <Skeleton className="h-32 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* `role="status"` : le chiffre arrive après un aller-retour réseau. Sans
          annonce, un utilisateur de lecteur d'écran confirmerait sans jamais
          l'avoir entendu. */}
      <div
        role="status"
        className="rounded-md border border-accent-border/40 bg-accent-surface p-4"
      >
        <p className="text-[0.75rem] font-[600] uppercase tracking-wide text-warning">
          Maximum à distribuer
        </p>
        <p className="mt-1 font-display text-[2rem] font-[800] leading-none tracking-[-0.02em] text-foreground tabular-nums">
          {formatNumber(data.maximum)}
          <span className="ml-2 font-sans text-[0.9375rem] font-[400] text-muted-foreground">
            prospects
          </span>
        </p>
        <p className="mt-2 text-[0.8125rem] text-warning">{campaignScopeLabel(scope)}</p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border p-3">
          <dt className="text-[0.75rem] text-muted-foreground">En attente</dt>
          <dd className="mt-0.5 text-[1.125rem] font-[600] tabular-nums">
            {formatNumber(data.pending)}
          </dd>
        </div>
        <div className="rounded-md border border-border p-3">
          <dt className="text-[0.75rem] text-muted-foreground">Déjà affectés</dt>
          <dd className="mt-0.5 text-[1.125rem] font-[600] tabular-nums">
            {formatNumber(data.alreadyAssigned)}
          </dd>
        </div>
      </dl>

      <p className="flex items-start gap-2 text-[0.75rem] text-muted-foreground">
        <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {/* On dit « au maximum » plutôt que d'annoncer un total exact : le
            serveur exclut au moment du tirage les prospects déjà pris par une
            campagne concurrente, et il est seul à connaître leur segment. Le
            chiffre affiché est une borne haute : le dire vaut mieux que
            promettre un total qui pourrait être plus bas de quelques unités. */}
        Borne haute : le total réel peut être inférieur.
      </p>

      <SpreadPreview spreadDays={data.spreadDays} perDay={data.perDay} />

      <div>
        <h3 className="flex items-center gap-2 pb-2 text-[0.8125rem] font-[600]">
          <UsersIcon className="size-4" aria-hidden="true" />
          Répartition en tourniquet
        </h3>
        <ul className="flex flex-col gap-1">
          {selectedNames.map((label, index) => (
            <li
              key={`${label}-${String(index)}`}
              className="flex items-center justify-between gap-3 rounded-sm bg-muted px-3 py-2 text-[0.875rem]"
            >
              <span className="min-w-0 truncate">
                <span className="mr-2 text-muted-foreground tabular-nums">{index + 1}.</span>
                {label}
              </span>
              <span className="shrink-0 font-[600] tabular-nums">
                {formatNumber(data.perCommercial[index] ?? 0)} appels
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
