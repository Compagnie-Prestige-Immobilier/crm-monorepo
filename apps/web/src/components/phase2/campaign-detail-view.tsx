'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  DownloadIcon,
  LoaderIcon,
  LockIcon,
  PhoneIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { useFileDownload } from '@/components/exports/download-button';
import { CampaignProgressBar } from '@/components/phase2/campaign-progress-bar';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  closeCampaign,
  fetchCampaign,
  programmePdfFileName,
  programmePdfUrl,
} from '@/lib/data/phase2';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  CALL_OUTCOME_LABELS,
  CAMPAIGN_STATUS_LABELS,
  ENROLLMENT_METHOD_LABELS,
  campaignScopeLabel,
  type BadgeVariant,
  type CallOutcome,
  type CampaignCommercial,
} from '@/lib/types';

const OUTCOME_VARIANT: Record<CallOutcome, BadgeVariant> = {
  METHOD_OBTAINED: 'success',
  UNREACHABLE: 'secondary',
  CALLBACK: 'info',
  REFUSED: 'destructive',
  WRONG_NUMBER: 'warning',
  OTHER: 'outline',
};

export function CampaignDetailView({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState(false);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.campaign(campaignId),
    queryFn: () => fetchCampaign(campaignId),
  });

  const close = useMutation({
    mutationFn: () => closeCampaign(campaignId),
    onSuccess: (campaign) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaignsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      toast.success(
        campaign.progress.cancelled > 0
          ? `Campagne clôturée. ${formatNumber(campaign.progress.cancelled)} tâches ouvertes ont été annulées.`
          : 'Campagne clôturée.',
      );
      setClosing(false);
    },
    onError: (error) => {
      toastApiError(error, 'La clôture a échoué.');
    },
  });

  if (isPending) return <CampaignDetailSkeleton />;

  if (isError) {
    return (
      <QueryErrorState
        error={error}
        onRetry={() => {
          void refetch();
        }}
        fallback="Cette campagne n’a pas pu être chargée."
      />
    );
  }

  const isActive = data.status === 'ACTIVE';

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" className="w-fit -ml-2">
        <Link href="/campagnes">
          <ArrowLeftIcon aria-hidden="true" />
          Toutes les campagnes
        </Link>
      </Button>

      <Card className="animate-rise">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-[1.25rem]">{data.name}</CardTitle>
              <CardDescription>{campaignScopeLabel(data.scope)}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isActive ? 'info' : 'secondary'}>
                {CAMPAIGN_STATUS_LABELS[data.status]}
              </Badge>
              {isActive ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setClosing(true);
                  }}
                >
                  <LockIcon aria-hidden="true" />
                  Clôturer
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CampaignProgressBar progress={data.progress} />
          <dl className="grid gap-3 text-[0.8125rem] sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Créée le</dt>
              <dd className="font-[600]">
                <time dateTime={data.createdAt}>{formatDateTime(data.createdAt)}</time> par{' '}
                {data.createdByName}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Commerciaux</dt>
              <dd className="font-[600] tabular-nums">{formatNumber(data.commercialCount)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Clôturée le</dt>
              <dd className="font-[600]">
                {data.closedAt === null ? (
                  '—'
                ) : (
                  <time dateTime={data.closedAt}>{formatDateTime(data.closedAt)}</time>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
          <UsersIcon className="size-4" aria-hidden="true" />
          Répartition par commercial
        </h2>
        <ul className="grid gap-3 lg:grid-cols-2">
          {data.commerciaux.map((commercial) => (
            <li key={commercial.userId}>
              <CommercialCard
                campaignId={data.id}
                campaignName={data.name}
                commercial={commercial}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
          <PhoneIcon className="size-4" aria-hidden="true" />
          Tentatives récentes
        </h2>
        {data.recentAttempts.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-[0.875rem] text-muted-foreground">
                Aucun appel n’a encore été remonté depuis le terrain. Les tentatives apparaissent
                ici à la synchronisation des téléphones.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {data.recentAttempts.map((attempt) => (
                  <li
                    key={attempt.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <Badge variant={OUTCOME_VARIANT[attempt.outcome]}>
                          {CALL_OUTCOME_LABELS[attempt.outcome]}
                        </Badge>
                        {attempt.method !== null ? (
                          <span className="text-[0.8125rem] text-muted-foreground">
                            {ENROLLMENT_METHOD_LABELS[attempt.method]}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-[0.875rem] tabular-nums">
                        {/* Ni nom ni prénom : le contrat de `CampaignAttemptDto`
                            désigne le prospect par son téléphone et son code
                            court. Le suivi d'une campagne consiste à savoir qui
                            a appelé quel numéro, pas à consulter des identités. */}
                        {formatPhone(attempt.phoneE164)}
                        <span className="ml-2 text-muted-foreground">{attempt.shortCode}</span>
                      </p>
                      {attempt.comment !== null && attempt.comment !== '' ? (
                        <p className="mt-1 max-w-prose text-[0.8125rem] text-muted-foreground">
                          {attempt.comment}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right text-[0.75rem] text-muted-foreground">
                      <p className="font-[600] text-foreground">{attempt.performedByName}</p>
                      <time dateTime={attempt.createdAt} className="tabular-nums">
                        {formatDateTime(attempt.createdAt)}
                      </time>
                      {attempt.assignedToId !== null &&
                      attempt.assignedToId !== attempt.performedById ? (
                        // Cas réel et déroutant s'il n'est pas signalé : un
                        // commercial peut appeler un numéro affecté à un autre.
                        <p className="mt-0.5">Tâche d’un autre commercial</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      <Dialog
        open={closing}
        onOpenChange={(open) => {
          if (!open && close.isPending) return;
          setClosing(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clôturer « {data.name} » ?</DialogTitle>
            <DialogDescription>
              {/* On NOMME la conséquence et on la chiffre. « Voulez-vous
                  clôturer ? » laisserait croire à un simple archivage, alors que
                  la clôture annule les tâches en cours : les appels
                  disparaissent des téléphones des commerciaux, séance tenante. */}
              {data.progress.open > 0
                ? `${formatNumber(data.progress.open)} tâche${data.progress.open > 1 ? 's sont' : ' est'} encore ouverte${data.progress.open > 1 ? 's' : ''} : elle${data.progress.open > 1 ? 's seront annulées' : ' sera annulée'} et disparaîtra${data.progress.open > 1 ? 'ont' : ''} des téléphones des commerciaux. Les prospects concernés redeviendront éligibles à une prochaine campagne.`
                : 'Aucune tâche n’est encore ouverte : la clôture ne fera que figer la campagne. Les appels déjà aboutis sont conservés.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={close.isPending}
              onClick={() => {
                setClosing(false);
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              // Bloque le double-clic : deux clôtures concurrentes ne
              // détruiraient rien de plus, mais la seconde afficherait une
              // erreur au moment où la première vient de réussir.
              disabled={close.isPending}
              onClick={() => {
                close.mutate();
              }}
            >
              {close.isPending ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                  Clôture en cours…
                </>
              ) : (
                'Clôturer la campagne'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Une carte par commercial : avancement, position au tourniquet, programme PDF. */
function CommercialCard({
  campaignId,
  campaignName,
  commercial,
}: {
  campaignId: string;
  campaignName: string;
  commercial: CampaignCommercial;
}) {
  const { pending, download } = useFileDownload();

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-[600]">{commercial.fullName}</p>
            <p className="truncate text-[0.75rem] text-muted-foreground">@{commercial.username}</p>
          </div>
          <Badge variant="outline" className="shrink-0 tabular-nums">
            #{commercial.position}
          </Badge>
        </div>

        <CampaignProgressBar progress={commercial.progress} compact />

        <Button
          type="button"
          variant="outline"
          className="mt-auto w-full"
          disabled={pending || commercial.progress.total === 0}
          onClick={() => {
            void download({
              url: programmePdfUrl(campaignId, commercial.userId),
              fileName: programmePdfFileName(campaignName, commercial.fullName),
              failureMessage: 'Le programme n’a pas pu être généré.',
            });
          }}
        >
          {pending ? (
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <DownloadIcon aria-hidden="true" />
          )}
          {commercial.progress.total === 0
            ? 'Aucun appel affecté'
            : `Programme PDF (${formatNumber(commercial.progress.total)} appels)`}
        </Button>
      </CardContent>
    </Card>
  );
}

export function CampaignDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Skeleton className="h-11 w-48" />
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-6 w-72" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-2 w-full rounded-full" />
        </CardContent>
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index}>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-11 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
