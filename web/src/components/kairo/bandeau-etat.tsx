import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceStrict } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BotIcon, PauseIcon, PlayIcon, ShieldCheckIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  basculerPauseKairo,
  CLE_KAIRO,
  ilYA,
  isoKairo,
  type EtatKairo,
  type TableauKairo,
} from '@/lib/data/kairo';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { cn } from '@/lib/utils';

function BadgesAgents({ agents }: { agents: string[] }) {
  if (agents.length === 0) {
    return <span className="text-xs text-muted-foreground">Aucun agent configuré</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {agents.map((agent) => (
        <span
          key={agent}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-secondary/60 px-2.5 py-1 font-mono text-xs font-medium text-foreground"
        >
          <BotIcon className="size-3 text-muted-foreground" aria-hidden="true" />
          {agent}
        </span>
      ))}
    </div>
  );
}

function PastilleStatut(props: { enPause: boolean; sain: boolean }) {
  const { enPause, sain } = props;
  if (enPause) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-surface px-3 py-1 text-xs font-semibold text-warning">
        <span className="size-2 rounded-full bg-warning" />
        En pause
      </span>
    );
  }
  if (sain) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-surface px-3 py-1 text-xs font-semibold text-success">
        <span className="size-2 rounded-full bg-success animate-pulse" />
        Veille active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive-surface px-3 py-1 text-xs font-semibold text-destructive">
      <span className="size-2 rounded-full bg-destructive" />
      Non joignable
    </span>
  );
}

function StatutVeille({ etat, simulation }: { etat: EtatKairo; simulation?: boolean | undefined }) {
  const enPause = etat.pauseDepuis !== null;
  const sain = etat.sain;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PastilleStatut enPause={enPause} sain={sain} />
      {simulation ? (
        <Badge variant="outline" className="font-mono text-[11px] text-muted-foreground">
          Simulation locale
        </Badge>
      ) : null}
    </div>
  );
}

function DescriptionCadence(props: {
  enPause: boolean;
  intervalle: number;
  derniereSec: number;
  pauseDepuis: string;
}) {
  const { enPause, intervalle, derniereSec, pauseDepuis } = props;
  if (enPause) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Suspendu depuis le{' '}
        <time
          dateTime={pauseDepuis}
          title={ilYA(pauseDepuis)}
          className="font-medium text-foreground"
        >
          {formatDateTime(pauseDepuis)}
        </time>
        . Les traitements engagés continuent sans prise en charge de nouveau ticket.
      </p>
    );
  }
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Cycle de vérification automatique toutes les {String(intervalle)} s. Dernière interrogation il
      y a {formatDistanceStrict(0, derniereSec * 1000, { locale: fr })}.
    </p>
  );
}

export function BandeauEtat(props: {
  etat: EtatKairo;
  desactive?: boolean | undefined;
  simulation?: boolean | undefined;
}) {
  const { etat, desactive, simulation } = props;
  const client = useQueryClient();
  const enPause = etat.pauseDepuis !== null;
  const pauseDepuis = isoKairo(etat.pauseDepuis ?? '');

  const bascule = useMutation({
    mutationFn: basculerPauseKairo,
    onSuccess: (_, pause) => {
      const nouveauPause = pause ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
      client.setQueryData<TableauKairo>(CLE_KAIRO, (avant) =>
        avant?.kairo == null
          ? avant
          : { ...avant, kairo: { ...avant.kairo, pauseDepuis: nouveauPause } },
      );
      toast.success(pause ? 'Kairo est en pause.' : 'Veille Kairo réactivée.');
    },
    onError: (error) => toastApiError(error, 'Kairo n’a pas pris la commande.'),
    onSettled: () => client.invalidateQueries({ queryKey: CLE_KAIRO }),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Kairo
            </h1>
            <StatutVeille etat={etat} simulation={simulation} />
          </div>
          <p className="text-sm text-muted-foreground">
            Supervision autonome et résolution continue des tickets d’assistance.
          </p>
        </div>

        <Button
          variant={enPause ? 'default' : 'outline'}
          size="sm"
          disabled={desactive || bascule.isPending}
          onClick={() => bascule.mutate(!enPause)}
          className={cn(
            'self-start sm:self-auto rounded-lg px-4 text-xs font-semibold',
            enPause && 'bg-primary text-primary-foreground hover:bg-primary-hover',
          )}
        >
          {enPause ? (
            <>
              <PlayIcon className="size-3.5" />
              Reprendre la veille
            </>
          ) : (
            <>
              <PauseIcon className="size-3.5" />
              Mettre en pause
            </>
          )}
        </Button>
      </div>

      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
        <CardContent className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cadence opérationnelle
              </span>
              {etat.jevActif ? (
                <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
                  <ShieldCheckIcon className="size-3 text-primary" aria-hidden="true" />
                  Triage JEV actif
                </Badge>
              ) : null}
            </div>
            <DescriptionCadence
              enPause={enPause}
              intervalle={etat.intervalleSecondes}
              derniereSec={etat.derniereLectureSecondes}
              pauseDepuis={pauseDepuis}
            />
          </div>

          <div className="flex flex-col gap-2 sm:border-l sm:border-border/60 sm:pl-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Agents autonomes engagés
            </span>
            <BadgesAgents agents={etat.agents} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
