import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { RefreshCwIcon, UnplugIcon } from 'lucide-react';
import { useState } from 'react';

import { BandeauEtat } from '@/components/kairo/bandeau-etat';
import { CarteReformulation } from '@/components/kairo/carte-reformulation';
import { CarteTickets, IndicateursKairo } from '@/components/kairo/carte-tickets';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CLE_KAIRO, lireTableauKairo, type EtatKairo, type TableauKairo } from '@/lib/data/kairo';
import { estModeDev, ETAT_KAIRO_SIMULE, REFORMULATION_SIMULEE } from '@/lib/data/kairo-simulation';
import { guardPermission } from '@/lib/guard';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_panneau/admin/kairo')({
  beforeLoad: guardPermission('exploitation.administrer'),
  component: KairoView,
  pendingComponent: Chargement,
});

function Chargement() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de Kairo">
      <Skeleton className="h-28 w-full rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-3xl" />
    </div>
  );
}

function determinerDonneesAffichees(data: TableauKairo, dernier: EtatKairo | null) {
  const { kairo, kairoErreur, reformulation } = data;
  const injoignable = kairo === null;
  const simulationActive = injoignable && estModeDev();
  const etatAffiche = kairo ?? (simulationActive ? ETAT_KAIRO_SIMULE : dernier);
  const reformulationAffichee =
    simulationActive && (!reformulation.active || reformulation.parModele.length === 0)
      ? REFORMULATION_SIMULEE
      : reformulation;

  return {
    kairoErreur: kairoErreur ?? '',
    simulationActive,
    afficherInjoignable: !simulationActive && injoignable,
    desactive: injoignable && !simulationActive,
    etatAffiche,
    reformulationAffichee,
  };
}

function ContenuKairo({
  etat,
  desactive,
  simulation,
}: {
  etat: EtatKairo | null;
  desactive: boolean;
  simulation?: boolean;
}) {
  if (etat === null) return null;
  return (
    <>
      <BandeauEtat etat={etat} desactive={desactive} simulation={simulation} />
      <IndicateursKairo tickets={etat.tickets} mttrSecondes={etat.mttrSecondes} />
      <CarteTickets tickets={etat.tickets} desactive={desactive} />
    </>
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

  const {
    kairoErreur,
    simulationActive,
    afficherInjoignable,
    desactive,
    etatAffiche,
    reformulationAffichee,
  } = determinerDonneesAffichees(tableau.data, dernierKairo);

  return (
    <div className="flex flex-col gap-6">
      {afficherInjoignable ? (
        <KairoInjoignable
          message={kairoErreur}
          pending={tableau.isFetching}
          onRetry={() => void tableau.refetch()}
          dernierEtatConserve={etatAffiche !== null}
        />
      ) : null}
      <ContenuKairo etat={etatAffiche} desactive={desactive} simulation={simulationActive} />
      <CarteReformulation reformulation={reformulationAffichee} />
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
    <Card role="alert" className="rounded-3xl border-l-4 border-l-destructive">
      <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-destructive-surface text-destructive">
          <UnplugIcon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold tracking-tight">Kairo est hors de portée</p>
          <p className="text-sm text-muted-foreground">
            {props.message}
            {props.dernierEtatConserve
              ? ' Les tickets et métriques de la dernière communication restent affichés ci-dessous en lecture seule.'
              : null}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={props.pending}
          onClick={props.onRetry}
          className="rounded-full px-4 text-xs font-bold sm:w-auto"
        >
          <RefreshCwIcon className={cn(props.pending && 'motion-safe:animate-spin')} />
          Réessayer
        </Button>
      </CardContent>
    </Card>
  );
}
