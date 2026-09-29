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
import { Textarea } from '@/components/ui/textarea';
import { type RendezVousObtenu } from '@/lib/data/rendez-vous';

export function RecontacterRendezVous({
  fiche,
  pending,
  onRecontacter,
  onClose,
}: {
  fiche: RendezVousObtenu;
  pending: boolean;
  onRecontacter: (commentaire: string, recontacterLe: string) => void;
  onClose: () => void;
}) {
  const [commentaire, setCommentaire] = useState(fiche.recontacterNote);
  const [le, setLe] = useState(fiche.recontacterLe);
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
            À recontacter : {fiche.prenom} {fiche.nom}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="recontact-commentaire">Ce que la personne a dit</Label>
          <Textarea
            id="recontact-commentaire"
            value={commentaire}
            maxLength={1000}
            rows={4}
            onChange={(event) => {
              setCommentaire(event.target.value);
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="recontact-date">Recontacter le (facultatif)</Label>
          <Input
            id="recontact-date"
            type="date"
            value={le}
            onChange={(event) => {
              setLe(event.target.value);
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button
            disabled={commentaire.trim() === '' || pending}
            onClick={() => {
              onRecontacter(commentaire.trim(), le);
            }}
          >
            Mettre à recontacter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
