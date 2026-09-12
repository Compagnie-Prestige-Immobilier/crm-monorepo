'use client';

import { LoaderIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Annuler',
  confirmVariant = 'destructive',
  pending = false,
  children,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  /** À nommer quand le geste confirmé est lui-même une annulation. */
  cancelLabel?: string;
  /** Rouge par défaut : la plupart des confirmations d'ici détruisent quelque chose. */
  confirmVariant?: 'default' | 'destructive';
  pending?: boolean;
  /** Ce que la confirmation coûte, quand le titre ne suffit pas à le dire. */
  children?: ReactNode;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {children}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {cancelLabel}
          </Button>
          <Button type="button" variant={confirmVariant} disabled={pending} onClick={onConfirm}>
            {pending ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Une boîte de saisie qui ne se referme pas sur une saisie en cours sans le
 * demander. `confirmation` se rend DANS la boîte gardée : imbriquée, elle ne
 * compte pas comme un clic à l'extérieur.
 */
export function useGardeSaisie(fermer: () => void): {
  signalerModifie: (modifie: boolean) => void;
  demanderFermeture: () => void;
  confirmation: ReactNode;
} {
  const [modifie, setModifie] = useState(false);
  const [confirmer, setConfirmer] = useState(false);

  return {
    signalerModifie: setModifie,
    demanderFermeture: () => {
      if (modifie) setConfirmer(true);
      else fermer();
    },
    confirmation: (
      <ConfirmDialog
        open={confirmer}
        onOpenChange={setConfirmer}
        title="Abandonner la saisie ?"
        description="Ce qui a été saisi sera perdu."
        confirmLabel="Abandonner la saisie"
        cancelLabel="Continuer la saisie"
        onConfirm={() => {
          setConfirmer(false);
          setModifie(false);
          fermer();
        }}
      />
    ),
  };
}
