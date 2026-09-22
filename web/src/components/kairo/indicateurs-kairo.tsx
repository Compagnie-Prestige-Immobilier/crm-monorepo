import { Card } from '@/components/ui/card';
import { formatDuree, ticketsFiltres, type TicketKairo } from '@/lib/data/kairo';
import { cn } from '@/lib/utils';

function calculerMTTR(tickets: TicketKairo[], mttrSecondes?: number): number {
  if (mttrSecondes && mttrSecondes > 0) return mttrSecondes;
  const avecDuree = tickets.filter(
    (t) => t.statut === 'pr' && t.dureeSecondes && t.dureeSecondes > 0,
  );
  if (avecDuree.length === 0) return 0;
  const somme = avecDuree.reduce((acc, t) => acc + (t.dureeSecondes ?? 0), 0);
  return Math.round(somme / avecDuree.length);
}

interface StatKairo {
  titre: string;
  valeur: string;
  detail: string;
  accent: string;
}

function libelleEnCours(n: number): string {
  if (n === 0) return 'Aucun traitement';
  return `${String(n)} actif${n > 1 ? 's' : ''}`;
}

function libelleBlocages(n: number): string {
  if (n === 0) return 'Aucun arbitrage';
  return `${String(n)} escalade${n > 1 ? 's' : ''}`;
}

function libelleTaux(pr: number, termines: number): string {
  if (termines === 0) return '–';
  return `${String(Math.round((pr / termines) * 100))} %`;
}

function genererStats(tickets: TicketKairo[], mttrSecondes?: number): StatKairo[] {
  const enCours = ticketsFiltres(tickets, 'enCours').length;
  const pr = ticketsFiltres(tickets, 'pr').length;
  const aReprendre = ticketsFiltres(tickets, 'aReprendre').length;
  const termines = pr + aReprendre;
  const mttr = calculerMTTR(tickets, mttrSecondes);

  return [
    {
      titre: 'En cours',
      valeur: String(enCours),
      detail: libelleEnCours(enCours),
      accent: enCours > 0 ? 'text-primary' : 'text-foreground',
    },
    {
      titre: 'PR proposées',
      valeur: String(pr),
      detail: `${String(pr)} à relire`,
      accent: pr > 0 ? 'text-success' : 'text-foreground',
    },
    {
      titre: 'À arbitrer',
      valeur: String(aReprendre),
      detail: libelleBlocages(aReprendre),
      accent: aReprendre > 0 ? 'text-accent-text' : 'text-foreground',
    },
    {
      titre: 'Taux de succès',
      valeur: libelleTaux(pr, termines),
      detail: `${String(pr)} PR sur ${String(termines)} terminé${termines > 1 ? 's' : ''}`,
      accent: 'text-foreground',
    },
    {
      titre: 'Délai moyen (MTTR)',
      valeur: mttr > 0 ? formatDuree(mttr) : '–',
      detail: 'Temps moyen avant PR',
      accent: 'text-foreground',
    },
  ];
}

function CelluleStat(props: { item: StatKairo; large: boolean }) {
  const { item, large } = props;
  return (
    <div className={cn('flex flex-col gap-1.5 p-5 sm:p-6', large ? 'col-span-2 sm:col-span-1' : '')}>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {item.titre}
      </span>
      <span
        className={cn(
          'font-display text-3xl font-bold tracking-tight tabular-nums sm:text-4xl',
          item.accent,
        )}
      >
        {item.valeur}
      </span>
      <span className="text-xs text-muted-foreground">{item.detail}</span>
    </div>
  );
}

export function IndicateursKairo(props: {
  tickets: TicketKairo[];
  mttrSecondes?: number | undefined;
}) {
  const { tickets, mttrSecondes } = props;
  const stats = genererStats(tickets, mttrSecondes);

  return (
    <Card className="overflow-hidden rounded-2xl border border-border/80 bg-card p-0 shadow-xs">
      <div className="grid grid-cols-2 divide-y divide-border/60 sm:grid-cols-3 sm:divide-y-0 sm:divide-x xl:grid-cols-5">
        {stats.map((item, idx) => (
          <CelluleStat key={item.titre} item={item} large={idx === 4} />
        ))}
      </div>
    </Card>
  );
}
