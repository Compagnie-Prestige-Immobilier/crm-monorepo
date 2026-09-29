'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type RendezVousObtenu } from '@/lib/data/rendez-vous';
import { dakarLocalToIso } from '@/lib/format';

export function ReporterRendezVous({
  fiche,
  pending,
  onReporter,
  onClose,
}: {
  fiche: RendezVousObtenu;
  pending: boolean;
  onReporter: (iso: string) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState('');
  const iso = dakarLocalToIso(local);
  return (
    <Dialog
      open
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Reporter le rendez-vous de {fiche.prenom} {fiche.nom}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="rendez-vous-nouvelle-date">Nouvelle date (heure de Dakar)</Label>
          <Input
            id="rendez-vous-nouvelle-date"
            type="datetime-local"
            value={local}
            onChange={(event) => {
              setLocal(event.target.value);
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button
            disabled={iso === null || pending}
            onClick={() => {
              if (iso !== null) onReporter(iso);
            }}
          >
            Reporter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
