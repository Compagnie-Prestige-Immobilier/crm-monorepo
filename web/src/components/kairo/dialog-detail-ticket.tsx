import { CopyIcon, ExternalLinkIcon, RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ilYA, isoKairo, type TicketKairo } from '@/lib/data/kairo';

export function DialogDetailTicket(props: {
  ticket: TicketKairo | null;
  desactive?: boolean | undefined;
  statuts: Record<
    string,
    { libelle: string; variante: 'info' | 'success' | 'warning' | 'destructive' | 'secondary' }
  >;
  onClose: () => void;
  onRelancer: (t: TicketKairo) => void;
}) {
  const { ticket, desactive, statuts, onClose, onRelancer } = props;
  if (ticket === null) return null;

  const statut = statuts[ticket.statut] ?? {
    libelle: ticket.statut,
    variante: 'secondary' as const,
  };

  async function copierMotif() {
    if (!ticket) return;
    const lignes = [
      `Ticket n° ${String(ticket.id)} (${statut.libelle}) · ${ticket.projet}`,
      ticket.resume ? `Résumé : ${ticket.resume}` : '',
      ticket.cause ? `Origine : ${ticket.cause}` : '',
      ticket.notes ? `Points d’attention : ${ticket.notes}` : '',
    ].filter(Boolean);
    await navigator.clipboard.writeText(lignes.join('\n\n'));
    toast.success('Détails copiés dans le presse-papier.');
  }

  return (
    <Dialog open={ticket !== null} onOpenChange={(ouvert) => !ouvert && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>Ticket n° {ticket.id}</DialogTitle>
            <Badge variant={statut.variante}>{statut.libelle}</Badge>
            <span className="text-sm text-muted-foreground">{ticket.projet}</span>
          </div>
          <DialogDescription>
            {ticket.essais > 1 ? `${String(ticket.essais)} essais. ` : ''}Dernière mise à jour{' '}
            {ilYA(isoKairo(ticket.majLe))}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          {ticket.resume ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Résumé
              </p>
              <p className="mt-1 rounded-md bg-secondary/60 p-2.5 whitespace-pre-wrap">
                {ticket.resume}
              </p>
            </div>
          ) : null}

          {ticket.cause ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Origine / Cause
              </p>
              <p className="mt-1 rounded-md bg-secondary/60 p-2.5 whitespace-pre-wrap">
                {ticket.cause}
              </p>
            </div>
          ) : null}

          {ticket.notes ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Points d’attention
              </p>
              <p className="mt-1 rounded-md bg-secondary/60 p-2.5 whitespace-pre-wrap">
                {ticket.notes}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-2 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void copierMotif()}>
            <CopyIcon className="size-3.5" />
            Copier
          </Button>
          <a
            href={ticket.lien}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ExternalLinkIcon className="size-3.5" />
            Ouvrir GLPI
          </a>
          {ticket.statut === 'echec' || ticket.statut === 'escalade' ? (
            <Button
              size="sm"
              disabled={desactive}
              title={desactive ? 'Kairo est hors de portée' : undefined}
              onClick={() => {
                onRelancer(ticket);
                onClose();
              }}
            >
              <RotateCcwIcon className="size-3.5" />
              Relancer
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
