'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, ArrowLeftIcon, CheckIcon, LoaderIcon, UsersIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SpreadDaysField, SpreadPreview } from '@/components/phase2/spread-days-field';
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
import { MIN_SPREAD_DAYS } from '@/lib/data/phase2';
import { fetchReferenceData } from '@/lib/data/reference';
import {
  createRepCampaign,
  fetchRepCampaignPreview,
  type RepCampaignPreview,
  type RepCampaignScope,
} from '@/lib/data/rep-campaigns';
import { formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { FilterOption } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Création d'une campagne d'appels REPRÉSENTANTS : nom → périmètre →
 * étalement → commerciaux → APERÇU.
 *
 * Même dispositif que pour les prospects, et pour la même raison : le tirage
 * est IRRÉVERSIBLE. Il matérialise une tâche par représentant, rend ces fiches
 * inéligibles à toute autre campagne, et la seule façon de revenir en arrière
 * est de clôturer, ce qui annule aussi les appels déjà en cours.
 *
 * Une différence de fond avec les prospects : ici l'aperçu vient du SERVEUR
 * (`GET /rep-campaigns/preview`). L'éligibilité croise le rattachement, la
 * présence de prospects vivants et les campagnes en cours : trois questions que
 * seule la base tranche d'un coup, et qu'un calcul côté écran ferait diverger
 * du tirage réel dès qu'une campagne concurrente est ouverte.
 */

type Step = 'saisie' | 'apercu';

export function RepCampaignCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const nameId = useId();
  const dormantId = useId();

  const [step, setStep] = useState<Step>('saisie');
  const [name, setName] = useState('');
  const [departementId, setDepartementId] = useState<string | null>(null);
  const [iefId, setIefId] = useState<string | null>(null);
  const [onlyWithoutProspects, setOnlyWithoutProspects] = useState(false);
  const [spreadDays, setSpreadDays] = useState(MIN_SPREAD_DAYS);
  const [selected, setSelected] = useState<string[]>([]);

  const reference = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const commerciaux: readonly FilterOption[] = reference.data?.commerciaux ?? [];

  const scope: RepCampaignScope = { departementId, iefId, onlyWithoutProspects };

  const preview = useQuery({
    queryKey: queryKeys.repCampaignPreview(scope, selected.length, spreadDays),
    queryFn: () => fetchRepCampaignPreview(scope, selected.length, spreadDays),
    enabled: open && step === 'apercu' && selected.length > 0,
    staleTime: 15_000,
  });

  const trimmedName = name.trim();
  const nameValid = trimmedName.length >= 3 && trimmedName.length <= 120;
  const canPreview = nameValid && selected.length > 0;

  const create = useMutation({
    mutationFn: () => {
      // `exactOptionalPropertyTypes` : une clé posée à `undefined` n'est pas
      // une clé absente, et l'API refuserait un UUID vide.
      const body: Parameters<typeof createRepCampaign>[0] = {
        name: trimmedName,
        commercialIds: selected,
        onlyWithoutProspects,
        spreadDays,
      };
      if (departementId !== null) body.departementId = departementId;
      if (iefId !== null) body.iefId = iefId;
      return createRepCampaign(body);
    },
    onSuccess: (campaign) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.repCampaignsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
      toast.success(
        `Campagne « ${campaign.name} » créée : ${formatNumber(campaign.progress.total)} appels répartis entre ${formatNumber(campaign.commercialCount)} commerciaux.`,
      );
      reset();
      onOpenChange(false);
      router.push(`/campagnes/representants/${campaign.id}`);
    },
    onError: (error) => {
      toastApiError(error, 'La campagne n’a pas pu être créée.');
    },
  });

  function reset(): void {
    setStep('saisie');
    setName('');
    setDepartementId(null);
    setIefId(null);
    setOnlyWithoutProspects(false);
    setSpreadDays(MIN_SPREAD_DAYS);
    setSelected([]);
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
            {step === 'saisie' ? 'Nouvelle campagne représentants' : 'Aperçu du tirage'}
          </DialogTitle>
          <DialogDescription>
            {step === 'saisie'
              ? 'Le tirage est définitif.'
              : 'Les représentants tirés sont retirés des campagnes suivantes.'}
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

            <div className="grid gap-3 sm:grid-cols-2">
              <FilterCombobox
                label="Département"
                placeholder="Tous les départements"
                value={departementId}
                options={(reference.data?.departements ?? []).map((departement) => ({
                  value: departement.id,
                  label: departement.name,
                }))}
                onChange={(value) => {
                  // Une IEF n'appartient qu'à un département : la garder après
                  // un changement donnerait un tirage vide sans que rien à
                  // l'écran n'explique pourquoi.
                  setDepartementId(value);
                  setIefId(null);
                }}
              />
              <FilterCombobox
                label="IEF"
                placeholder="Toutes les IEF"
                value={iefId}
                options={(reference.data?.iefs ?? [])
                  .filter((ief) =>
                    departementId === null ? true : ief.departementId === departementId,
                  )
                  .map((ief) => ({
                    value: ief.id,
                    label: ief.name,
                    hint: ief.departementName,
                  }))}
                onChange={setIefId}
              />
            </div>

            {/* La campagne de relance des dormants : c'est le cas d'usage
                nommé dans le cahier des charges, et il mérite un interrupteur
                plutôt qu'un filtre à composer. */}
            <label
              htmlFor={dormantId}
              className={cn(
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 text-[0.875rem]',
                'transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
                onlyWithoutProspects
                  ? 'border-primary bg-secondary text-secondary-foreground'
                  : 'border-border hover:bg-secondary/60',
              )}
            >
              <input
                id={dormantId}
                type="checkbox"
                checked={onlyWithoutProspects}
                className="mt-0.5 size-4 accent-[var(--primary)]"
                onChange={(event) => {
                  setOnlyWithoutProspects(event.target.checked);
                }}
              />
              <span className="min-w-0">
                Seulement les représentants dormants
                <span className="mt-0.5 block text-[0.75rem] text-muted-foreground">
                  Ceux qui n’ont apporté aucun prospect vivant.
                </span>
              </span>
            </label>

            <SpreadDaysField value={spreadDays} onChange={setSpreadDays} />

            <fieldset className="flex flex-col gap-2">
              <legend className="pb-1.5 text-[0.8125rem] font-[600] text-foreground">
                Commerciaux
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
                  Aucun compte commercial. Créez-en un depuis l’écran Téléconseillers.
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
          <RepCampaignPreviewPanel
            selectedNames={selectedNames}
            spreadDays={spreadDays}
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
                // Bloqué tant que l'aperçu n'a pas abouti : confirmer sans avoir
                // vu le nombre annulerait tout l'intérêt de cette étape.
                disabled={
                  create.isPending ||
                  preview.isPending ||
                  preview.isError ||
                  // Après les deux gardes ci-dessus, `data` est chargée : la
                  // requête est une union discriminée par son statut.
                  preview.data.eligible === 0
                }
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

/** Le chiffre du serveur, la charge journalière, la répartition nominative. */
function RepCampaignPreviewPanel({
  selectedNames,
  spreadDays,
  isPending,
  isError,
  data,
  onRetry,
}: {
  selectedNames: readonly string[];
  spreadDays: number;
  isPending: boolean;
  isError: boolean;
  data: RepCampaignPreview | null;
  onRetry: () => void;
}) {
  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-md border border-destructive/30 bg-destructive-surface p-4"
      >
        <p className="text-[0.875rem] text-destructive">
          Le décompte des représentants éligibles n’a pas pu être calculé. Réessayez.
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
          Représentants éligibles
        </p>
        <p className="mt-1 font-display text-[2rem] font-[800] leading-none tracking-[-0.02em] text-foreground tabular-nums">
          {formatNumber(data.eligible)}
          <span className="ml-2 font-sans text-[0.9375rem] font-[400] text-muted-foreground">
            représentants
          </span>
        </p>
        <p className="mt-2 text-[0.8125rem] text-warning">{data.scopeLabel}</p>
      </div>

      {data.eligible === 0 ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-border p-3 text-[0.8125rem]"
        >
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          Aucun représentant éligible sur ce périmètre. Élargissez-le, ou vérifiez qu’une campagne
          en cours ne les a pas déjà pris.
        </p>
      ) : null}

      <SpreadPreview spreadDays={spreadDays} perDay={data.perDay} />

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
                {formatNumber(data.perCommercial)} appels
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
