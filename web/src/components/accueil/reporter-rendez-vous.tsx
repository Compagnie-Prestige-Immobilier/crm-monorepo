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
import { dakarLocalToIso } from '@/lib/format';

type Reponse = 'CONFIRME' | 'ANNULE' | 'REPORTE';
export type SuiviConfirmation = {
  issue: Reponse;
  reporteAt?: string;
  recontacterLe?: string;
  commentaire?: string;
};

const REPONSES: Record<Reponse, string> = {
  CONFIRME: 'Confirmé',
  ANNULE: 'Annulé',
  REPORTE: 'Reporté',
};

/** Un report sans heure garde la date seule ; sans date, il attend dans « À recontacter ». */
function suiviDu(reponse: Reponse, jour: string, heure: string, commentaire: string) {
  if (reponse !== 'REPORTE') return { issue: reponse };
  const reporteAt = heure === '' ? null : dakarLocalToIso(`${jour}T${heure}`);
  const texte = commentaire.trim();
  return {
    issue: reponse,
    ...(reporteAt === null ? {} : { reporteAt }),
    ...(reporteAt === null && jour !== '' ? { recontacterLe: jour } : {}),
    ...(texte === '' ? {} : { commentaire: texte }),
  };
}

export function ReporterRendezVous({
  fiche,
  confirmation,
  pending,
  onValider,
  onClose,
}: {
  fiche: RendezVousObtenu;
  confirmation: boolean;
  pending: boolean;
  onValider: (suivi: SuiviConfirmation) => void;
  onClose: () => void;
}) {
  const [reponse, setReponse] = useState<Reponse>(confirmation ? 'CONFIRME' : 'REPORTE');
  const [jour, setJour] = useState('');
  const [heure, setHeure] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const nom = `${fiche.prenom} ${fiche.nom}`;
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
            {confirmation
              ? `Confirmation du rendez-vous de ${nom}`
              : `Reporter le rendez-vous de ${nom}`}
          </DialogTitle>
        </DialogHeader>
        {confirmation ? (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Réponse de la personne</legend>
            {(Object.keys(REPONSES) as Reponse[]).map((choix) => (
              <label
                key={choix}
                className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 text-[0.9375rem] font-[600] has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
              >
                <input
                  type="radio"
                  name="reponse-rendez-vous"
                  className="size-4 accent-[var(--primary)]"
                  checked={reponse === choix}
                  onChange={() => {
                    setReponse(choix);
                  }}
                />
                {REPONSES[choix]}
              </label>
            ))}
          </fieldset>
        ) : null}
        {reponse === 'REPORTE' ? (
          <>
            <div className="grid grid-cols-2 items-end gap-3">
              <div className="grid gap-2">
                <Label htmlFor="rendez-vous-nouvelle-date">Nouvelle date (facultatif)</Label>
                <Input
                  id="rendez-vous-nouvelle-date"
                  type="date"
                  value={jour}
                  onChange={(event) => {
                    setJour(event.target.value);
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rendez-vous-nouvelle-heure">Heure (facultatif)</Label>
                <Input
                  id="rendez-vous-nouvelle-heure"
                  type="time"
                  disabled={jour === ''}
                  value={heure}
                  onChange={(event) => {
                    setHeure(event.target.value);
                  }}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rendez-vous-report-commentaire">Commentaire (facultatif)</Label>
              <Textarea
                id="rendez-vous-report-commentaire"
                value={commentaire}
                maxLength={1000}
                rows={3}
                onChange={(event) => {
                  setCommentaire(event.target.value);
                }}
              />
            </div>
          </>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              onValider(suiviDu(reponse, jour, heure, commentaire));
            }}
          >
            {confirmation ? 'Enregistrer' : 'Reporter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
