import { ExternalLinkIcon, FileTextIcon, GitPullRequestIcon, RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';

import { DialogDetailTicket } from '@/components/kairo/dialog-detail-ticket';
import { DialogRelanceTicket } from '@/components/kairo/dialog-relance-ticket';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FILTRES_TICKETS,
  ilYA,
  isoKairo,
  STATUTS_KAIRO,
  ticketsFiltres,
  type FiltreTickets,
  type TicketKairo,
} from '@/lib/data/kairo';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export { IndicateursKairo } from '@/components/kairo/indicateurs-kairo';

export function CarteTickets({
  tickets,
  desactive,
}: {
  tickets: TicketKairo[];
  desactive?: boolean | undefined;
}) {
  const [filtre, setFiltre] = useState<FiltreTickets>(() =>
    ticketsFiltres(tickets, 'aReprendre').length > 0 ? 'aReprendre' : 'tous',
  );
  const [aRelancer, setARelancer] = useState<TicketKairo | null>(null);
  const [inspecte, setInspecte] = useState<TicketKairo | null>(null);

  const visibles = ticketsFiltres(tickets, filtre);

  return (
    <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
      <CardHeader className="flex flex-col gap-4 pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <CardTitle className="font-display text-xl font-bold tracking-tight text-foreground">
            Tickets GLPI
          </CardTitle>
          <Badge variant="secondary" className="font-mono text-xs font-semibold">
            {tickets.length} au total
          </Badge>
        </div>
        <Tabs
          value={filtre}
          onValueChange={(valeur) => setFiltre(valeur as FiltreTickets)}
          className="min-w-0 max-w-full"
        >
          <TabsList className="h-9 w-full justify-start overflow-x-auto rounded-lg bg-secondary p-1 md:w-fit">
            {(Object.keys(FILTRES_TICKETS) as FiltreTickets[]).map((cle) => {
              const compte = ticketsFiltres(tickets, cle).length;
              return (
                <TabsTrigger
                  key={cle}
                  value={cle}
                  className="rounded-md px-3 py-1 text-xs font-medium transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                >
                  {FILTRES_TICKETS[cle].libelle}
                  <span
                    className={cn(
                      'ml-1.5 tabular-nums text-[11px]',
                      cle === 'aReprendre' && compte > 0
                        ? 'font-bold text-accent-text'
                        : 'text-muted-foreground',
                    )}
                  >
                    {compte}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {visibles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 bg-secondary/30 px-4 py-8 text-center text-xs text-muted-foreground">
            {tickets.length === 0
              ? 'Aucun ticket traité pour le moment. Kairo surveille les nouveaux tickets GLPI.'
              : 'Aucun ticket dans cette catégorie.'}
          </p>
        ) : (
          <ul className="divide-y divide-border/60" aria-label="Tickets traités par Kairo">
            {visibles.map((ticket) => (
              <LigneTicket
                key={ticket.id}
                ticket={ticket}
                desactive={desactive}
                onRelancer={setARelancer}
                onInspecter={setInspecte}
              />
            ))}
          </ul>
        )}
      </CardContent>

      <DialogRelanceTicket
        ticket={aRelancer}
        desactive={desactive}
        onClose={() => setARelancer(null)}
      />

      <DialogDetailTicket
        ticket={inspecte}
        desactive={desactive}
        onClose={() => setInspecte(null)}
        onRelancer={(t) => setARelancer(t)}
      />
    </Card>
  );
}

function EnteteTicket(props: { ticket: TicketKairo }) {
  const { ticket } = props;
  const statut = STATUTS_KAIRO[ticket.statut] ?? {
    libelle: ticket.statut,
    variante: 'secondary' as const,
  };
  const jevActif = Boolean(ticket.jevConfiance && ticket.jevConfiance > 0);
  const infoJev = ticket.jevCategorie ? ` : ${ticket.jevCategorie}` : '';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={ticket.lien}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-secondary/60 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-foreground hover:bg-secondary"
      >
        #{ticket.id}
        <ExternalLinkIcon className="size-3 text-muted-foreground" aria-label="(GLPI)" />
      </a>
      <Badge variant={statut.variante} className="rounded-md px-2.5 py-0.5 text-xs font-semibold">
        {statut.libelle}
      </Badge>
      <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
        {ticket.projet}
      </Badge>
      {jevActif ? (
        <Badge
          variant="secondary"
          className="font-mono text-[10px] text-muted-foreground"
          title={`Qualifié par JEV${infoJev}`}
        >
          JEV · {Math.round((ticket.jevConfiance ?? 0) * 100)}%
        </Badge>
      ) : null}
    </div>
  );
}

function ActionsTicket(props: {
  ticket: TicketKairo;
  desactive?: boolean | undefined;
  estBloque: boolean;
  onRelancer: (t: TicketKairo) => void;
  onInspecter: (t: TicketKairo) => void;
}) {
  const { ticket, desactive, estBloque, onRelancer, onInspecter } = props;
  const majLe = isoKairo(ticket.majLe);
  const estEscalade = ticket.statut === 'escalade';
  const libelleBouton = estEscalade ? 'Arbitrer' : 'Relancer';

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
      <span>
        {ticket.essais > 1 ? `${String(ticket.essais)} essais · ` : null}
        <time dateTime={majLe} title={formatDateTime(majLe)}>
          {ilYA(majLe)}
        </time>
      </span>

      {ticket.prUrl ? (
        <a
          href={ticket.prUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-secondary"
        >
          <GitPullRequestIcon className="size-3 text-success" />
          Voir la PR
        </a>
      ) : null}

      {estBloque ? (
        <Button
          size="sm"
          variant={estEscalade ? 'default' : 'outline'}
          disabled={desactive}
          onClick={() => onRelancer(ticket)}
          className={cn(
            'h-7 rounded-md px-3 text-xs font-semibold',
            estEscalade && 'bg-primary text-primary-foreground hover:bg-primary-hover',
          )}
        >
          <RotateCcwIcon className="size-3" />
          {libelleBouton}
        </Button>
      ) : null}

      <Button
        size="sm"
        variant="ghost"
        onClick={() => onInspecter(ticket)}
        className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <FileTextIcon className="size-3" />
        <span className="hidden sm:inline">Détails</span>
      </Button>
    </div>
  );
}

function MotifTicket(props: { ticket: TicketKairo; estBloque: boolean }) {
  const { ticket, estBloque } = props;
  const motif = ticket.resume || ticket.cause;
  if (!motif) return null;

  if (estBloque) {
    const titre = ticket.statut === 'escalade' ? 'Arbitrage demandé' : 'Origine du blocage';
    return (
      <div className="rounded-xl border border-border/80 bg-secondary/35 p-3.5 text-xs">
        <p className="font-semibold text-foreground">{titre}</p>
        <p className="mt-1 leading-relaxed text-muted-foreground">{motif}</p>
        {ticket.consigne ? (
          <div className="mt-2.5 rounded-lg border border-border/60 bg-card p-2.5 text-xs">
            <span className="font-semibold text-foreground">Consigne de l’équipe : </span>
            <span className="text-muted-foreground">{ticket.consigne}</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <p className="min-w-0 truncate">
        <span className="font-medium text-foreground/80">Résumé : </span>
        {motif}
      </p>
    </div>
  );
}

function LigneTicket(props: {
  ticket: TicketKairo;
  desactive?: boolean | undefined;
  onRelancer: (t: TicketKairo) => void;
  onInspecter: (t: TicketKairo) => void;
}) {
  const { ticket, desactive, onRelancer, onInspecter } = props;
  const estBloque =
    ticket.statut === 'escalade' ||
    ticket.statut === 'echec' ||
    ticket.statut === 'arrete' ||
    ticket.statut === 'triage';

  return (
    <li className="flex flex-col gap-2.5 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <EnteteTicket ticket={ticket} />
        <ActionsTicket
          ticket={ticket}
          desactive={desactive}
          estBloque={estBloque}
          onRelancer={onRelancer}
          onInspecter={onInspecter}
        />
      </div>
      <MotifTicket ticket={ticket} estBloque={estBloque} />
    </li>
  );
}
