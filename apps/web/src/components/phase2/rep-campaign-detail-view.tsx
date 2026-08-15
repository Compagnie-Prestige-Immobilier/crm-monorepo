'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadIcon, LoaderIcon, LockIcon, PhoneIcon, UsersIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { DetailBackLink } from '@/components/detail-back-link';
import { useFileDownload } from '@/components/exports/download-button';
import { CampaignDetailSkeleton } from '@/components/phase2/campaign-detail-view';
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
import {
  closeRepCampaign,
  fetchRepCampaign,
  repProgrammePdfFileName,
  repProgrammePdfUrl,
  type RepCampaignCommercial,
} from '@/lib/data/rep-campaigns';
import { formatDateTime, formatNumber, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  CAMPAIGN_STATUS_LABELS,
  REP_CALL_OUTCOME_LABELS,
  REP_CALL_OUTCOME_VARIANTS,
} from '@/lib/types';

/**
 * Détail d'une campagne représentants.
 *
 * Structure calquée sur le détail des campagnes prospects, à dessein : le même
 * administrateur suit les deux le même matin, et deux mises en page pour la
 * même information l'obligeraient à réapprendre l'écran à chaque bascule. Le
 * squelette de chargement est d'ailleurs LE MÊME composant, pas une copie.
 */
export function RepCampaignDetailView({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState(false);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.repCampaign(campaignId),
    queryFn: () => fetchRepCampaign(campaignId),
  });

  const close = useMutation({
    mutationFn: () => closeRepCampaign(campaignId),
    onSuccess: (campaign) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.repCampaignsRoot });
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

  /**
   * Le retour à la liste est rendu AVANT l'état d'erreur, pas après.
   *
   * Un identifiant périmé (un signet, un lien collé dans un message, une
   * campagne purgée) produit un 404, que `QueryErrorState` ne propose pas de
   * rejouer : recliquer ne fera pas réapparaître la campagne. Sans ce lien,
   * l'écran n'avait plus aucune issue, et le bouton « Précédent » du
   * navigateur n'est pas une réponse de conception.
   */
  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        <DetailBackLink href="/campagnes/representants">
          Toutes les campagnes représentants
        </DetailBackLink>
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="Cette campagne n’a pas pu être chargée."
        />
      </div>
    );
  }

  const isActive = data.status === 'ACTIVE';

  return (
    <div className="flex flex-col gap-6">
      <DetailBackLink href="/campagnes/representants">
        Toutes les campagnes représentants
      </DetailBackLink>

      <Card className="animate-rise">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-[1.25rem]">{data.name}</CardTitle>
              <CardDescription>{data.scopeLabel}</CardDescription>
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
              <dt className="text-muted-foreground">Téléconseillers</dt>
              <dd className="font-[600] tabular-nums">{formatNumber(data.commercialCount)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Clôturée le</dt>
              <dd className="font-[600]">
                {data.closedAt === null ? (
                  '–'
                ) : (
                  <time dateTime={data.closedAt}>{formatDateTime(data.closedAt)}</time>
                )}
              </dd>
            </div>
            {data.spreadDays > 1 ? (
              <div>
                <dt className="text-muted-foreground">Étalement</dt>
                <dd className="font-[600] tabular-nums">
                  {formatNumber(data.spreadDays)} journées
                </dd>
              </div>
            ) : null}
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
              <RepCommercialCard
                campaignId={data.id}
                campaignName={data.name}
                spreadDays={data.spreadDays}
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
              <p className="text-[0.875rem] text-muted-foreground">Aucune tentative enregistrée.</p>
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
                      {/* Le LIBELLÉ, pas l'énumération : l'écran affichait
                          littéralement « PROSPECTS_PROMISED ». Son jumeau, le
                          détail des campagnes prospects, traduit depuis
                          toujours ; les deux se lisent côte à côte. */}
                      <Badge variant={REP_CALL_OUTCOME_VARIANTS[attempt.outcome]}>
                        {REP_CALL_OUTCOME_LABELS[attempt.outcome]}
                      </Badge>
                      <p className="mt-1 text-[0.875rem] tabular-nums">
                        {/* Ni nom ni prénom : comme sur les campagnes
                            prospects, le suivi consiste à savoir qui a appelé
                            quel numéro, pas à consulter des identités. */}
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
              {/* On NOMME la conséquence et on la chiffre : la clôture annule
                  les tâches en cours, qui disparaissent des téléphones des
                  commerciaux séance tenante. */}
              {data.progress.open > 0
                ? `${formatNumber(data.progress.open)} tâche${data.progress.open > 1 ? 's' : ''} ouverte${data.progress.open > 1 ? 's' : ''} ${data.progress.open > 1 ? 'seront annulées et retirées' : 'sera annulée et retirée'} des téléphones. Les représentants concernés redeviennent éligibles à une prochaine campagne.`
                : 'Aucune tâche ouverte. Les appels aboutis sont conservés.'}
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

/** Une carte par commercial : avancement, position, et UN programme PAR JOUR. */
function RepCommercialCard({
  campaignId,
  campaignName,
  spreadDays,
  commercial,
}: {
  campaignId: string;
  campaignName: string;
  spreadDays: number;
  commercial: RepCampaignCommercial;
}) {
  const { pending, download } = useFileDownload();

  const days = spreadDays > 1 ? commercial.perDay : [];

  const downloadDay = (day?: number): void => {
    void download({
      url: repProgrammePdfUrl(campaignId, commercial.userId, day),
      fileName: repProgrammePdfFileName(campaignName, commercial.fullName, day),
      failureMessage:
        day === undefined
          ? 'Le programme n’a pas pu être généré.'
          : `Le programme du jour ${String(day)} n’a pas pu être généré.`,
    });
  };

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

        {days.length > 1 ? (
          <div className="mt-auto flex flex-col gap-2">
            <p className="text-[0.75rem] text-muted-foreground">
              {formatNumber(days.length)} programmes, un par journée
            </p>
            <ul className="grid grid-cols-2 gap-1.5">
              {days.map((count, index) => {
                const day = index + 1;
                return (
                  <li key={day}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-between"
                      disabled={pending || count === 0}
                      onClick={() => {
                        downloadDay(day);
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        <DownloadIcon className="size-3.5" aria-hidden="true" />
                        Jour {day}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatNumber(count)}
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="mt-auto w-full"
            disabled={pending || commercial.progress.total === 0}
            onClick={() => {
              downloadDay();
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
        )}
      </CardContent>
    </Card>
  );
}
