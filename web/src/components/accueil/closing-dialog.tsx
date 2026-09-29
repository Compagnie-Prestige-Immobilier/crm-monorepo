'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { ChoixOuAutre } from '@/components/accueil/choix-ou-autre';
import { etapesDe, type Question } from '@/components/accueil/closing-questions';
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

type Listes = { sites: string[]; chargesDeClientele: string[]; pointsRencontre: string[] };

function Cases({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: readonly string[];
  onChange: (value: string[]) => void;
}) {
  const coches = value.filter((choix) => options.includes(choix));
  const precision = value.find((choix) => !options.includes(choix)) ?? '';
  const [autre, setAutre] = useState(precision !== '');
  return (
    <fieldset className="grid gap-2 sm:col-span-2">
      <legend className="mb-1.5 text-[0.9375rem] font-[600]">{label}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {[...options, 'Autre, à préciser'].map((option) => {
          const estAutre = !options.includes(option);
          return (
            <label key={option} className="flex min-h-9 items-center gap-2 text-[0.875rem]">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={estAutre ? autre : coches.includes(option)}
                onChange={(event) => {
                  const coche = event.target.checked;
                  if (estAutre) {
                    setAutre(coche);
                    if (!coche) onChange(coches);
                  } else {
                    const suite = coche ? [...coches, option] : coches.filter((c) => c !== option);
                    onChange(precision === '' ? suite : [...suite, precision]);
                  }
                }}
              />
              {option}
            </label>
          );
        })}
      </div>
      {autre ? (
        <Input
          className="h-9"
          aria-label={`${label}, précision`}
          value={precision}
          maxLength={120}
          onChange={(event) => {
            const texte = event.target.value;
            onChange(texte === '' ? coches : [...coches, texte]);
          }}
        />
      ) : null}
    </fieldset>
  );
}

function Saisie({
  question,
  value,
  listes,
  onChange,
}: {
  question: Question;
  value: string | string[];
  listes: Listes;
  onChange: (value: string | string[]) => void;
}) {
  const id = `closing-${question.champ}`;
  const options = typeof question.choix === 'string' ? listes[question.choix] : question.choix;
  if (Array.isArray(value)) {
    return (
      <Cases label={question.label} options={options ?? []} value={value} onChange={onChange} />
    );
  }
  if (options !== undefined) {
    return (
      <ChoixOuAutre
        label={question.label}
        options={options}
        autre={question.autre === true}
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
          type={question.type ?? 'text'}
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

/** Un RV site reprend ce que la console a noté ; le closing le confirme ou le corrige. */
function avecLaVisite(closing: Closing, rendezVous: RendezVousObtenu): Closing {
  if (rendezVous.typeCode !== 'RV_SITE') return closing;
  return {
    ...closing,
    dateVisite: closing.dateVisite || (rendezVous.quand ?? '').slice(0, 10),
    heureVisite: closing.heureVisite || (rendezVous.quand ?? '').slice(11, 16),
    pointRencontre: closing.pointRencontre || rendezVous.pointRencontre,
    siteInteresse: closing.siteInteresse || rendezVous.site,
  };
}

function Formulaire({
  rendezVous,
  lu,
  onClose,
}: {
  rendezVous: RendezVousObtenu;
  lu: Listes & { closing: Closing };
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [closing, setClosing] = useState(() => avecLaVisite(lu.closing, rendezVous));
  const [etape, setEtape] = useState(0);
  const etapes = etapesDe(rendezVous.typeCode);
  const enregistrer = useMutation({
    mutationFn: () => enregistrerClosing(rendezVous.id, closing),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: CLE_RENDEZ_VOUS });
      toast.success('Closing enregistré.');
      onClose();
    },
    onError: (error) => toastApiError(error, 'Le closing n’a pas été enregistré.'),
  });
  const courante = etapes[etape] ?? etapes[0];
  const derniere = etape === etapes.length - 1;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        enregistrer.mutate();
      }}
    >
      <ol className="flex gap-1" aria-label="Étapes du closing">
        {etapes.map((item, rang) => (
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
        {courante?.questions
          .filter((question) => question.si?.(closing) ?? true)
          .map((question) => (
            <Saisie
              key={question.champ}
              question={question}
              value={closing[question.champ]}
              listes={lu}
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
