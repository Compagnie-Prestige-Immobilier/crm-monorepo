import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { formatDistanceStrict } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PauseIcon, PlayIcon, RefreshCwIcon, UnplugIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { CarteReformulation } from '@/components/kairo/carte-reformulation';
import { CarteTickets, IndicateursKairo } from '@/components/kairo/carte-tickets';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  basculerPauseKairo,
  CLE_KAIRO,
  ilYA,
  isoKairo,
  lireTableauKairo,
  type EtatKairo,
  type TableauKairo,
} from '@/lib/data/kairo';
import { formatDateTime } from '@/lib/format';
import { guardPermission } from '@/lib/guard';
import { toastApiError } from '@/lib/mutation-feedback';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_panneau/admin/kairo')({
  beforeLoad: guardPermission('exploitation.administrer'),
  component: KairoView,
  pendingComponent: Chargement,
});

function tonDe(etat: EtatKairo): 'pause' | 'actif' | 'bloque' {
  if (etat.pauseDepuis !== null) return 'pause';
  return etat.sain ? 'actif' : 'bloque';
}

function Chargement() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de Kairo">
      <Skeleton className="h-28 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}

function KairoView() {
  const tableau = useQuery({
    queryKey: CLE_KAIRO,
    queryFn: lireTableauKairo,
    refetchInterval: 15_000,
  });
  const [dernierKairo, setDernierKairo] = useState<EtatKairo | null>(null);
  if (tableau.data?.kairo && tableau.data.kairo !== dernierKairo) {
    setDernierKairo(tableau.data.kairo);
  }

  if (tableau.isPending) return <Chargement />;
  if (tableau.isError) {
    return <QueryErrorState error={tableau.error} onRetry={() => void tableau.refetch()} />;
  }
  const { kairo, kairoErreur, reformulation } = tableau.data;
  const etatAffiche = kairo ?? dernierKairo;
  const injoignable = kairo === null;

  return (
    <div className="flex flex-col gap-6">
      {injoignable ? (
        <KairoInjoignable
          message={kairoErreur ?? ''}
          pending={tableau.isFetching}
          onRetry={() => void tableau.refetch()}
          dernierEtatConserve={etatAffiche !== null}
        />
      ) : null}
      {etatAffiche !== null ? (
        <>
          <BandeauEtat etat={etatAffiche} desactive={injoignable} />
          <IndicateursKairo tickets={etatAffiche.tickets} mttrSecondes={etatAffiche.mttrSecondes} />
          <CarteTickets tickets={etatAffiche.tickets} desactive={injoignable} />
        </>
      ) : null}
      <CarteReformulation reformulation={reformulation} />
    </div>
  );
}

function KairoInjoignable(props: {
  message: string;
  pending: boolean;
  onRetry: () => void;
  dernierEtatConserve?: boolean;
}) {
  return (
    <Card role="alert" className="border-l-4 border-l-destructive">
      <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-destructive-surface text-destructive">
          <UnplugIcon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-[800] tracking-[-0.01em]">
            Kairo est hors de portée
          </p>
          <p className="text-sm text-muted-foreground">
            {props.message}
            {props.dernierEtatConserve
              ? ' Les tickets et métriques relevés lors de la dernière communication restent affichés ci-dessous en lecture seule.'
              : null}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={props.pending}
          onClick={props.onRetry}
          className="w-full sm:w-auto"
        >
          <RefreshCwIcon className={cn(props.pending && 'motion-safe:animate-spin')} />
          Réessayer
        </Button>
      </CardContent>
    </Card>
  );
}

function BadgesAgents({ agents }: { agents: string[] }) {
  if (agents.length === 0) {
    return (
      <Badge variant="destructive" className="font-mono text-[10px]">
        Aucun agent configuré
      </Badge>
    );
  }
  return (
    <>
      {agents.map((agent) => (
        <span
          key={agent}
          className="rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground/90"
        >
          {agent}
        </span>
      ))}
    </>
  );
}

const STYLE_TON = {
  actif: { point: 'bg-emerald-500', libelle: 'Veille active' },
  pause: { point: 'bg-amber-500', libelle: 'En pause' },
  bloque: { point: 'bg-destructive', libelle: 'Non joignable' },
} as const;

function DescriptionCadence(props: {
  enPause: boolean;
  intervalle: number;
  derniereSec: number;
  pauseDepuis: string;
}) {
  if (props.enPause) {
    return (
      <p className="text-xs text-muted-foreground">
        Suspendu depuis le{' '}
        <time dateTime={props.pauseDepuis} title={ilYA(props.pauseDepuis)}>
          {formatDateTime(props.pauseDepuis)}
        </time>
        . Traitements engagés poursuivis sans nouveau ticket.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      Cycle : toutes les {String(props.intervalle)} s · Dernière lecture il y a{' '}
      {formatDistanceStrict(0, props.derniereSec * 1000, { locale: fr })}.
    </p>
  );
}

function BandeauEtat({ etat, desactive }: { etat: EtatKairo; desactive?: boolean }) {
  const client = useQueryClient();
  const enPause = etat.pauseDepuis !== null;
  const bascule = useMutation({
    mutationFn: basculerPauseKairo,
    onSuccess: (_, pause) => {
      const pauseDepuis = pause ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
      client.setQueryData<TableauKairo>(CLE_KAIRO, (avant) =>
        avant?.kairo == null ? avant : { ...avant, kairo: { ...avant.kairo, pauseDepuis } },
      );
      toast.success(pause ? 'Kairo est en pause.' : 'Kairo a repris.');
    },
    onError: (error) => toastApiError(error, 'Kairo n’a pas pris la commande.'),
    onSettled: () => client.invalidateQueries({ queryKey: CLE_KAIRO }),
  });
  const ton = STYLE_TON[tonDe(etat)];
  const pauseDepuis = isoKairo(etat.pauseDepuis ?? '');

  return (
    <Card className="border border-border/80 bg-card/60 shadow-xs backdrop-blur-xs">
      <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Assistant DSI
            </span>
            <span className="text-muted-foreground/40">/</span>
            <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Kairo
            </h1>
            <div className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-2.5 py-0.5 text-xs text-foreground">
              <span className={cn('size-2 rounded-full', ton.point)} aria-hidden="true" />
              <span className="font-medium">{ton.libelle}</span>
            </div>
            {etat.jevActif ? (
              <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                JEV actif
              </Badge>
            ) : null}
          </div>
          <DescriptionCadence
            enPause={enPause}
            intervalle={etat.intervalleSecondes}
            derniereSec={etat.derniereLectureSecondes}
            pauseDepuis={pauseDepuis}
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-muted-foreground">Agents :</span>
            <BadgesAgents agents={etat.agents} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant={enPause ? 'default' : 'outline'}
            disabled={desactive || bascule.isPending}
            title={desactive ? 'Kairo est hors de portée' : undefined}
            onClick={() => bascule.mutate(!enPause)}
            className="h-9 gap-2 px-3 text-xs"
          >
            {enPause ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-3.5" />}
            {enPause ? 'Reprendre la veille' : 'Mettre en pause'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
