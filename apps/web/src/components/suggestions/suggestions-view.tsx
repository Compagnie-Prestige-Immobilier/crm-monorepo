'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, LinkIcon, PhoneForwardedIcon, UserPlusIcon, XIcon } from 'lucide-react';
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

export function SuggestionsView({ readOnly = false }: { readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SuggestionStatus | null>(null);
  const [creatingFrom, setCreatingFrom] = useState<Suggestion | null>(null);

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

  const items = orderSuggestions(data?.items ?? []);
  const counts = suggestionCountsByPhone(items);
  const total = data?.total ?? 0;

  // Identité stable : le dialogue réinitialise ses champs à chaque changement
  // de cette valeur, et effacerait la saisie en cours si elle était recréée.
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

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
        Numéros donnés par un représentant qui décline, pour qu’un collègue soit appelé à sa place.
      </p>

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
                      ? 'Un numéro arrive ici quand un représentant en décline un autre depuis la console d’appel ou le mobile.'
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
                        readOnly={readOnly}
                        pending={decide.isPending}
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
  readOnly,
  pending,
  onDecide,
  onCreate,
}: {
  suggestion: Suggestion;
  sameNumberCount: number;
  readOnly: boolean;
  pending: boolean;
  onDecide: (status: SuggestionStatus) => void;
  onCreate: () => void;
}) {
  const known = suggestion.resolvedRepresentantId;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-elev-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[1.0625rem] font-[700] tabular-nums">
            {formatPhone(suggestion.suggestedPhoneE164)}
          </p>
          <p className="truncate text-[0.8125rem] text-muted-foreground">
            {suggestion.suggestedName ?? 'Nom non donné'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {sameNumberCount > 1 ? (
            <Badge variant="info">{sameNumberCount} fois dans cette liste</Badge>
          ) : null}
          {known === null ? null : (
            <Badge variant="success" render={<Link href={`/chues/representants/${known}`} />}>
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
        <p className="max-w-prose text-[0.875rem]">{suggestion.note}</p>
      )}

      <p className="text-[0.75rem] text-muted-foreground">
        Donné par le représentant{' '}
        <span className="font-[600] tabular-nums">{suggestion.sourceRepresentantShortCode}</span> ·
        recueilli par {suggestion.suggestedByName} ·{' '}
        <time dateTime={suggestion.clientCreatedAt}>
          {formatDateTime(suggestion.clientCreatedAt)}
        </time>
      </p>

      {readOnly ? null : (
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
              href={`/chues/representants/${known}`}
              className="self-center text-[0.8125rem] underline underline-offset-4"
            >
              Ouvrir la fiche existante
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
