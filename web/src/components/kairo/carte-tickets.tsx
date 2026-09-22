import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLinkIcon, FileTextIcon, GitPullRequestIcon, RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { DialogDetailTicket } from '@/components/kairo/dialog-detail-ticket';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CLE_KAIRO,
  FILTRES_TICKETS,
  ilYA,
  isoKairo,
  relancerTicketKairo,
  STATUTS_KAIRO,
  ticketsFiltres,
  type FiltreTickets,
  type TicketKairo,
} from '@/lib/data/kairo';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

export { IndicateursKairo } from '@/components/kairo/indicateurs-kairo';

export function CarteTickets({
  tickets,
  desactive,
}: {
  tickets: TicketKairo[];
  desactive?: boolean | undefined;
}) {
  const client = useQueryClient();
  const [filtre, setFiltre] = useState<FiltreTickets>(() =>
    ticketsFiltres(tickets, 'aReprendre').length > 0 ? 'aReprendre' : 'tous',
  );
  const [aRelancer, setARelancer] = useState<TicketKairo | null>(null);
  const [inspecte, setInspecte] = useState<TicketKairo | null>(null);

  const relance = useMutation({
    mutationFn: relancerTicketKairo,
    onSuccess: (_, id) => {
      toast.success(`Ticket n° ${String(id)} remis à Kairo. Il le reprend à la prochaine lecture.`);
      setARelancer(null);
    },
    onError: (error) => toastApiError(error, 'Kairo n’a pas pris la relance.'),
    onSettled: () => client.invalidateQueries({ queryKey: CLE_KAIRO }),
  });

  const visibles = ticketsFiltres(tickets, filtre);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle>Tickets GLPI</CardTitle>
        <Tabs
          value={filtre}
          onValueChange={(valeur) => setFiltre(valeur as FiltreTickets)}
          className="min-w-0 max-w-full"
        >
          <TabsList className="w-full justify-start overflow-x-auto md:w-fit">
            {(Object.keys(FILTRES_TICKETS) as FiltreTickets[]).map((cle) => (
              <TabsTrigger key={cle} value={cle}>
                {FILTRES_TICKETS[cle].libelle}
                <span className="ml-1.5 tabular-nums text-muted-foreground">
                  {ticketsFiltres(tickets, cle).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {visibles.length === 0 ? (
          <p className="rounded-md bg-secondary px-4 py-8 text-center text-sm text-muted-foreground">
            {tickets.length === 0
              ? 'Aucun ticket pour l’instant. Kairo prend les nouveaux tickets de la catégorie GLPI qu’il suit.'
              : 'Rien dans cette catégorie. Choisissez « Tous » pour voir l’historique.'}
          </p>
        ) : (
          <ul className="divide-y" aria-label="Tickets traités par Kairo">
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

      <ConfirmDialog
        open={aRelancer !== null}
        onOpenChange={(ouvert) => !ouvert && setARelancer(null)}
        title={`Relancer le ticket n° ${String(aRelancer?.id ?? '')} ?`}
        description="Kairo le reprend depuis le début, avec trois essais, et l’annonce au demandeur dans GLPI."
        confirmLabel="Relancer"
        confirmVariant="default"
        pending={relance.isPending}
        onConfirm={() => aRelancer !== null && relance.mutate(aRelancer.id)}
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

function prefixeMotif(statut: string): string {
  if (statut === 'escalade') return 'Escalade : ';
  if (statut === 'echec') return 'Échec : ';
  if (statut === 'triage') return 'Triage : ';
  return 'Résumé : ';
}

function PastilleFichiers(props: { fichiers?: string | undefined }) {
  if (!props.fichiers) return null;
  const list = props.fichiers.split(',').filter(Boolean);
  if (list.length === 0) return null;
  const premier = list[0];
  const reste = list.length - 1;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80"
      title={props.fichiers}
    >
      <span>{premier}</span>
      {reste > 0 ? <span className="text-muted-foreground">+{String(reste)}</span> : null}
    </span>
  );
}

function LigneMotif(props: { ticket: TicketKairo; onInspecter: () => void }) {
  const motif = props.ticket.resume || props.ticket.cause;
  if (!motif && !props.ticket.fichiers) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <PastilleFichiers fichiers={props.ticket.fichiers} />
        {motif ? (
          <p className="min-w-0 truncate">
            <span className="font-semibold text-foreground/80">
              {prefixeMotif(props.ticket.statut)}
            </span>
            {motif}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={props.onInspecter}
        className="shrink-0 text-primary hover:underline"
      >
        Lire plus
      </button>
    </div>
  );
}

function ActionsTicket(props: {
  ticket: TicketKairo;
  desactive?: boolean | undefined;
  aDetails: boolean;
  onRelancer: (t: TicketKairo) => void;
  onInspecter: (t: TicketKairo) => void;
}) {
  const { ticket, desactive, aDetails, onRelancer, onInspecter } = props;
  const peutRelancer =
    ticket.statut === 'echec' ||
    ticket.statut === 'escalade' ||
    ticket.statut === 'arrete' ||
    ticket.statut === 'triage';
  const majLe = isoKairo(ticket.majLe);
  return (
    <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground tabular-nums sm:gap-3">
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
          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success hover:bg-success/25 hover:underline"
          title="Ouvrir la pull request GitHub"
        >
          <GitPullRequestIcon className="size-3" />
          Voir la PR
        </a>
      ) : null}
      {aDetails ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onInspecter(ticket)}
          className="h-8 px-2"
          title="Afficher les détails"
        >
          <FileTextIcon className="size-3.5" />
          <span className="hidden sm:inline">Détails</span>
        </Button>
      ) : null}
      {peutRelancer ? (
        <Button
          size="sm"
          variant="outline"
          disabled={desactive}
          title={desactive ? 'Kairo est hors de portée' : undefined}
          onClick={() => onRelancer(ticket)}
        >
          <RotateCcwIcon className="size-3.5" />
          Relancer
        </Button>
      ) : null}
    </span>
  );
}

function LigneTicket(props: {
  ticket: TicketKairo;
  desactive?: boolean | undefined;
  onRelancer: (t: TicketKairo) => void;
  onInspecter: (t: TicketKairo) => void;
}) {
  const { ticket, desactive, onRelancer, onInspecter } = props;
  const statut = STATUTS_KAIRO[ticket.statut] ?? { libelle: ticket.statut, variante: 'secondary' };
  const aDetails = Boolean(
    ticket.resume || ticket.cause || ticket.notes || ticket.prUrl || ticket.fichiers,
  );

  return (
    <li className="flex flex-col gap-1.5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <a
          href={ticket.lien}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 font-[600] tabular-nums hover:underline"
        >
          Ticket n° {ticket.id}
          <ExternalLinkIcon
            className="size-3.5 text-muted-foreground"
            aria-label="(nouvel onglet)"
          />
        </a>
        <Badge variant={statut.variante}>{statut.libelle}</Badge>
        {ticket.jevConfiance && ticket.jevConfiance > 0 ? (
          <span
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            title={`Qualifié par JEV${ticket.jevCategorie ? ` : ${ticket.jevCategorie}` : ''}`}
          >
            JEV · {Math.round(ticket.jevConfiance * 100)}%
          </span>
        ) : null}
        <span className="text-sm text-muted-foreground">{ticket.projet}</span>
        <ActionsTicket
          ticket={ticket}
          desactive={desactive}
          aDetails={aDetails}
          onRelancer={onRelancer}
          onInspecter={onInspecter}
        />
      </div>
      <LigneMotif ticket={ticket} onInspecter={() => onInspecter(ticket)} />
    </li>
  );
}
