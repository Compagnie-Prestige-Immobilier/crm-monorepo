import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GitPullRequestIcon,
  LoaderIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Kpi } from '@/components/bank/bank-kpi';
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
  ticketsFiltres,
  type FiltreTickets,
  type TicketKairo,
} from '@/lib/data/kairo';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

const STATUTS: Record<
  string,
  { libelle: string; variante: 'info' | 'success' | 'warning' | 'destructive' | 'secondary' }
> = {
  running: { libelle: 'En cours', variante: 'info' },
  retry: { libelle: 'Nouvel essai prévu', variante: 'warning' },
  pr: { libelle: 'PR proposée', variante: 'success' },
  escalade: { libelle: 'Escaladé', variante: 'warning' },
  echec: { libelle: 'Échec', variante: 'destructive' },
  abandon: { libelle: 'Clos avant traitement', variante: 'secondary' },
};

export function IndicateursKairo({ tickets }: { tickets: TicketKairo[] }) {
  const pr = ticketsFiltres(tickets, 'pr').length;
  const aReprendre = ticketsFiltres(tickets, 'aReprendre').length;
  const termines = pr + aReprendre;
  const reussite = termines === 0 ? '–' : `${String(Math.round((pr / termines) * 100))} %`;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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
    </div>
  );
}

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
        statuts={STATUTS}
        onClose={() => setInspecte(null)}
        onRelancer={(t) => setARelancer(t)}
      />
    </Card>
  );
}

function prefixeMotif(statut: string): string {
  if (statut === 'escalade') return 'Escalade : ';
  if (statut === 'echec') return 'Échec : ';
  return 'Résumé : ';
}

function LigneMotif(props: { ticket: TicketKairo; onInspecter: () => void }) {
  const motif = props.ticket.resume || props.ticket.cause;
  if (!motif) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <p className="min-w-0 truncate">
        <span className="font-semibold text-foreground/80">
          {prefixeMotif(props.ticket.statut)}
        </span>
        {motif}
      </p>
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
  const peutRelancer = ticket.statut === 'echec' || ticket.statut === 'escalade';
  const majLe = isoKairo(ticket.majLe);
  return (
    <span className="ml-auto flex items-center gap-2 sm:gap-3 text-sm text-muted-foreground tabular-nums">
      <span>
        {ticket.essais > 1 ? `${String(ticket.essais)} essais · ` : null}
        <time dateTime={majLe} title={formatDateTime(majLe)}>
          {ilYA(majLe)}
        </time>
      </span>
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
  const statut = STATUTS[ticket.statut] ?? { libelle: ticket.statut, variante: 'secondary' };
  const aDetails = Boolean(ticket.resume || ticket.cause || ticket.notes);

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
