'use client';

import { useMutation } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { DatePicker } from '@/components/filters/date-picker';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  VISITE_COLONNES,
  createVisite,
  dakarNow,
  updateVisite,
  visiteCorrection,
  type CreateVisiteInput,
  type Visite,
  type VisiteRef,
  type VisiteReferentielItem,
  type VisiteReferentiels,
} from '@/lib/data/visites';
import { formatDate, withRetired } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import type { FilterOption } from '@/lib/types';

type Errors = Partial<Record<'visitorName' | 'entrepriseId' | 'objetId', string>>;

// L'API ne sert que les entrées encore proposées : sans `courant`, le champ
// s'afficherait vide sur une ligne dont l'entrée a été retirée depuis.
function options(
  items: readonly VisiteReferentielItem[] | undefined,
  courant: VisiteRef | null = null,
): FilterOption[] {
  const list = (items ?? []).map((item) => ({
    value: item.id,
    label: withRetired(item.label, item.isActive),
  }));
  if (courant !== null && !list.some((option) => option.value === courant.id)) {
    list.unshift({ value: courant.id, label: withRetired(courant.label, false) });
  }
  return list;
}

function ChoiceError({ message }: { message: string | undefined }): ReactNode {
  if (message === undefined) return null;
  return (
    <p role="alert" className="text-[0.8125rem] text-destructive">
      {message}
    </p>
  );
}

export function VisiteForm({
  referentiels,
  visite = null,
  onSaved,
  onCancel,
}: {
  referentiels: VisiteReferentiels | undefined;
  visite?: Visite | null;
  onSaved: (visite: Visite) => void;
  onCancel?: (() => void) | undefined;
}) {
  const dateId = useId();
  const nomRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState<string | null>(visite?.date ?? dakarNow().date);
  // Une ligne dont l'heure n'a pas ete relevee ne doit pas repartir estampillee
  // de l'heure de la correction.
  const [time, setTime] = useState(visite === null ? dakarNow().time : (visite.time ?? ''));
  const [visitorName, setVisitorName] = useState(visite?.visitorName ?? '');
  const [phone, setPhone] = useState(visite?.phone ?? '');
  const [entrepriseId, setEntrepriseId] = useState<string | null>(visite?.entreprise.id ?? null);
  const [directionId, setDirectionId] = useState<string | null>(visite?.direction?.id ?? null);
  const [destinataireId, setDestinataireId] = useState<string | null>(
    visite?.destinataire?.id ?? null,
  );
  const [objetId, setObjetId] = useState<string | null>(visite?.objet.id ?? null);
  const [comment, setComment] = useState(visite?.comment ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const correction = visite !== null;

  const save = useMutation({
    mutationFn: (input: CreateVisiteInput) =>
      correction ? updateVisite(visite.id, visiteCorrection(visite, input)) : createVisite(input),
    onSuccess: (saved) => {
      onSaved(saved);

      if (correction) {
        toast.success(`Visite ${saved.reference} corrigée.`);
        return;
      }

      // La file d'attente : l'ENTREPRISE reste, tout le reste repart de zéro.
      toast.success(`Visite ${saved.reference} enregistrée.`);
      const now = dakarNow();
      setDate(now.date);
      setTime(now.time);
      setVisitorName('');
      setPhone('');
      setDirectionId(null);
      setDestinataireId(null);
      setObjetId(null);
      setComment('');
      setErrors({});
      nomRef.current?.focus();
    },
    onError: (error) => {
      toastApiError(error, 'La visite n’a pas pu être enregistrée.');
    },
  });

  function submit(): void {
    if (save.isPending) return;

    const found: Errors = {};
    if (visitorName.trim() === '') found.visitorName = 'À renseigner.';
    if (entrepriseId === null) found.entrepriseId = 'À choisir dans la liste.';
    if (objetId === null) found.objetId = 'À choisir dans la liste.';

    setErrors(found);
    if (entrepriseId === null || objetId === null || date === null) return;
    if (Object.keys(found).length > 0) return;

    const input: CreateVisiteInput = {
      date,
      visitorName: visitorName.trim(),
      entrepriseId,
      objetId,
    };
    if (time !== '') input.time = time;
    if (phone.trim() !== '') input.phone = phone.trim();
    if (directionId !== null) input.directionId = directionId;
    if (destinataireId !== null) input.destinataireId = destinataireId;
    if (comment.trim() !== '') input.comment = comment.trim();

    save.mutate(input);
  }

  return (
    <form
      aria-label={correction ? 'Corriger la visite' : 'Enregistrer une visite'}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {correction ? (
          // L'API refuse de déplacer une ligne d'un jour à l'autre : la date
          // fixe la ligne dans le registre. On la montre, on ne la propose pas.
          <div className="flex flex-col gap-1.5">
            <Label>{VISITE_COLONNES.date}</Label>
            <p className="py-2 text-[0.9375rem] font-[600]">
              {date === null ? '' : formatDate(date)}
            </p>
          </div>
        ) : (
          <DatePicker id={dateId} label={VISITE_COLONNES.date} value={date} onChange={setDate} />
        )}

        <Field label={VISITE_COLONNES.time}>
          {(props) => (
            <Input
              {...props}
              type="time"
              value={time}
              onChange={(event) => {
                setTime(event.target.value);
              }}
            />
          )}
        </Field>

        <Field label={VISITE_COLONNES.visitorName} required error={errors.visitorName}>
          {(props) => (
            <Input
              {...props}
              ref={nomRef}
              autoFocus={!correction}
              autoComplete="off"
              value={visitorName}
              onChange={(event) => {
                setVisitorName(event.target.value);
              }}
            />
          )}
        </Field>

        <Field label={VISITE_COLONNES.phone}>
          {(props) => (
            <Input
              {...props}
              type="tel"
              autoComplete="off"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
              }}
            />
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <FilterCombobox
            label={VISITE_COLONNES.entreprise}
            placeholder="Choisir"
            options={options(referentiels?.entreprises, visite?.entreprise ?? null)}
            value={entrepriseId}
            onChange={setEntrepriseId}
            required
          />
          <ChoiceError message={errors.entrepriseId} />
        </div>

        <FilterCombobox
          label={VISITE_COLONNES.direction}
          placeholder="Choisir"
          options={options(referentiels?.directions, visite?.direction ?? null)}
          value={directionId}
          onChange={setDirectionId}
        />

        <FilterCombobox
          label={VISITE_COLONNES.destinataire}
          placeholder="Choisir"
          options={options(referentiels?.destinataires, visite?.destinataire ?? null)}
          value={destinataireId}
          onChange={setDestinataireId}
        />

        <div className="flex flex-col gap-1.5">
          <FilterCombobox
            label={VISITE_COLONNES.objet}
            placeholder="Choisir"
            options={options(referentiels?.objets, visite?.objet ?? null)}
            value={objetId}
            onChange={setObjetId}
            required
          />
          <ChoiceError message={errors.objetId} />
        </div>
      </div>

      <Field label={VISITE_COLONNES.comment}>
        {(props) => (
          <Textarea
            {...props}
            rows={2}
            value={comment}
            onChange={(event) => {
              setComment(event.target.value);
            }}
          />
        )}
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={save.isPending}>
          {save.isPending ? <LoaderIcon className="animate-spin" aria-hidden="true" /> : null}
          {correction ? 'Enregistrer la correction' : 'Enregistrer la visite'}
        </Button>
        {onCancel === undefined ? null : (
          <Button type="button" size="lg" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}
