'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangleIcon,
  CheckIcon,
  CheckSquareIcon,
  InfoIcon,
  LinkIcon,
  PhoneForwardedIcon,
  Trash2Icon,
  UserPlusIcon,
  XIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { QueryErrorState } from '@/components/query-error-state';
import { RepresentantFormDialog } from '@/components/representants/representant-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SUGGESTION_STATUSES,
  SUGGESTION_STATUS_LABELS,
  fetchSuggestions,
  orderSuggestions,
  setSuggestionStatus,
  suggestionCountsByPhone,
  suggestionsQueryKey,
  type Suggestion,
  type SuggestionStatus,
} from '@/lib/data/suggestions';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';

const FILTERS: readonly { value: SuggestionStatus | null; label: string }[] = [
  { value: null, label: 'Tous' },
  ...SUGGESTION_STATUSES.map((status) => ({
    value: status,
    label: SUGGESTION_STATUS_LABELS[status],
  })),
];

const STATUS_VARIANTS = {
  A_APPELER: 'warning',
  APPELE: 'success',
  ABANDONNE: 'outline',
} as const;

export function isSuspiciousSuggestion(suggestion: Suggestion): boolean {
  const digits = suggestion.suggestedPhoneE164.replace(/\D/g, '');
  if (/(.)\1{6,}/.test(digits)) return true;
  if (digits.includes('123456') || digits.includes('012345') || digits.includes('987654'))
    return true;

  const note = (suggestion.note ?? '').toLowerCase();
  const name = (suggestion.suggestedName ?? '').toLowerCase();
  const text = `${note} ${name}`;

  const keywords = [
    'faux',
    'bidon',
    "n'existe pas",
    'invalide',
    'test',
    '0000',
    'injoignable',
    'erreur',
    'mauvais',
  ];
  if (keywords.some((k) => text.includes(k))) return true;

  return estVide(suggestion.suggestedName) && estVide(suggestion.note);
}

function estVide(valeur: string | null): boolean {
  return valeur === null || valeur.trim() === '';
}

export function SuggestionsView() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SuggestionStatus | null>(null);
  const [creatingFrom, setCreatingFrom] = useState<Suggestion | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeParrainId, setActiveParrainId] = useState<string | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: suggestionsQueryKey(status),
    queryFn: () => fetchSuggestions(status),
  });

  const decide = useMutation({
    mutationFn: (variables: { id: string; status: SuggestionStatus }) =>
      setSuggestionStatus(variables.id, variables.status),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      toast.success(`Numéro marqué « ${SUGGESTION_STATUS_LABELS[updated.status]} ».`);
    },
    onError: () => {
      toast.error('Le statut n’a pas pu être enregistré.');
    },
  });

  const decideBatch = useMutation({
    mutationFn: async (variables: { ids: string[]; status: SuggestionStatus }) => {
      await Promise.all(variables.ids.map((id) => setSuggestionStatus(id, variables.status)));
      return variables;
    },
    onSuccess: (variables) => {
      void queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      setSelectedIds([]);
      toast.success(
        `${variables.ids.length} numéros passés en « ${SUGGESTION_STATUS_LABELS[variables.status]} ».`,
      );
    },
    onError: () => {
      toast.error('La mise à jour en lot a échoué.');
    },
  });

  const items = orderSuggestions(data?.items ?? []);
  const counts = suggestionCountsByPhone(items);
  const total = data?.total ?? 0;

  const suspiciousItems = items.filter(
    (item) => item.status === 'A_APPELER' && isSuspiciousSuggestion(item),
  );

  const prefill = useMemo(
    () =>
      creatingFrom === null
        ? null
        : {
            fullName: creatingFrom.suggestedName ?? '',
            phone: formatPhone(creatingFrom.suggestedPhoneE164),
            notes: creatingFrom.note ?? '',
          },
    [creatingFrom],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((item) => item.id));
    }
  };

  const handlePurgeSuspicious = () => {
    const ids = suspiciousItems.map((item) => item.id);
    if (ids.length === 0) {
      toast.info('Aucun numéro suspect à purger.');
      return;
    }
    decideBatch.mutate({ ids, status: 'ABANDONNE' });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Ce sont des contacts recommandés par un représentant, pas encore des prospects.
        </p>

        {suspiciousItems.length > 0 ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={decideBatch.isPending}
            onClick={handlePurgeSuspicious}
            className="gap-2 shadow-sm"
          >
            <Trash2Icon className="size-4" aria-hidden="true" />
            Purger les {suspiciousItems.length} numéros suspects
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
          {FILTERS.map((filter) => (
            <Button
              key={filter.label}
              type="button"
              size="sm"
              variant={filter.value === status ? 'default' : 'outline'}
              aria-pressed={filter.value === status}
              onClick={() => {
                setStatus(filter.value);
              }}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {items.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={selectAll}
              className="gap-1.5 text-[0.8125rem]"
            >
              <CheckSquareIcon className="size-3.5" aria-hidden="true" />
              {selectedIds.length === items.length ? 'Tout décocher' : 'Tout cocher'}
            </Button>
            {selectedIds.length > 0 ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={decideBatch.isPending}
                  onClick={() => decideBatch.mutate({ ids: selectedIds, status: 'APPELE' })}
                >
                  <CheckIcon className="size-3.5" aria-hidden="true" />
                  Marquer appelés ({selectedIds.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={decideBatch.isPending}
                  onClick={() => decideBatch.mutate({ ids: selectedIds, status: 'ABANDONNE' })}
                >
                  <XIcon className="size-3.5" aria-hidden="true" />
                  Abandonner ({selectedIds.length})
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {(() => {
        if (isPending) return <Skeleton className="h-64 w-full" />;
        return (() => {
          if (isError)
            return (
              <QueryErrorState
                error={error}
                onRetry={() => {
                  void refetch();
                }}
                fallback="Les numéros suggérés n’ont pas pu être chargés."
              />
            );
          return (() => {
            if (items.length === 0)
              return (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card py-16 text-center shadow-elev-sm">
                  <PhoneForwardedIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="font-[600]">
                    {status === null
                      ? 'Aucun numéro suggéré pour l’instant.'
                      : `Aucun numéro « ${SUGGESTION_STATUS_LABELS[status]} ».`}
                  </p>
                  <p className="max-w-md text-[0.8125rem] text-muted-foreground">
                    {status === null
                      ? 'Un numéro arrive ici quand un représentant en décline un autre pendant un appel consigné.'
                      : 'Retirez le filtre pour voir les autres numéros.'}
                  </p>
                </div>
              );
            return (
              <div className="flex flex-col gap-3">
                {total > items.length ? (
                  <p className="text-[0.8125rem] text-muted-foreground">
                    {formatNumber(total)} numéros au total, les {formatNumber(items.length)} plus
                    récents sont affichés.
                  </p>
                ) : null}
                <ul aria-label="Numéros suggérés" className="flex flex-col gap-3">
                  {items.map((suggestion) => (
                    <li key={suggestion.id}>
                      <SuggestionCard
                        suggestion={suggestion}
                        sameNumberCount={counts.get(suggestion.suggestedPhoneE164) ?? 1}
                        pending={decide.isPending || decideBatch.isPending}
                        isSelected={selectedIds.includes(suggestion.id)}
                        onToggleSelect={() => toggleSelect(suggestion.id)}
                        isParrainOpen={activeParrainId === suggestion.id}
                        onToggleParrain={() =>
                          setActiveParrainId(
                            activeParrainId === suggestion.id ? null : suggestion.id,
                          )
                        }
                        onDecide={(next) => {
                          decide.mutate({ id: suggestion.id, status: next });
                        }}
                        onCreate={() => {
                          setCreatingFrom(suggestion);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })();
        })();
      })()}

      <RepresentantFormDialog
        open={creatingFrom !== null}
        onOpenChange={(open) => {
          if (!open) setCreatingFrom(null);
        }}
        representant={null}
        prefill={prefill}
      />
    </div>
  );
}

function SuggestionCard({
  suggestion,
  sameNumberCount,
  pending,
  isSelected,
  onToggleSelect,
  isParrainOpen,
  onToggleParrain,
  onDecide,
  onCreate,
}: {
  suggestion: Suggestion;
  sameNumberCount: number;
  pending: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  isParrainOpen: boolean;
  onToggleParrain: () => void;
  onDecide: (status: SuggestionStatus) => void;
  onCreate: () => void;
}) {
  const known = suggestion.resolvedRepresentantId;
  const isSuspicious = isSuspiciousSuggestion(suggestion);

  return (
    <article
      className={`flex flex-col gap-3 rounded-lg border p-4 shadow-elev-sm transition-colors ${classeCarte(
        isSelected,
        isSuspicious,
      )}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            aria-label={`Sélectionner ${suggestion.suggestedPhoneE164}`}
            className="mt-1 size-4 rounded border-border accent-primary cursor-pointer"
          />
          <div className="min-w-0">
            <p className="font-display text-[1.0625rem] font-[700] tabular-nums flex items-center gap-2">
              {formatPhone(suggestion.suggestedPhoneE164)}
              {isSuspicious ? (
                <Badge
                  variant="destructive"
                  className="text-[0.7rem] px-1.5 py-0.5 gap-1 font-normal"
                >
                  <AlertTriangleIcon className="size-3" aria-hidden="true" />
                  Faux numéro suspect
                </Badge>
              ) : null}
            </p>
            <p className="truncate text-[0.8125rem] text-muted-foreground">
              {suggestion.suggestedName ?? 'Nom non donné'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {sameNumberCount > 1 ? (
            <Badge variant="info">{sameNumberCount} fois dans cette liste</Badge>
          ) : null}
          {known === null ? null : (
            <Badge variant="success" render={<Link href={`/teleconseil/representants/${known}`} />}>
              <LinkIcon aria-hidden="true" />
              Déjà une fiche
            </Badge>
          )}
          <Badge variant={STATUS_VARIANTS[suggestion.status]}>
            {SUGGESTION_STATUS_LABELS[suggestion.status]}
          </Badge>
        </div>
      </div>

      {suggestion.note === null || suggestion.note === '' ? null : (
        <p className="max-w-prose text-[0.875rem] bg-muted/40 p-2 rounded border border-border/50">
          {suggestion.note}
        </p>
      )}

      {/* Bulle d'Information / Popover Parrain UX */}
      <div className="relative text-[0.75rem] text-muted-foreground">
        <span>Donné par le représentant </span>
        <button
          type="button"
          onClick={onToggleParrain}
          className="inline-flex items-center gap-1 font-[600] text-foreground underline decoration-dashed underline-offset-4 hover:text-primary transition-colors cursor-pointer"
        >
          {suggestion.sourceRepresentantName || suggestion.sourceRepresentantShortCode}
          <InfoIcon className="size-3 text-muted-foreground" aria-hidden="true" />
        </button>
        <span> · recueilli par {suggestion.suggestedByName} · </span>
        <time dateTime={suggestion.clientCreatedAt}>
          {formatDateTime(suggestion.clientCreatedAt)}
        </time>

        {isParrainOpen ? <BulleParrain suggestion={suggestion} onFermer={onToggleParrain} /> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestion.status === 'A_APPELER' ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                onDecide('APPELE');
              }}
            >
              <CheckIcon aria-hidden="true" />
              Marquer appelé
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                onDecide('ABANDONNE');
              }}
            >
              <XIcon aria-hidden="true" />
              Abandonner
            </Button>
          </>
        ) : null}

        {known === null ? (
          <Button type="button" size="sm" variant="outline" onClick={onCreate}>
            <UserPlusIcon aria-hidden="true" />
            Créer la fiche
          </Button>
        ) : (
          <Link
            href={`/teleconseil/representants/${known}`}
            className="self-center text-[0.8125rem] underline underline-offset-4"
          >
            Ouvrir la fiche existante
          </Link>
        )}
      </div>
    </article>
  );
}

function classeCarte(isSelected: boolean, isSuspicious: boolean): string {
  if (isSelected) return 'border-primary/60 bg-accent/30';
  if (isSuspicious) return 'border-destructive/40 bg-destructive-surface/20';
  return 'border-border bg-card';
}

function BulleParrain({ suggestion, onFermer }: { suggestion: Suggestion; onFermer: () => void }) {
  return (
    <div className="absolute left-0 top-6 z-20 w-80 rounded-lg border border-border bg-card p-3 shadow-lg flex flex-col gap-2 text-[0.8125rem] text-foreground animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between border-b border-border pb-1.5 font-[600]">
        <span className="flex items-center gap-1.5">
          👤 Représentant parrain :{' '}
          {suggestion.sourceRepresentantName || suggestion.sourceRepresentantShortCode}
        </span>
        <button
          type="button"
          onClick={onFermer}
          className="text-muted-foreground hover:text-foreground text-[0.75rem]"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-1 text-[0.75rem] text-muted-foreground">
        <p>
          <strong className="text-foreground">Code court :</strong>{' '}
          {suggestion.sourceRepresentantName || suggestion.sourceRepresentantShortCode}
        </p>
        <p>
          <strong className="text-foreground">Recueilli par :</strong> {suggestion.suggestedByName}
        </p>
        <p>
          <strong className="text-foreground">Date :</strong>{' '}
          {formatDateTime(suggestion.clientCreatedAt)}
        </p>
        {suggestion.note ? (
          <p className="mt-1 text-foreground bg-muted/60 p-2 rounded text-[0.75rem]">
            💬 <em>"{suggestion.note}"</em>
          </p>
        ) : null}
      </div>
      {suggestion.sourceRepresentantId ? (
        <Link
          href={`/teleconseil/representants/${suggestion.sourceRepresentantId}`}
          className="mt-1 text-center text-[0.75rem] font-[600] text-primary hover:underline"
        >
          Consulter la fiche complète du parrain →
        </Link>
      ) : null}
    </div>
  );
}
