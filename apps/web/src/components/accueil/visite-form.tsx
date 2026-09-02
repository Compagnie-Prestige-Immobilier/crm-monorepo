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

type Errors = Partial<
  Record<'visitorName' | 'phone' | 'comment' | 'entrepriseId' | 'objetId' | 'date', string>
>;

/** Bornes de `CreateVisiteDto` : dépassées, l'API rend un 400 qui ne nomme aucun champ. */
const NOM_MIN = 2;
const NOM_MAX = 160;
const TELEPHONE_MAX = 40;
const COMMENTAIRE_MAX = 2000;

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

function validateNom(value: string): string | undefined {
  const nom = value.trim();
  if (nom === '') return 'À renseigner.';
  if (nom.length < NOM_MIN) return 'Au moins deux caractères.';
  if (nom.length > NOM_MAX) return `${String(NOM_MAX)} caractères au maximum.`;
  return undefined;
}

function validatePhone(value: string): string | undefined {
  if (value.trim().length > TELEPHONE_MAX) return `${String(TELEPHONE_MAX)} caractères au maximum.`;
  return undefined;
}

function validateComment(value: string): string | undefined {
  if (value.trim().length > COMMENTAIRE_MAX) {
    return `${String(COMMENTAIRE_MAX)} caractères au maximum.`;
  }
  return undefined;
}

/** `exactOptionalPropertyTypes` refuse `{ key: undefined }` : la clé doit disparaître, pas valoir vide. */
function withFieldError(prev: Errors, key: keyof Errors, message: string | undefined): Errors {
  if (message === undefined) {
    const entries = Object.entries(prev).filter(([field]) => field !== key);
    return Object.fromEntries(entries);
  }
  return { ...prev, [key]: message };
}

function ChoiceError({ message }: { message: string | undefined }): ReactNode {
  if (message === undefined) return null;
  return (
    <p role="alert" className="text-[0.8125rem] text-destructive">
      {message}
    </p>
  );
}

function valeursInitiales(visite: Visite | null) {
  const maintenant = dakarNow();
  if (visite === null) {
    return {
      date: maintenant.date as string | null,
      time: maintenant.time,
      visitorName: '',
      phone: '',
      entrepriseId: null as string | null,
      directionId: null as string | null,
      destinataireId: null as string | null,
      objetId: null as string | null,
      comment: '',
    };
  }

  return {
    date: visite.date as string | null,
    // Une ligne dont l'heure n'a pas ete relevee ne doit pas repartir
    // estampillee de l'heure de la correction.
    time: visite.time ?? '',
    visitorName: visite.visitorName,
    phone: visite.phone ?? '',
    entrepriseId: visite.entreprise.id as string | null,
    directionId: visite.direction?.id ?? null,
    destinataireId: visite.destinataire?.id ?? null,
    objetId: visite.objet.id as string | null,
    comment: visite.comment ?? '',
  };
}

/** L'API refuse de déplacer une ligne d'un jour à l'autre : en correction, la date se montre. */
function ChampDate({
  correction,
  dateId,
  date,
  erreur,
  onChange,
}: {
  correction: boolean;
  dateId: string;
  date: string | null;
  erreur: string | undefined;
  onChange: (value: string | null) => void;
}) {
  if (correction) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{VISITE_COLONNES.date}</Label>
        <p className="py-2 text-[0.9375rem] font-[600]">{date === null ? '' : formatDate(date)}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <DatePicker id={dateId} label={VISITE_COLONNES.date} value={date} onChange={onChange} />
      {erreur === undefined ? null : (
        <p role="alert" className="text-[0.75rem] text-[var(--destructive)]">
          {erreur}
        </p>
      )}
    </div>
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

  const depart = valeursInitiales(visite);
  const [date, setDate] = useState<string | null>(depart.date);
  const [time, setTime] = useState(depart.time);
  const [visitorName, setVisitorName] = useState(depart.visitorName);
  const [phone, setPhone] = useState(depart.phone);
  const [entrepriseId, setEntrepriseId] = useState<string | null>(depart.entrepriseId);
  const [directionId, setDirectionId] = useState<string | null>(depart.directionId);
  const [destinataireId, setDestinataireId] = useState<string | null>(depart.destinataireId);
  const [objetId, setObjetId] = useState<string | null>(depart.objetId);
  const [comment, setComment] = useState(depart.comment);
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
    const nomErreur = validateNom(visitorName);
    if (nomErreur !== undefined) found.visitorName = nomErreur;
    const phoneErreur = validatePhone(phone);
    if (phoneErreur !== undefined) found.phone = phoneErreur;
    const commentErreur = validateComment(comment);
    if (commentErreur !== undefined) found.comment = commentErreur;
    if (entrepriseId === null) found.entrepriseId = 'À choisir dans la liste.';
    if (objetId === null) found.objetId = 'À choisir dans la liste.';
    // La date effacée par la croix du sélecteur ne remplissait AUCUNE entrée :
    // le bouton ne faisait rien, sans message, pendant que le visiteur attend.
    if (date === null) found.date = 'À renseigner.';

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
      {/* Deux colonnes au maximum : le dialogue est plafonné à `max-w-4xl`, et
          `xl:grid-cols-4` se déclenche sur la largeur de l'écran, pas celle du
          dialogue — quatre colonnes y tronquaient chaque valeur choisie. */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChampDate
          correction={correction}
          dateId={dateId}
          date={date}
          erreur={errors.date}
          onChange={setDate}
        />

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
              maxLength={NOM_MAX}
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- saisie au comptoir, champ premier
              autoFocus={!correction}
              autoComplete="off"
              value={visitorName}
              onChange={(event) => {
                setVisitorName(event.target.value);
              }}
              onBlur={() => {
                setErrors((prev) => withFieldError(prev, 'visitorName', validateNom(visitorName)));
              }}
            />
          )}
        </Field>

        <Field label={VISITE_COLONNES.phone} error={errors.phone}>
          {(props) => (
            <Input
              {...props}
              maxLength={TELEPHONE_MAX}
              type="tel"
              autoComplete="off"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
              }}
              onBlur={() => {
                setErrors((prev) => withFieldError(prev, 'phone', validatePhone(phone)));
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
            onBlur={() => {
              setErrors((prev) =>
                withFieldError(
                  prev,
                  'entrepriseId',
                  entrepriseId === null ? 'À choisir dans la liste.' : undefined,
                ),
              );
            }}
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
            onBlur={() => {
              setErrors((prev) =>
                withFieldError(
                  prev,
                  'objetId',
                  objetId === null ? 'À choisir dans la liste.' : undefined,
                ),
              );
            }}
            required
          />
          <ChoiceError message={errors.objetId} />
        </div>
      </div>

      <Field
        label={VISITE_COLONNES.comment}
        description={`${String(comment.length)} / ${String(COMMENTAIRE_MAX)} caractères`}
        error={errors.comment}
      >
        {(props) => (
          <Textarea
            {...props}
            maxLength={COMMENTAIRE_MAX}
            rows={2}
            value={comment}
            onChange={(event) => {
              setComment(event.target.value);
            }}
            onBlur={() => {
              setErrors((prev) => withFieldError(prev, 'comment', validateComment(comment)));
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
