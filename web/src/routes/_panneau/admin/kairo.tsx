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

const TONS = {
  actif: { titre: 'Kairo veille sur GLPI', bordure: 'border-l-success', point: 'bg-success' },
  pause: { titre: 'Kairo est en pause', bordure: 'border-l-warning', point: 'bg-warning' },
  bloque: {
    titre: 'Kairo ne lit plus GLPI',
    bordure: 'border-l-destructive',
    point: 'bg-destructive',
  },
};

export const Route = createFileRoute('/_panneau/admin/kairo')({
  beforeLoad: guardPermission('exploitation.administrer'),
  component: KairoView,
  pendingComponent: Chargement,
});

function tonDe(etat: EtatKairo): keyof typeof TONS {
  if (etat.pauseDepuis !== null) return 'pause';
  return etat.sain ? 'actif' : 'bloque';
}

function Chargement() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de Kairo">
      <Skeleton className="h-28 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
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
          <IndicateursKairo tickets={etatAffiche.tickets} />
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
  const ton = tonDe(etat);
  const { titre, bordure, point } = TONS[ton];
  const pauseDepuis = isoKairo(etat.pauseDepuis ?? '');
  return (
    <Card className={cn('border-l-4', bordure)}>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="flex items-center gap-3 font-display text-xl font-[800] tracking-[-0.01em]">
            <span className="relative flex size-3 shrink-0" aria-hidden="true">
              {ton === 'actif' ? (
                <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
              ) : null}
              <span className={cn('relative inline-flex size-3 rounded-full', point)} />
            </span>
            {titre}
          </p>
          <p className="text-sm text-muted-foreground">
            {enPause ? (
              <>
                Depuis le{' '}
                <time dateTime={pauseDepuis} title={ilYA(pauseDepuis)}>
                  {formatDateTime(pauseDepuis)}
                </time>
                . Les tickets en cours se terminent, aucun nouveau n’est pris.
              </>
            ) : (
              `Lecture toutes les ${String(etat.intervalleSecondes)} s, la dernière il y a ${formatDistanceStrict(0, etat.derniereLectureSecondes * 1000, { locale: fr })}.`
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {etat.agents.length === 0 ? (
              <Badge variant="destructive">Aucun agent configuré</Badge>
            ) : (
              etat.agents.map((agent) => (
                <Badge key={agent} variant="outline">
                  {agent}
                </Badge>
              ))
            )}
          </div>
        </div>
        <Button
          size="lg"
          variant={enPause ? 'default' : 'outline'}
          disabled={desactive || bascule.isPending}
          title={desactive ? 'Kairo est hors de portée' : undefined}
          onClick={() => bascule.mutate(!enPause)}
          className="w-full sm:w-auto"
        >
          {enPause ? <PlayIcon /> : <PauseIcon />}
          {enPause ? 'Reprendre' : 'Mettre en pause'}
        </Button>
      </CardContent>
    </Card>
  );
}
