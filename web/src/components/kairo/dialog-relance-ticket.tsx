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
  const titre = estEscalade ? 'Dilemme soulevé par l’agent :' : 'Dernier motif relevé :';
  return (
    <div className="rounded-md border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-foreground dark:border-amber-900/50 dark:bg-amber-950/30">
      <p className="font-semibold text-amber-900 dark:text-amber-200">{titre}</p>
      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{motif}</p>
      {notes ? (
        <p className="mt-2 text-muted-foreground/80">
          <span className="font-medium text-foreground">Point d’attention :</span> {notes}
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
        className="text-xs"
      >
        <UserCheckIcon className="size-3.5" />
        Prendre en main
      </Button>

      <Button type="button" size="sm" disabled={desactive} onClick={onRelance} className="text-xs">
        <RotateCcwIcon className="size-3.5" />
        {texteRelance}
      </Button>
    </DialogFooter>
  );
}

export function DialogRelanceTicket(props: {
  ticket: TicketKairo | null;
  desactive?: boolean | undefined;
  onClose: () => void;
}) {
  const { ticket, desactive, onClose } = props;
  const client = useQueryClient();
  const [consigne, setConsigne] = useState('');

  const relance = useMutation({
    mutationFn: relancerTicketKairo,
    onSuccess: (_, variables) => {
      const id = typeof variables === 'number' ? variables : variables.id;
      toast.success(`Ticket n° ${String(id)} remis à Kairo.`);
      onClose();
      setConsigne('');
    },
    onError: (error) => toastApiError(error, 'Kairo n’a pas pris la relance.'),
    onSettled: () => client.invalidateQueries({ queryKey: CLE_KAIRO }),
  });

  const priseEnMain = useMutation({
    mutationFn: prendreEnMainTicketKairo,
    onSuccess: (_, id) => {
      toast.success(`Ticket n° ${String(id)} pris en main par l'équipe.`);
      onClose();
      setConsigne('');
    },
    onError: (error) => toastApiError(error, 'Impossible de prendre en main le ticket.'),
    onSettled: () => client.invalidateQueries({ queryKey: CLE_KAIRO }),
  });

  if (ticket === null) return null;

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

  const gererFermeture = (ouvert: boolean) => {
    if (!ouvert && !occupe) {
      onClose();
    }
  };

  const gererRelance = () => {
    const texte = consigne.trim();
    relance.mutate({
      id: ticket.id,
      consigne: texte !== '' ? texte : undefined,
      action: 'relancer',
    });
  };

  return (
    <Dialog open={ticket !== null} onOpenChange={gererFermeture}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold">{titre}</DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>

        {motif ? (
          <MotifArbitrage motif={motif} notes={ticket.notes} estEscalade={estEscalade} />
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="consigne-kairo"
            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Consigne ou directive pour Kairo (optionnel)
          </label>
          <textarea
            id="consigne-kairo"
            value={consigne}
            disabled={occupe}
            onChange={(e) => setConsigne(e.target.value)}
            placeholder="Ex. Ne corriger que le composant d'interface sans toucher au modèle Go..."
            className="h-20 w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>

        <PiedRelance
          desactive={occupe}
          texteRelance={texteBouton}
          onPriseEnMain={() => priseEnMain.mutate(ticket.id)}
          onRelance={gererRelance}
        />
      </DialogContent>
    </Dialog>
  );
}
