'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { ChoixOuAutre } from '@/components/accueil/choix-ou-autre';
import { ETAPES, type Question } from '@/components/accueil/closing-questions';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  CLE_RENDEZ_VOUS,
  type Closing,
  enregistrerClosing,
  lireClosing,
  type RendezVousObtenu,
} from '@/lib/data/rendez-vous';
import { toastApiError } from '@/lib/mutation-feedback';

function Saisie({
  question,
  value,
  sites,
  autre,
  onChange,
}: {
  question: Question;
  value: string;
  sites: string[];
  autre: boolean;
  onChange: (value: string) => void;
}) {
  const id = `closing-${question.champ}`;
  if (question.choix !== undefined) {
    const options = question.choix === 'sites' ? sites : question.choix;
    return (
      <ChoixOuAutre
        label={question.label}
        options={options}
        autre={autre}
        value={value}
        onChange={onChange}
      />
    );
  }
  return (
    <div className={question.long === true ? 'grid gap-1.5 sm:col-span-2' : 'grid gap-1.5'}>
      <Label htmlFor={id}>{question.label}</Label>
      {question.long === true ? (
        <Textarea
          id={id}
          rows={3}
          maxLength={4000}
          placeholder="Ce qui s’est dit, ce qui a été promis."
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      ) : (
        <Input
          id={id}
          className="h-9"
          type={question.champ === 'dateRelance' ? 'date' : 'text'}
          maxLength={120}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      )}
    </div>
  );
}

function Formulaire({
  rendezVous,
  lu: { closing: depart, sites },
  onClose,
}: {
  rendezVous: RendezVousObtenu;
  lu: { closing: Closing; sites: string[] };
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [closing, setClosing] = useState(depart);
  const [etape, setEtape] = useState(0);
  const enregistrer = useMutation({
    mutationFn: () => enregistrerClosing(rendezVous.id, closing),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: CLE_RENDEZ_VOUS });
      toast.success('Closing enregistré.');
      onClose();
    },
    onError: (error) => toastApiError(error, 'Le closing n’a pas été enregistré.'),
  });
  const courante = ETAPES[etape] ?? ETAPES[0];
  const derniere = etape === ETAPES.length - 1;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        enregistrer.mutate();
      }}
    >
      <ol className="flex gap-1" aria-label="Étapes du closing">
        {ETAPES.map((item, rang) => (
          <li key={item.titre} className="flex-1">
            <button
              type="button"
              aria-current={rang === etape ? 'step' : undefined}
              onClick={() => {
                setEtape(rang);
              }}
              className={`w-full border-b-2 py-2 text-[0.8125rem] font-[600] ${rang === etape ? 'border-primary text-foreground' : 'border-border text-muted-foreground'}`}
            >
              {rang + 1}. {item.titre}
            </button>
          </li>
        ))}
      </ol>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {courante?.questions.map((question) => (
          <Saisie
            key={question.champ}
            question={question}
            value={closing[question.champ]}
            sites={sites}
            autre={etape === 0}
            onChange={(valeur) => {
              setClosing((avant) => ({ ...avant, [question.champ]: valeur }));
            }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <Button
          type="submit"
          variant={derniere ? 'default' : 'outline'}
          disabled={enregistrer.isPending}
        >
          Enregistrer et fermer
        </Button>
        {derniere ? null : (
          <Button
            type="button"
            onClick={() => {
              setEtape(etape + 1);
            }}
          >
            Suivant
          </Button>
        )}
      </div>
    </form>
  );
}

export function ClosingDialog({
  rendezVous,
  onClose,
}: {
  rendezVous: RendezVousObtenu | null;
  onClose: () => void;
}) {
  const lecture = useQuery({
    queryKey: [...CLE_RENDEZ_VOUS, 'closing', rendezVous?.id],
    queryFn: () => lireClosing(rendezVous?.id ?? ''),
    enabled: rendezVous !== null,
  });
  if (rendezVous === null) return null;
  return (
    <Dialog
      open
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] gap-3 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Closing de {rendezVous.prenom} {rendezVous.nom}
          </DialogTitle>
        </DialogHeader>
        {lecture.isError ? (
          <QueryErrorState error={lecture.error} onRetry={() => void lecture.refetch()} />
        ) : null}
        {lecture.isPending ? <Skeleton className="h-64 rounded-lg" /> : null}
        {lecture.data === undefined ? null : (
          <Formulaire rendezVous={rendezVous} lu={lecture.data} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
