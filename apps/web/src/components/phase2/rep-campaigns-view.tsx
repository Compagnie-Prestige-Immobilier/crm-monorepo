'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, UsersRoundIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { EmptyState } from '@/components/empty-state';
import { CampaignsTabs } from '@/components/phase2/campaigns-tabs';
import { RepCampaignCreateDialog } from '@/components/phase2/rep-campaign-create-dialog';
import { RepCampaignsFiltersBar } from '@/components/phase2/rep-campaigns-filters-bar';
import { useRepCampaignFilters } from '@/components/phase2/use-rep-campaign-filters';
import { CampaignProgressBar } from '@/components/phase2/campaign-progress-bar';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchRepCampaigns } from '@/lib/data/rep-campaigns';
import { formatDate, formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { countActiveRepCampaignFilters } from '@/lib/rep-campaign-filters';
import { CAMPAIGN_STATUS_LABELS } from '@/lib/types';

export function RepCampaignsView({ canManage }: { canManage: boolean }) {
  const { filters, setFilters } = useRepCampaignFilters();
  const [creating, setCreating] = useState(false);
  const activeFilterCount = countActiveRepCampaignFilters(filters);
  let emptyDescription = 'Élargissez la période ou retirez un critère.';
  if (activeFilterCount === 0) {
    emptyDescription = canManage
      ? 'Créez une campagne pour répartir les représentants à rappeler.'
      : 'Aucune campagne n’est encore disponible.';
  }

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.repCampaigns(filters),
    queryFn: () => fetchRepCampaigns(filters),
    placeholderData: (previous) => previous,
  });

  return (
    <div className="flex flex-col gap-6">
      <CampaignsTabs />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Répartition des représentants à rappeler entre les téléconseillers choisis. Tirage
          définitif.
        </p>
        {canManage ? (
          <Button
            type="button"
            onClick={() => {
              setCreating(true);
            }}
          >
            <PlusIcon aria-hidden="true" />
            Nouvelle campagne
          </Button>
        ) : null}
      </div>

      <RepCampaignsFiltersBar />

      {isPending ? (
        <RepCampaignsSkeleton />
      ) : isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="La liste des campagnes représentants n’a pas pu être chargée."
        />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={UsersRoundIcon}
          title={
            activeFilterCount === 0
              ? 'Aucune campagne représentants'
              : 'Aucune campagne ne correspond à ces filtres'
          }
          description={emptyDescription}
          action={
            activeFilterCount === 0 && canManage ? (
              <Button
                type="button"
                onClick={() => {
                  setCreating(true);
                }}
              >
                <PlusIcon aria-hidden="true" />
                Nouvelle campagne
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <ul className={isFetching ? 'flex flex-col gap-3 opacity-80' : 'flex flex-col gap-3'}>
            {data.items.map((campaign) => (
              <li key={campaign.id}>
                <Card className="animate-rise transition-shadow hover:shadow-elev-hover">
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
                          {/* Le lien couvre le titre, pas la carte entière : une
                              carte cliquable dans son ensemble intercepte la
                              sélection de texte et n'annonce aucun nom
                              accessible utile. */}
                          <Link
                            href={`/campagnes/representants/${campaign.id}`}
                            className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            {campaign.name}
                          </Link>
                        </h2>
                        <p className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">
                          {campaign.scopeLabel}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {campaign.spreadDays > 1 ? (
                          <Badge variant="outline" className="tabular-nums">
                            {formatNumber(campaign.spreadDays)} journées
                          </Badge>
                        ) : null}
                        <Badge variant={campaign.status === 'ACTIVE' ? 'info' : 'secondary'}>
                          {CAMPAIGN_STATUS_LABELS[campaign.status]}
                        </Badge>
                      </div>
                    </div>

                    <CampaignProgressBar progress={campaign.progress} />

                    <p className="text-[0.75rem] text-muted-foreground">
                      {formatNumber(campaign.commercialCount)} commercia
                      {campaign.commercialCount > 1 ? 'ux' : 'l'} · créée le{' '}
                      <time dateTime={campaign.createdAt}>{formatDate(campaign.createdAt)}</time>{' '}
                      par {campaign.createdByName}
                      {campaign.closedAt !== null ? (
                        <>
                          {' '}
                          · clôturée le{' '}
                          <time dateTime={campaign.closedAt}>{formatDate(campaign.closedAt)}</time>
                        </>
                      ) : null}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[0.8125rem] text-muted-foreground" role="status">
              <span className="sr-only">Campagnes affichées&nbsp;: </span>
              {formatNumber(data.total)} campagne{data.total > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Page précédente"
                disabled={data.page <= 1}
                onClick={() => {
                  setFilters({ page: data.page - 1 });
                }}
              >
                <ChevronLeftIcon className="size-4" aria-hidden="true" />
              </Button>
              <span className="min-w-20 text-center text-[0.8125rem] tabular-nums">
                {data.page} / {data.pageCount}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Page suivante"
                disabled={data.page >= data.pageCount}
                onClick={() => {
                  setFilters({ page: data.page + 1 });
                }}
              >
                <ChevronRightIcon className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}

      {canManage ? <RepCampaignCreateDialog open={creating} onOpenChange={setCreating} /> : null}
    </div>
  );
}

export function RepCampaignsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <Card key={index}>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-72" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
