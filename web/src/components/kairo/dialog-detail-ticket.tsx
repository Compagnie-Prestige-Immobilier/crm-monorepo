import {
  CopyIcon,
  ExternalLinkIcon,
  GitPullRequestIcon,
  RotateCcwIcon,
  TerminalIcon,
} from 'lucide-react';
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
import { formatDuree, ilYA, isoKairo, STATUTS_KAIRO, type TicketKairo } from '@/lib/data/kairo';

function SectionTexte(props: { titre: string; contenu?: string | undefined }) {
  if (!props.contenu) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-foreground">{props.titre}</p>
      <p className="mt-1 rounded-xl border border-border/70 bg-secondary/35 p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
        {props.contenu}
      </p>
    </div>
  );
}

function ListeFichiers(props: { fichiers?: string | undefined }) {
  if (!props.fichiers) return null;
  const list = props.fichiers.split(',').filter(Boolean);
  if (list.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-foreground">Fichiers modifiés ({list.length})</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {list.map((f) => (
          <span
            key={f}
            className="rounded-md border border-border/70 bg-secondary/50 px-2 py-0.5 font-mono text-[11px] text-foreground"
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

function peutRelancer(statut: string): boolean {
  return statut === 'echec' || statut === 'escalade' || statut === 'arrete';
}

function brancheKairo(ticketId: number): string {
  return `kairo/glpi-${String(ticketId)}`;
}

function commandeRecuperation(ticketId: number): string {
  const branche = brancheKairo(ticketId);
  return `git fetch origin ${branche} && git checkout ${branche}`;
}

function texteACopier(ticket: TicketKairo, libelleStatut: string): string {
  const lignes: string[] = [`Ticket n° ${String(ticket.id)} (${libelleStatut}) · ${ticket.projet}`];
  if (ticket.jevConfiance && ticket.jevConfiance > 0) {
    lignes.push(
      `Classification JEV : ${ticket.jevCategorie || 'CODE_DEFECT'} (${String(Math.round(ticket.jevConfiance * 100))}%)`,
    );
  }
  if (ticket.prUrl) lignes.push(`PR : ${ticket.prUrl}`);
  if (ticket.resume) lignes.push(`Résumé : ${ticket.resume}`);
  if (ticket.cause) lignes.push(`Origine : ${ticket.cause}`);
  if (ticket.notes) lignes.push(`Points d’attention : ${ticket.notes}`);
  if (ticket.fichiers) lignes.push(`Fichiers : ${ticket.fichiers}`);
  return lignes.join('\n\n');
}

function BadgeJEV(props: { categorie?: string | undefined; confiance?: number | undefined }) {
  if (!props.confiance || props.confiance <= 0) return null;
  const pct = Math.round(props.confiance * 100);
  const lib = props.categorie ? `· ${props.categorie}` : '';
  return (
    <Badge variant="outline" className="font-mono text-xs">
      JEV {lib} ({String(pct)}%)
    </Badge>
  );
}

function EnteteTicket(props: {
  ticket: TicketKairo;
  statut: {
    libelle: string;
    variante: 'info' | 'success' | 'warning' | 'destructive' | 'secondary';
  };
}) {
  const { ticket, statut } = props;
  const dureeTxt =
    ticket.dureeSecondes && ticket.dureeSecondes > 0
      ? ` · Traité en ${formatDuree(ticket.dureeSecondes)}`
      : '';
  const essaisTxt = ticket.essais > 1 ? `${String(ticket.essais)} essais · ` : '';

  return (
    <DialogHeader>
      <div className="flex flex-wrap items-center gap-2">
        <DialogTitle>Ticket n° {ticket.id}</DialogTitle>
        <Badge variant={statut.variante}>{statut.libelle}</Badge>
        <BadgeJEV categorie={ticket.jevCategorie} confiance={ticket.jevConfiance} />
        <span className="text-sm text-muted-foreground">{ticket.projet}</span>
      </div>
      <DialogDescription>
        {essaisTxt}Mis à jour {ilYA(isoKairo(ticket.majLe))}
        {dureeTxt}.
      </DialogDescription>
    </DialogHeader>
  );
}

function PiedTicket(props: {
  ticket: TicketKairo;
  desactive?: boolean | undefined;
  onCopier: () => void;
  onRelancer: (t: TicketKairo) => void;
  onClose: () => void;
}) {
  const { ticket, desactive, onCopier, onRelancer, onClose } = props;

  async function copierCommande() {
    await navigator.clipboard.writeText(commandeRecuperation(ticket.id));
    toast.success('Commande de récupération locale copiée.');
  }

  return (
    <DialogFooter className="mt-2 flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={onCopier}>
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
      {ticket.prUrl ? (
        <>
          <a
            href={ticket.prUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'default', size: 'sm' })}
          >
            <GitPullRequestIcon className="size-3.5" />
            Ouvrir la PR
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void copierCommande()}
            title={commandeRecuperation(ticket.id)}
          >
            <TerminalIcon className="size-3.5" />
            Copier la commande git
          </Button>
        </>
      ) : null}
      {peutRelancer(ticket.statut) ? (
        <Button
          size="sm"
          variant={ticket.statut === 'escalade' ? 'default' : 'outline'}
          disabled={desactive}
          title={desactive ? 'Kairo est hors de portée' : undefined}
          onClick={() => {
            onRelancer(ticket);
            onClose();
          }}
          className={
            ticket.statut === 'escalade'
              ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
              : undefined
          }
        >
          <RotateCcwIcon className="size-3.5" />
          {ticket.statut === 'escalade' ? 'Arbitrer' : 'Relancer'}
        </Button>
      ) : null}
    </DialogFooter>
  );
}

export function DialogDetailTicket(props: {
  ticket: TicketKairo | null;
  desactive?: boolean | undefined;
  onClose: () => void;
  onRelancer: (t: TicketKairo) => void;
}) {
  const { ticket, desactive, onClose, onRelancer } = props;
  if (ticket === null) return null;

  const statut = STATUTS_KAIRO[ticket.statut] ?? {
    libelle: ticket.statut,
    variante: 'secondary' as const,
  };

  async function copierMotif() {
    if (!ticket) return;
    await navigator.clipboard.writeText(texteACopier(ticket, statut.libelle));
    toast.success('Détails copiés dans le presse-papier.');
  }

  return (
    <Dialog open={ticket !== null} onOpenChange={(ouvert) => !ouvert && onClose()}>
      <DialogContent className="max-w-xl">
        <EnteteTicket ticket={ticket} statut={statut} />
        <div className="flex flex-col gap-4 text-sm">
          <SectionTexte titre="Résumé" contenu={ticket.resume} />
          <SectionTexte titre="Origine / Cause" contenu={ticket.cause} />
          <SectionTexte titre="Points d’attention" contenu={ticket.notes} />
          <SectionTexte titre="Consigne d’arbitrage appliquée" contenu={ticket.consigne} />
          <ListeFichiers fichiers={ticket.fichiers} />
        </div>
        <PiedTicket
          ticket={ticket}
          desactive={desactive}
          onCopier={() => void copierMotif()}
          onRelancer={onRelancer}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
