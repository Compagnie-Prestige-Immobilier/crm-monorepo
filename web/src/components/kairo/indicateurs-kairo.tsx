import {
  CheckCheckIcon,
  GitPullRequestIcon,
  LoaderIcon,
  TimerIcon,
  TriangleAlertIcon,
} from 'lucide-react';

import { Kpi } from '@/components/bank/bank-kpi';
import { formatDuree, ticketsFiltres, type TicketKairo } from '@/lib/data/kairo';

function calculerMTTR(tickets: TicketKairo[], mttrSecondes?: number): number {
  if (mttrSecondes && mttrSecondes > 0) return mttrSecondes;
  const avecDuree = tickets.filter(
    (t) => t.statut === 'pr' && t.dureeSecondes && t.dureeSecondes > 0,
  );
  if (avecDuree.length === 0) return 0;
  const somme = avecDuree.reduce((acc, t) => acc + (t.dureeSecondes ?? 0), 0);
  return Math.round(somme / avecDuree.length);
}

export function IndicateursKairo(props: {
  tickets: TicketKairo[];
  mttrSecondes?: number | undefined;
}) {
  const { tickets, mttrSecondes } = props;
  const pr = ticketsFiltres(tickets, 'pr').length;
  const aReprendre = ticketsFiltres(tickets, 'aReprendre').length;
  const termines = pr + aReprendre;
  const reussite = termines === 0 ? '–' : `${String(Math.round((pr / termines) * 100))} %`;

  const mttr = calculerMTTR(tickets, mttrSecondes);
  const mttrTxt = mttr > 0 ? formatDuree(mttr) : '–';

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
      <Kpi
        index={0}
        label="En cours"
        value={String(ticketsFiltres(tickets, 'enCours').length)}
        hint={`sur les ${String(tickets.length)} derniers tickets`}
        icon={LoaderIcon}
      />
      <Kpi
        index={1}
        label="PR"
        value={String(pr)}
        hint="à relire par l’équipe"
        icon={GitPullRequestIcon}
      />
      <Kpi
        index={2}
        label="Bloqués"
        value={String(aReprendre)}
        hint="échecs et escalades"
        icon={TriangleAlertIcon}
      />
      <Kpi
        index={3}
        label="Réussite"
        value={reussite}
        hint={`${String(pr)} PR sur ${String(termines)} tickets terminés`}
        icon={CheckCheckIcon}
      />
      <Kpi index={4} label="MTTR" value={mttrTxt} hint="délai moyen avant PR" icon={TimerIcon} />
    </div>
  );
}
