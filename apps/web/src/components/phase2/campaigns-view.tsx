'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeftIcon, ChevronRightIcon, MegaphoneIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { CampaignCreateDialog } from '@/components/phase2/campaign-create-dialog';
import { CampaignProgressBar } from '@/components/phase2/campaign-progress-bar';
import { EmptyState } from '@/components/empty-state';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DEFAULT_CAMPAIGN_FILTERS, fetchCampaigns, type CampaignFilters } from '@/lib/data/phase2';
import { formatDate, formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { CAMPAIGN_STATUS_LABELS, campaignScopeLabel, type CampaignStatus } from '@/lib/types';

/**
 * Liste des campagnes d'appels.
 *
 * En cartes plutôt qu'en tableau, et ce n'est pas un choix esthétique : chaque
 * ligne porte une BARRE d'avancement à trois segments, un périmètre en toutes
 * lettres et deux dates. Comprimées en colonnes, ces trois informations
 * deviennent illisibles sous 1 200 px, alors que le suivi d'une campagne se
 * fait souvent depuis une tablette en réunion.
 */
export function CampaignsView() {
  const [filters, setFilters] = useState<CampaignFilters>(DEFAULT_CAMPAIGN_FILTERS);
  const [creating, setCreating] = useState(false);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.campaigns(filters),
    queryFn: () => fetchCampaigns(filters),
    placeholderData: (previous) => previous,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Phase 2 : chaque campagne tire les prospects encore en attente sur son périmètre et les
          répartit en tourniquet entre les commerciaux choisis. Le tirage est définitif.
        </p>
        <Button
          type="button"
          onClick={() => {
            setCreating(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          Nouvelle campagne
        </Button>
      </div>

      <Tabs
        value={filters.status ?? 'TOUTES'}
        onValueChange={(value) => {
          setFilters((current) => ({
            ...current,
            status: value === 'TOUTES' ? null : (value as CampaignStatus),
            // Changer de filtre remet la pagination à 1 : rester en page 3 d'un
            // résultat qui n'en compte plus qu'une affiche une liste vide.
            page: 1,
          }));
        }}
      >
        <TabsList aria-label="Filtrer par statut">
          <TabsTrigger value="TOUTES">Toutes</TabsTrigger>
          <TabsTrigger value="ACTIVE">En cours</TabsTrigger>
          <TabsTrigger value="CLOSED">Clôturées</TabsTrigger>
        </TabsList>
      </Tabs>

      {isPending ? (
        <CampaignsSkeleton />
      ) : isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="La liste des campagnes n’a pas pu être chargée."
        />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={MegaphoneIcon}
          title={
            filters.status === null ? 'Aucune campagne d’appels' : 'Aucune campagne dans cet état'
          }
          description={
            filters.status === null
              ? 'Créez une campagne pour distribuer les prospects en attente entre vos commerciaux. Un aperçu du nombre de fiches vous sera présenté avant confirmation.'
              : 'Changez d’onglet pour voir les autres campagnes.'
          }
          action={
            filters.status === null ? (
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
                            href={`/campagnes/${campaign.id}`}
                            className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            {campaign.name}
                          </Link>
                        </h2>
                        <p className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">
                          {campaignScopeLabel(campaign.scope)}
                        </p>
                      </div>
                      <Badge variant={campaign.status === 'ACTIVE' ? 'info' : 'secondary'}>
                        {CAMPAIGN_STATUS_LABELS[campaign.status]}
                      </Badge>
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
                  setFilters((current) => ({ ...current, page: current.page - 1 }));
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
                  setFilters((current) => ({ ...current, page: current.page + 1 }));
                }}
              >
                <ChevronRightIcon className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}

      <CampaignCreateDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

export function CampaignsSkeleton() {
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
