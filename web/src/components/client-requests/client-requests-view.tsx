'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  InboxIcon,
  LandmarkIcon,
  RotateCcwIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { meQueryOptions } from '@/api/auth';
import { ClientRequestReviewDialogs } from '@/components/client-requests/client-request-review-dialogs';
import { useClientRequestFilters } from '@/components/client-requests/use-client-request-filters';
import { EmptyState } from '@/components/empty-state';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ALL_STATUSES,
  CLIENT_REQUEST_STATUS_LABELS,
  countActiveClientRequestFilters,
  type ClientRequestStatus,
} from '@/lib/client-request-filters';
import {
  fetchClientRequests,
  originLabelFor,
  type ClientRequest,
} from '@/lib/data/client-requests';
import { fetchReferenceData } from '@/lib/data/reference';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { type BadgeVariant, peut } from '@/lib/types';
import { useDebouncedSearch } from '@/lib/use-debounced-search';

const STATUS_VARIANT: Record<ClientRequestStatus, BadgeVariant> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
};

const STATUS_TABS: readonly { value: string; label: string }[] = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'APPROVED', label: 'Approuvées' },
  { value: 'REJECTED', label: 'Refusées' },
  { value: ALL_STATUSES, label: 'Toutes' },
];

function videDescription(activeFilterCount: number, canReview: boolean): string {
  if (activeFilterCount > 0) return 'Changez de statut ou retirez un critère.';
  if (canReview) {
    return 'Une demande arrivée ici attend votre approbation, ou un refus dont le motif est remonté à la banque.';
  }
  return 'Depuis « À ouvrir (plateforme) », si le client est absent de la base, demandez sa création.';
}

export function ClientRequestsView() {
  const { data: user } = useQuery(meQueryOptions);
  const canReview = peut(user, 'banque.administrer');
  const { filters, setFilters, resetFilters } = useClientRequestFilters();
  const [reviewing, setReviewing] = useState<{
    request: ClientRequest;
    action: 'approve' | 'reject';
  } | null>(null);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.clientRequests(filters),
    queryFn: () => fetchClientRequests(filters),
    placeholderData: (previous) => previous,
  });

  const { data: reference } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
    enabled: canReview,
  });

  const { draft: searchDraft, setDraft: setSearchDraft } = useDebouncedSearch(
    filters.search,
    (search) => {
      setFilters({ search });
    },
  );

  const activeFilterCount = countActiveClientRequestFilters(filters);
  const currentTab = filters.status ?? ALL_STATUSES;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          {canReview
            ? 'Clients absents de la base, demandés par une banque au moment d’ouvrir un dossier. L’approbation crée le prospect en méthode obtenue, avec sa provenance : le dossier peut lui être rattaché aussitôt.'
            : 'Vos demandes de création de client, déposées depuis le formulaire d’ouverture de dossier. Une fois approuvée, la demande crée le prospect et le dossier peut lui être rattaché.'}
        </p>
        {canReview && data !== undefined && data.pendingCount > 0 ? (
          <Badge variant="warning" className="tabular-nums">
            {formatNumber(data.pendingCount)} en attente
          </Badge>
        ) : null}
      </div>

      <section
        aria-label="Filtres des demandes"
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <SearchField
            value={searchDraft}
            onChange={setSearchDraft}
            placeholder="Nom, prénom ou téléphone…"
          />

          {/* Sans objet pour un agent bancaire : l'API ne lui renvoie que ses
              propres demandes, donc une seule banque. */}
          {canReview ? (
            <div className="min-w-[13rem] flex-1">
              <FilterCombobox
                label="Banque demandeuse"
                placeholder="Toutes les banques"
                value={filters.banqueId}
                options={(reference?.banques ?? []).map((banque) => ({
                  value: banque.id,
                  label: banque.name ?? '',
                  hint: banque.shortName ?? undefined,
                }))}
                onChange={(value) => {
                  setFilters({ banqueId: value });
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* `role="group"` et non `tablist` : rien n'est masqué, ces boutons
              écrivent un filtre dans l'URL, et `aria-pressed` décrit
              exactement cet état. */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
            {STATUS_TABS.map((tab) => {
              const isActive = currentTab === tab.value;
              return (
                <Button
                  key={tab.value}
                  type="button"
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={isActive}
                  className="tap-target"
                  onClick={() => {
                    setFilters({
                      status:
                        tab.value === ALL_STATUSES ? null : (tab.value as ClientRequestStatus),
                    });
                  }}
                >
                  {tab.label}
                </Button>
              );
            })}
          </div>

          {activeFilterCount > 0 ? (
            <Button variant="ghost" onClick={resetFilters}>
              <RotateCcwIcon aria-hidden="true" />
              Tout effacer
            </Button>
          ) : null}
        </div>
      </section>

      {(() => {
        if (isPending) return <RequestsSkeleton />;
        return (() => {
          if (isError)
            return (
              <QueryErrorState
                error={error}
                onRetry={() => {
                  void refetch();
                }}
                fallback="Les demandes n’ont pas pu être chargées."
              />
            );
          return (() => {
            if (data.items.length === 0)
              return (
                <EmptyState
                  icon={InboxIcon}
                  title={
                    activeFilterCount === 0
                      ? 'Aucune demande en attente'
                      : 'Aucune demande ne correspond à ces filtres'
                  }
                  description={videDescription(activeFilterCount, canReview)}
                />
              );
            return (
              <>
                <ul
                  className={isFetching ? 'flex flex-col gap-3 opacity-80' : 'flex flex-col gap-3'}
                >
                  {data.items.map((request) => (
                    <li key={request.id}>
                      <RequestCard
                        request={request}
                        canReview={canReview}
                        onReview={(action) => {
                          setReviewing({ request, action });
                        }}
                      />
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[0.8125rem] text-muted-foreground" role="status">
                    <span className="sr-only">Demandes affichées&nbsp;: </span>
                    {formatNumber(data.meta.total)} demande{data.meta.total > 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Page précédente"
                      disabled={data.meta.page <= 1}
                      onClick={() => {
                        setFilters({ page: data.meta.page - 1 });
                      }}
                    >
                      <ChevronLeftIcon className="size-4" aria-hidden="true" />
                    </Button>
                    <span className="min-w-20 text-center text-[0.8125rem] tabular-nums">
                      {data.meta.page} / {Math.max(1, data.meta.pageCount)}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Page suivante"
                      disabled={data.meta.page >= data.meta.pageCount}
                      onClick={() => {
                        setFilters({ page: data.meta.page + 1 });
                      }}
                    >
                      <ChevronRightIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </>
            );
          })();
        })();
      })()}

      <ClientRequestReviewDialogs
        pending={reviewing}
        onClose={() => {
          setReviewing(null);
        }}
      />
    </div>
  );
}

function RequestNote({ note }: { note: string | null }) {
  if (note === null || note === '') return null;
  return <p className="max-w-prose rounded-md bg-muted px-3 py-2 text-[0.8125rem]">{note}</p>;
}

function RequestRejectionNote({ request }: { request: ClientRequest }) {
  if (request.status !== 'REJECTED' || request.rejectionNote === null) return null;
  return (
    <p className="max-w-prose text-[0.8125rem] text-destructive">
      Refusée : {request.rejectionNote}
    </p>
  );
}

function RequestReviewedLine({ request }: { request: ClientRequest }) {
  if (request.status === 'PENDING') return null;
  return (
    <p className="text-[0.75rem] text-muted-foreground">
      Arbitrée par {request.reviewedByName ?? 'un administrateur'}
      {request.reviewedAt === null ? (
        ''
      ) : (
        <>
          {' le '}
          <time dateTime={request.reviewedAt}>{formatDateTime(request.reviewedAt)}</time>
        </>
      )}
    </p>
  );
}

function RequestReviewActions({
  isPending,
  canReview,
  onReview,
}: {
  isPending: boolean;
  canReview: boolean;
  onReview: (action: 'approve' | 'reject') => void;
}) {
  if (!isPending) return null;

  // L'agent bancaire n'arbitre pas : on le dit plutôt que de laisser
  // une carte muette qui se lit comme un écran à moitié chargé.
  if (!canReview) {
    return (
      <p className="text-[0.8125rem] text-muted-foreground">
        En attente d’arbitrage par l’administration.
      </p>
    );
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          onReview('approve');
        }}
      >
        Approuver et créer le prospect
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          onReview('reject');
        }}
      >
        Refuser
      </Button>
    </>
  );
}

/*
  `/teleconseil/prospects` est réservé à l'ADMIN : proposer ce lien à un agent
  bancaire l'enverrait droit sur un refus de droits. Il retrouve son
  client par la recherche du formulaire d'ouverture de dossier.

  Pourquoi le lien passe par la RECHERCHE et non par l'identifiant.

  `request.createdProspectId` est connu, et l'ignorer paraît être un
  raccourci paresseux. Ce n'en est pas un : le panel n'a pas d'écran de
  détail de prospect. Il n'existe ni route dédiée, ni critère
  par identifiant dans `ProspectFilters` : la fiche s'ouvre dans un
  dialogue, depuis la ligne du tableau. Un lien par identifiant n'aurait
  donc aucune destination.

  La recherche par téléphone, elle, aboutit bien : l'API normalise le
  terme avant de comparer (`tryNormalizePhone` dans
  `common/prospect-where.ts`), si bien qu'une forme E.164 retrouve la
  fiche stockée à l'identique. Le `+` survit à l'aller-retour d'URL
  grâce à `encodeURIComponent` : sans lui, `URLSearchParams` le lirait
  comme une espace et la recherche partirait sur un numéro amputé.
  C'est ce dernier point qu'éprouve `lib/filters.test.ts`.
*/
function RequestProspectLink({
  request,
  canReview,
}: {
  request: ClientRequest;
  canReview: boolean;
}) {
  if (request.createdProspectId === null) return null;

  // Un LIEN habillé en bouton : la primitive `Button` de Base UI
  // poserait `role="button"` sur le `<a>`.
  if (canReview) {
    return (
      <Link
        href={`/teleconseil/prospects?search=${encodeURIComponent(request.phoneE164)}`}
        className={buttonVariants({ variant: 'outline' })}
      >
        Voir le prospect créé
      </Link>
    );
  }

  return (
    <Link href="/finance/dossiers/nouveau" className={buttonVariants({ variant: 'outline' })}>
      Ouvrir un dossier pour ce client
    </Link>
  );
}

function RequestCard({
  request,
  canReview,
  onReview,
}: {
  request: ClientRequest;
  canReview: boolean;
  onReview: (action: 'approve' | 'reject') => void;
}) {
  const isPending = request.status === 'PENDING';

  return (
    <Card className="animate-rise">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
              {request.prenom} {request.nom}
            </h2>
            <p className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground tabular-nums">
              {formatPhone(request.phoneE164)}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[request.status]}>
            {CLIENT_REQUEST_STATUS_LABELS[request.status]}
          </Badge>
        </div>

        {/* La PROVENANCE, en clair. C'est elle qui explique qu'un prospect créé
            ici n'ait pas de représentant de terrain, et c'est elle qu'on
            retrouve ensuite dans la statistique de provenance. */}
        <p className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
          <LandmarkIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="font-[600]">{originLabelFor('BANQUE', request.banqueName)}</span>
          <span className="text-muted-foreground">
            déposée par {request.requestedByName} le{' '}
            <time dateTime={request.createdAt}>{formatDateTime(request.createdAt)}</time>
          </span>
        </p>

        <RequestNote note={request.note} />
        <RequestRejectionNote request={request} />
        <RequestReviewedLine request={request} />

        <div className="flex flex-wrap items-center gap-2">
          <RequestReviewActions isPending={isPending} canReview={canReview} onReview={onReview} />
          <RequestProspectLink request={request} canReview={canReview} />
        </div>
      </CardContent>
    </Card>
  );
}

function RequestsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <Card key={index}>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-72" />
            <Skeleton className="h-10 w-64" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
