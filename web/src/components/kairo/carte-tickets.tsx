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
    <Card className="border border-border/80 bg-card/60 shadow-xs backdrop-blur-xs">
      <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <CardTitle className="font-display text-base font-bold text-foreground sm:text-lg">
            Tickets GLPI
          </CardTitle>
          <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
            {tickets.length} au total
          </span>
        </div>
        <Tabs
          value={filtre}
          onValueChange={(valeur) => setFiltre(valeur as FiltreTickets)}
          className="min-w-0 max-w-full"
        >
          <TabsList className="h-8 w-full justify-start overflow-x-auto bg-muted/50 p-0.5 md:w-fit">
            {(Object.keys(FILTRES_TICKETS) as FiltreTickets[]).map((cle) => {
              const compte = ticketsFiltres(tickets, cle).length;
              return (
                <TabsTrigger key={cle} value={cle} className="h-7 px-2.5 text-xs">
                  {FILTRES_TICKETS[cle].libelle}
                  <span
                    className={cn(
                      'ml-1.5 tabular-nums text-[11px]',
                      cle === 'aReprendre' && compte > 0
                        ? 'font-semibold text-amber-600 dark:text-amber-400'
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
          <p className="rounded-md bg-secondary/40 px-4 py-8 text-center text-xs text-muted-foreground">
            {tickets.length === 0
              ? 'Aucun ticket traité pour le moment. Kairo surveille les nouveaux tickets GLPI.'
              : 'Aucun ticket dans cette catégorie.'}
          </p>
        ) : (
          <ul className="divide-y divide-border/50" aria-label="Tickets traités par Kairo">
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
    <div className="flex flex-wrap items-center gap-2.5">
      <a
        href={ticket.lien}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 font-mono text-xs font-semibold tabular-nums text-foreground hover:underline"
      >
        #{ticket.id}
        <ExternalLinkIcon className="size-3 text-muted-foreground/70" aria-label="(GLPI)" />
      </a>
      <Badge variant={statut.variante} className="text-[11px]">
        {statut.libelle}
      </Badge>
      <span className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        {ticket.projet}
      </span>
      {jevActif ? (
        <span
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
          title={`Qualifié par JEV${infoJev}`}
        >
          JEV · {Math.round((ticket.jevConfiance ?? 0) * 100)}%
        </span>
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
  const libelleBouton = ticket.statut === 'escalade' ? 'Arbitrer' : 'Relancer';
  const varianteBouton = ticket.statut === 'escalade' ? 'default' : 'outline';

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
          className="inline-flex h-7 items-center gap-1 rounded-md bg-success/15 px-2 text-xs font-semibold text-success hover:bg-success/25 hover:underline"
        >
          <GitPullRequestIcon className="size-3" />
          Voir la PR
        </a>
      ) : null}

      {estBloque ? (
        <Button
          size="sm"
          variant={varianteBouton}
          disabled={desactive}
          onClick={() => onRelancer(ticket)}
          className="h-7 px-2.5 text-xs"
        >
          <RotateCcwIcon className="size-3" />
          {libelleBouton}
        </Button>
      ) : null}

      <Button
        size="sm"
        variant="ghost"
        onClick={() => onInspecter(ticket)}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
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
    const titre = ticket.statut === 'escalade' ? 'Arbitrage demandé :' : 'Origine du blocage :';
    return (
      <div className="rounded-md border border-amber-200/50 bg-amber-50/40 p-2.5 text-xs dark:border-amber-900/30 dark:bg-amber-950/20">
        <p className="font-semibold text-amber-900 dark:text-amber-300">{titre}</p>
        <p className="mt-0.5 text-foreground/90">{motif}</p>
        {ticket.consigne ? (
          <p className="mt-1.5 border-t border-amber-200/40 pt-1.5 text-[11px] text-muted-foreground dark:border-amber-900/30">
            <span className="font-medium text-foreground">Consigne de l’équipe :</span>{' '}
            {ticket.consigne}
          </p>
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
    <li className="flex flex-col gap-2 py-3.5">
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
