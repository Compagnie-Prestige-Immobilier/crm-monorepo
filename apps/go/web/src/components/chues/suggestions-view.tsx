import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CheckIcon, LinkIcon, UserPlusIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { EtatVide } from '@/components/chues/console-ui';
import { QueryErrorState } from '@/components/query-error-state';
import { FormulaireRepresentant } from '@/components/representants/formulaire';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  changerStatutSuggestion,
  comptesParNumero,
  fetchSuggestions,
  LIBELLES_STATUT_SUGGESTION,
  ordonnerSuggestions,
  STATUTS_SUGGESTION,
  VARIANTES_STATUT_SUGGESTION,
  type StatutSuggestion,
  type Suggestion,
} from '@/lib/data/suggestions';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';

const FILTRES: readonly { value: StatutSuggestion | null; label: string }[] = [
  { value: null, label: 'Tous' },
  ...STATUTS_SUGGESTION.map((statut) => ({
    value: statut,
    label: LIBELLES_STATUT_SUGGESTION[statut],
  })),
];

export function SuggestionsView({ projet }: { projet: Projet }) {
  const queryClient = useQueryClient();
  const [statut, setStatut] = useState<StatutSuggestion | null>(null);
  const [creation, setCreation] = useState<Suggestion | null>(null);

  const liste = useQuery({
    queryKey: queryKeys.suggestions(statut),
    queryFn: () => fetchSuggestions(statut),
  });

  const trancher = useMutation({
    mutationFn: (variables: { id: string; statut: StatutSuggestion }) =>
      changerStatutSuggestion(variables.id, variables.statut),
    onSuccess: (suggestion) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.suggestionsRoot });
      toast.success(`Numéro marqué « ${LIBELLES_STATUT_SUGGESTION[suggestion.status]} ».`);
    },
    onError: (error) => {
      toastApiError(error, 'Le statut n’a pas pu être enregistré.');
    },
  });

  const items = ordonnerSuggestions(liste.data?.items ?? []);
  const comptes = comptesParNumero(items);

  // Identité stable : le dialogue recale ses champs à chaque changement de
  // cette valeur, et effacerait la saisie en cours si elle était recréée.
  const amorce = useMemo(
    () =>
      creation === null
        ? null
        : {
            fullName: creation.suggestedName ?? '',
            phone: formatPhone(creation.suggestedPhoneE164),
            notes: creation.note ?? '',
          },
    [creation],
  );

  function corps() {
    if (liste.isPending) return <Skeleton className="h-64 w-full" />;
    if (liste.isError) {
      return (
        <QueryErrorState
          error={liste.error}
          fallback="Les numéros suggérés n’ont pas pu être chargés."
          onRetry={() => {
            void liste.refetch();
          }}
        />
      );
    }
    if (items.length === 0) {
      return (
        <EtatVide
          titre={
            statut === null
              ? 'Aucun numéro suggéré pour l’instant.'
              : `Aucun numéro « ${LIBELLES_STATUT_SUGGESTION[statut]} ».`
          }
          description={
            statut === null
              ? 'Un numéro arrive ici quand un représentant en décline un autre pendant un appel consigné.'
              : 'Retirez le filtre pour voir les autres numéros.'
          }
        />
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {liste.data.total > items.length ? (
          <p className="text-[0.8125rem] text-muted-foreground">
            {formatNumber(liste.data.total)} numéros au total, les {formatNumber(items.length)} plus
            récents sont affichés.
          </p>
        ) : null}
        <ul aria-label="Numéros suggérés" className="flex flex-col gap-3">
          {items.map((suggestion) => (
            <li key={suggestion.id}>
              <Carte
                suggestion={suggestion}
                projet={projet}
                repetitions={comptes.get(suggestion.suggestedPhoneE164) ?? 1}
                bloque={trancher.isPending}
                onTrancher={(suivant) => {
                  trancher.mutate({ id: suggestion.id, statut: suivant });
                }}
                onCreer={() => {
                  setCreation(suggestion);
                }}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
        Numéros donnés par un représentant qui décline, pour qu’un collègue soit appelé à sa place.
      </p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
        {FILTRES.map((filtre) => (
          <Button
            key={filtre.label}
            type="button"
            size="sm"
            variant={filtre.value === statut ? 'default' : 'outline'}
            aria-pressed={filtre.value === statut}
            onClick={() => {
              setStatut(filtre.value);
            }}
          >
            {filtre.label}
          </Button>
        ))}
      </div>

      {corps()}

      <FormulaireRepresentant
        open={creation !== null}
        onOpenChange={(ouvert) => {
          if (!ouvert) setCreation(null);
        }}
        representant={null}
        amorce={amorce}
        onEnregistre={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.suggestionsRoot });
        }}
      />
    </div>
  );
}

function Carte({
  suggestion,
  projet,
  repetitions,
  bloque,
  onTrancher,
  onCreer,
}: {
  suggestion: Suggestion;
  projet: Projet;
  repetitions: number;
  bloque: boolean;
  onTrancher: (statut: StatutSuggestion) => void;
  onCreer: () => void;
}) {
  const connu = suggestion.resolvedRepresentantId;

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
          {repetitions > 1 ? (
            <Badge variant="info">{repetitions} fois dans cette liste</Badge>
          ) : null}
          {connu === null ? null : (
            <Badge
              variant="success"
              render={
                <Link
                  to="/$projet/representants/$representantId"
                  params={{ projet, representantId: connu }}
                />
              }
            >
              <LinkIcon aria-hidden="true" />
              Déjà une fiche
            </Badge>
          )}
          <Badge variant={VARIANTES_STATUT_SUGGESTION[suggestion.status]}>
            {LIBELLES_STATUT_SUGGESTION[suggestion.status]}
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

      <div className="flex flex-wrap gap-2">
        {suggestion.status === 'A_APPELER' ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={bloque}
              onClick={() => {
                onTrancher('APPELE');
              }}
            >
              <CheckIcon aria-hidden="true" />
              Marquer appelé
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={bloque}
              onClick={() => {
                onTrancher('ABANDONNE');
              }}
            >
              <XIcon aria-hidden="true" />
              Abandonner
            </Button>
          </>
        ) : null}

        {connu === null ? (
          <Button type="button" size="sm" variant="outline" onClick={onCreer}>
            <UserPlusIcon aria-hidden="true" />
            Créer la fiche
          </Button>
        ) : (
          <Link
            to="/$projet/representants/$representantId"
            params={{ projet, representantId: connu }}
            className="self-center text-[0.8125rem] underline underline-offset-4"
          >
            Ouvrir la fiche existante
          </Link>
        )}
      </div>
    </article>
  );
}
