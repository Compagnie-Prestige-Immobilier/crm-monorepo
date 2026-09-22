import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcwIcon, UserCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CLE_KAIRO,
  prendreEnMainTicketKairo,
  relancerTicketKairo,
  type TicketKairo,
} from '@/lib/data/kairo';
import { toastApiError } from '@/lib/mutation-feedback';

function MotifArbitrage(props: {
  motif: string;
  notes?: string | undefined;
  estEscalade: boolean;
}) {
  const { motif, notes, estEscalade } = props;
  const titre = estEscalade ? 'Dilemme soulevé par l’agent' : 'Dernier motif relevé';
  return (
    <div className="rounded-xl border border-border/80 bg-secondary/40 p-3.5 text-xs">
      <p className="font-semibold text-foreground">{titre}</p>
      <p className="mt-1 leading-relaxed text-muted-foreground">{motif}</p>
      {notes ? (
        <p className="mt-2 text-muted-foreground">
          <span className="font-semibold text-foreground">Point d’attention : </span>
          {notes}
        </p>
      ) : null}
    </div>
  );
}

function PiedRelance(props: {
  desactive: boolean;
  texteRelance: string;
  onPriseEnMain: () => void;
  onRelance: () => void;
}) {
  const { desactive, texteRelance, onPriseEnMain, onRelance } = props;
  return (
    <DialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-between">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={desactive}
        onClick={onPriseEnMain}
        className="rounded-lg px-4 text-xs font-semibold"
      >
        <UserCheckIcon className="size-3.5" />
        Prendre en main
      </Button>

      <Button
        type="button"
        size="sm"
        disabled={desactive}
        onClick={onRelance}
        className="rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-hover shadow-xs"
      >
        <RotateCcwIcon className="size-3.5" />
        {texteRelance}
      </Button>
    </DialogFooter>
  );
}

function CorpsRelance(props: { ticket: TicketKairo; desactive: boolean; onClose: () => void }) {
  const { ticket, desactive, onClose } = props;
  const client = useQueryClient();
  const [consigne, setConsigne] = useState(ticket.consigne ?? '');

  const relance = useMutation({
    mutationFn: relancerTicketKairo,
    onSuccess: (_, variables) => {
      const id = typeof variables === 'number' ? variables : variables.id;
      toast.success(`Ticket n° ${String(id)} remis à Kairo.`);
      onClose();
    },
    onError: (error) => toastApiError(error, 'Kairo n’a pas pris la relance.'),
    onSettled: () => client.invalidateQueries({ queryKey: CLE_KAIRO }),
  });

  const priseEnMain = useMutation({
    mutationFn: prendreEnMainTicketKairo,
    onSuccess: (_, id) => {
      toast.success(`Ticket n° ${String(id)} pris en main par l’équipe.`);
      onClose();
    },
    onError: (error) => toastApiError(error, 'Impossible de prendre en main le ticket.'),
    onSettled: () => client.invalidateQueries({ queryKey: CLE_KAIRO }),
  });

  const estEscalade = ticket.statut === 'escalade';
  const motif = ticket.resume || ticket.cause;
  const occupe = Boolean(desactive || relance.isPending || priseEnMain.isPending);
  const titre = estEscalade
    ? `Arbitrage du ticket n° ${String(ticket.id)}`
    : `Relancer le ticket n° ${String(ticket.id)}`;
  const description = estEscalade
    ? 'Indiquez une consigne à Kairo pour orienter sa correction, ou prenez la main sur le ticket.'
    : 'Kairo reprend le ticket depuis le début, avec trois tentatives.';
  const texteBouton = consigne.trim() !== '' ? 'Relancer avec consigne' : 'Relancer tel quel';

  const gererRelance = () => {
    const texte = consigne.trim();
    relance.mutate({
      id: ticket.id,
      consigne: texte !== '' ? texte : undefined,
      action: 'relancer',
    });
  };

  return (
    <>
      <DialogHeader className="gap-1">
        <DialogTitle className="font-display text-xl font-bold tracking-tight text-foreground">
          {titre}
        </DialogTitle>
        <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </DialogDescription>
      </DialogHeader>

      {motif ? (
        <MotifArbitrage motif={motif} notes={ticket.notes} estEscalade={estEscalade} />
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="consigne-kairo" className="text-xs font-semibold text-foreground">
          Consigne pour Kairo (optionnel)
        </label>
        <textarea
          id="consigne-kairo"
          value={consigne}
          disabled={occupe}
          onChange={(e) => setConsigne(e.target.value)}
          placeholder="Ex. Ne corriger que le composant d’interface sans toucher au modèle Go..."
          className="h-24 w-full rounded-xl border border-input-border bg-input-background p-3 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
      </div>

      <PiedRelance
        desactive={occupe}
        texteRelance={texteBouton}
        onPriseEnMain={() => priseEnMain.mutate(ticket.id)}
        onRelance={gererRelance}
      />
    </>
  );
}

export function DialogRelanceTicket(props: {
  ticket: TicketKairo | null;
  desactive?: boolean | undefined;
  onClose: () => void;
}) {
  const { ticket, desactive, onClose } = props;

  const gererFermeture = (ouvert: boolean) => {
    if (!ouvert) onClose();
  };

  return (
    <Dialog open={ticket !== null} onOpenChange={gererFermeture}>
      <DialogContent className="max-w-lg">
        {ticket ? (
          <CorpsRelance
            key={ticket.id}
            ticket={ticket}
            desactive={Boolean(desactive)}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
