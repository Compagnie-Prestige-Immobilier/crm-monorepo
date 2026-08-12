'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2Icon,
  FlaskConicalIcon,
  InfoIcon,
  LoaderIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';

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
  canSubmitDisable,
  canSubmitEnable,
  demoBreakdown,
  demoControl,
  disableDemoMode,
  enableDemoMode,
  fetchDemoStatus,
  seededAtOrNull,
  totalDemoRows,
} from '@/lib/data/demo';
import { formatDateTime, formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

/**
 * Bascule du mode démonstration.
 *
 * C'est l'action la plus conséquente du panel, et l'écran est construit autour
 * d'une seule exigence : ELLE NE DOIT JAMAIS PARTIR PAR ACCIDENT.
 *
 * Trois dispositifs, et aucun n'est décoratif :
 *
 * 1. La désactivation passe par une confirmation qui NOMME et CHIFFRE ce qui
 *    sera supprimé, ligne par ligne.
 * 2. Cette même confirmation affirme, en clair, que les données réelles ne sont
 *    pas touchées. C'est le point le plus important de tout l'écran : l'API
 *    tient un registre des lignes qu'elle a créées et ne supprime que
 *    celles-là. Sans cette phrase, un administrateur qui craint de perdre la
 *    base de production n'osera jamais appuyer — et le jeu de démonstration
 *    restera en place, mêlé aux vraies données, ce qui est précisément le
 *    scénario qu'on cherche à éviter.
 * 3. Le bouton est verrouillé pendant l'appel, et aucun succès n'est annoncé
 *    avant la réponse du serveur.
 *
 * Quand `canToggle` est faux, on rend `reason` : un bouton grisé et muet
 * envoie ouvrir un ticket ; la phrase « la bascule est interdite en production
 * tant que DEMO_MODE_ALLOWED ne vaut pas true » dit quoi faire.
 */
export function DemoModeCard() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const confirmId = useId();

  const status = useQuery({
    queryKey: queryKeys.demoStatus,
    queryFn: () => fetchDemoStatus(),
  });

  function afterToggle(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.demoStatus });
    // Tout le panel change de contenu : on vide le cache de données plutôt que
    // d'énumérer les clés — un écran oublié afficherait des chiffres de
    // démonstration après désactivation, ce qui est exactement le défaut que le
    // bandeau global sert à empêcher.
    void queryClient.invalidateQueries();
    // Le bandeau global est rendu par le layout SERVEUR : sans `refresh()`, il
    // resterait affiché (ou absent) jusqu'à la navigation suivante.
    router.refresh();
  }

  const enable = useMutation({
    mutationFn: () => enableDemoMode(),
    onSuccess: (next) => {
      afterToggle();
      toast.success(
        `Mode démonstration activé : ${formatNumber(totalDemoRows(next.counts))} lignes créées.`,
      );
    },
    onError: (error) => {
      toastApiError(error, 'L’activation a échoué.');
    },
  });

  const disable = useMutation({
    mutationFn: () => disableDemoMode(),
    onSuccess: () => {
      afterToggle();
      setConfirming(false);
      setConfirmed(false);
      toast.success('Mode démonstration retiré. Les données réelles sont intactes.');
    },
    onError: (error) => {
      toastApiError(error, 'La désactivation a échoué.');
    },
  });

  if (status.isPending) return <DemoModeSkeleton />;

  if (status.isError) {
    return (
      <QueryErrorState
        error={status.error}
        onRetry={() => {
          void status.refetch();
        }}
        fallback="L’état du mode démonstration n’a pas pu être lu."
      />
    );
  }

  const data = status.data;
  const control = demoControl(data);
  const seededAt = seededAtOrNull(data);
  const breakdown = demoBreakdown(data.counts);
  const total = totalDemoRows(data.counts);

  return (
    <>
      <Card className="animate-rise">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <FlaskConicalIcon className="size-4" aria-hidden="true" />
                Mode démonstration
              </CardTitle>
              <CardDescription>
                Peuple la plateforme d’un jeu complet et crédible — comptes, prospects, campagnes,
                dossiers bancaires — pour une présentation ou une recette.
              </CardDescription>
            </div>
            <Badge variant={data.enabled ? 'warning' : 'secondary'}>
              {data.enabled ? 'Actif' : 'Inactif'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {/* `role="status"` : l'état change après une mutation, hors du flux de
              lecture. Sans annonce, un utilisateur de lecteur d'écran ne saurait
              pas que la bascule a abouti. */}
          <div role="status" className="flex flex-col gap-3">
            {data.enabled ? (
              <p className="text-[0.875rem]">
                Jeu de démonstration en place
                {seededAt !== null ? (
                  <>
                    , créé le{' '}
                    <time dateTime={seededAt} className="font-[600]">
                      {formatDateTime(seededAt)}
                    </time>
                  </>
                ) : null}
                . Un bandeau le signale sur tous les écrans.
              </p>
            ) : (
              <p className="text-[0.875rem] text-muted-foreground">
                Aucune donnée de démonstration n’est en place.
                {seededAt !== null ? (
                  <>
                    {' '}
                    Dernier ensemencement :{' '}
                    <time dateTime={seededAt}>{formatDateTime(seededAt)}</time>.
                  </>
                ) : null}
              </p>
            )}

            {total > 0 ? (
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {breakdown.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <dt className="text-[0.8125rem] text-muted-foreground">{row.label}</dt>
                    <dd className="font-[600] tabular-nums">{formatNumber(row.value)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {control.kind === 'blocked' ? (
            /* PAS un bouton grisé sans explication : le contrat fournit
               `reason` précisément pour être affichée ici. */
            <p
              role="status"
              className="flex items-start gap-2 rounded-md border border-accent-border/40 bg-accent-surface px-3 py-2.5 text-[0.8125rem] text-warning"
            >
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-[600]">Bascule indisponible sur cet environnement.</span>{' '}
                {control.reason}
              </span>
            </p>
          ) : control.kind === 'enable' ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={!canSubmitEnable({ status: data, pending: enable.isPending })}
                onClick={() => {
                  enable.mutate();
                }}
              >
                {enable.isPending ? (
                  <>
                    <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                    Création du jeu de démonstration…
                  </>
                ) : (
                  <>
                    <FlaskConicalIcon aria-hidden="true" />
                    Activer le mode démonstration
                  </>
                )}
              </Button>
              <p className="text-[0.75rem] text-muted-foreground">
                Opération idempotente : activer deux fois ne double pas le jeu.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="destructive"
                disabled={disable.isPending}
                onClick={() => {
                  setConfirmed(false);
                  setConfirming(true);
                }}
              >
                <TriangleAlertIcon aria-hidden="true" />
                Retirer les données de démonstration
              </Button>
              <p className="text-[0.75rem] text-muted-foreground">
                Une confirmation détaillée vous sera demandée.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          // Fermer pendant l'appel laisserait l'utilisateur sans retour sur une
          // opération qui court encore.
          if (!open && disable.isPending) return;
          setConfirming(open);
          if (!open) setConfirmed(false);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Retirer les données de démonstration ?</DialogTitle>
            <DialogDescription>
              {formatNumber(total)} ligne{total > 1 ? 's' : ''} créée
              {total > 1 ? 's' : ''} par le mode démonstration ser
              {total > 1 ? 'ont' : 'a'} supprimée{total > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-1 rounded-md border border-border p-3 text-[0.875rem]">
              {breakdown.length === 0 ? (
                <li className="text-muted-foreground">Aucune ligne enregistrée.</li>
              ) : (
                breakdown.map((row) => (
                  <li key={row.label} className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-[600] tabular-nums">{formatNumber(row.value)}</span>
                  </li>
                ))
              )}
            </ul>

            {/*
              LA phrase qui décide si le bouton sera pressé.

              Sans elle, un administrateur devant « 4 210 prospects seront
              supprimés » se demande, légitimement, si les siens en font partie.
              Il n'ose pas, le jeu de démonstration reste en place, et quelqu'un
              finit par exporter des chiffres inventés. On affirme donc
              explicitement le mécanisme : l'API enregistre chaque ligne qu'elle
              crée et ne supprime QUE celles-là.
            */}
            <p className="flex items-start gap-2 rounded-md border border-success/30 bg-success-surface px-3 py-2.5 text-[0.875rem] text-success">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-[600]">Vos données réelles ne sont pas touchées.</span> Le
                serveur a enregistré, à l’ensemencement, l’identifiant de chaque ligne qu’il a
                créée. La suppression porte exactement sur cette liste — et sur rien d’autre, quelle
                que soit la ressemblance d’une fiche réelle avec une fiche de démonstration.
              </span>
            </p>

            <label
              htmlFor={confirmId}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-[0.875rem] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring"
            >
              <input
                id={confirmId}
                type="checkbox"
                checked={confirmed}
                disabled={disable.isPending}
                className="mt-0.5 size-4 shrink-0 accent-[var(--destructive)]"
                onChange={(event) => {
                  setConfirmed(event.target.checked);
                }}
              />
              <span>
                Je confirme vouloir supprimer les {formatNumber(total)} lignes de démonstration
                listées ci-dessus.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={disable.isPending}
              onClick={() => {
                setConfirming(false);
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              // Trois conditions ET l'absence d'appel en cours — la logique
              // vit dans `canSubmitDisable`, testée à part.
              disabled={!canSubmitDisable({ status: data, confirmed, pending: disable.isPending })}
              onClick={() => {
                disable.mutate();
              }}
            >
              {disable.isPending ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                  Suppression en cours…
                </>
              ) : (
                <>
                  <CheckCircle2Icon aria-hidden="true" />
                  Supprimer définitivement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DemoModeSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-3 w-full max-w-lg" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
        <Skeleton className="h-11 w-64" />
      </CardContent>
    </Card>
  );
}
