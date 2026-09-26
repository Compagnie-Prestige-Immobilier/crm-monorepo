'use client';

import { useMutation } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { toast } from 'sonner';

import { DatePicker } from '@/components/filters/date-picker';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Record<'visitorName' | 'phone' | 'comment' | 'entrepriseId' | 'objetId' | 'date' | 'time', string>
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

// Saisie libre plutôt que `type="time"`, qui s'affiche en 12 h selon la langue du navigateur.
function heureSaisie(value: string): string | null {
  const trouve = /^([01]?\d|2[0-3])\s*[:hH]?\s*([0-5]\d)$/.exec(value.trim());
  if (trouve === null) return null;
  return `${(trouve[1] ?? '').padStart(2, '0')}:${trouve[2] ?? ''}`;
}

function validateTime(value: string): string | undefined {
  if (value.trim() === '' || heureSaisie(value) !== null) return undefined;
  return 'Heure sur 24 h, par exemple 14:30.';
}

function validateComment(value: string): string | undefined {
  if (value.trim().length > COMMENTAIRE_MAX) {
    return `${String(COMMENTAIRE_MAX)} caractères au maximum.`;
  }
  return undefined;
}

function validerVisiteForm({
  visitorName,
  phone,
  comment,
  entrepriseId,
  objetId,
  date,
  time,
}: {
  visitorName: string;
  phone: string;
  comment: string;
  entrepriseId: string | null;
  objetId: string | null;
  date: string | null;
  time: string;
}): Errors {
  const found: Errors = {};
  const timeErreur = validateTime(time);
  if (timeErreur !== undefined) found.time = timeErreur;
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
  return found;
}

function construireVisiteInput({
  date,
  visitorName,
  entrepriseId,
  objetId,
  time,
  phone,
  directionId,
  destinataireId,
  comment,
}: {
  date: string;
  visitorName: string;
  entrepriseId: string;
  objetId: string;
  time: string;
  phone: string;
  directionId: string | null;
  destinataireId: string | null;
  comment: string;
}): CreateVisiteInput {
  const input: CreateVisiteInput = {
    date,
    visitorName: visitorName.trim(),
    entrepriseId,
    objetId,
  };
  const heure = heureSaisie(time);
  if (heure !== null) input.time = heure;
  if (phone.trim() !== '') input.phone = phone.trim();
  if (directionId !== null) input.directionId = directionId;
  if (destinataireId !== null) input.destinataireId = destinataireId;
  if (comment.trim() !== '') input.comment = comment.trim();
  return input;
}

/** `exactOptionalPropertyTypes` refuse `{ key: undefined }` : la clé doit disparaître, pas valoir vide. */
function withFieldError(prev: Errors, key: keyof Errors, message: string | undefined): Errors {
  if (message === undefined) {
    const entries = Object.entries(prev).filter(([field]) => field !== key);
    return Object.fromEntries(entries);
  }
  return { ...prev, [key]: message };
}

type CourantsVisite = {
  entreprise: VisiteRef | null;
  direction: VisiteRef | null;
  destinataire: VisiteRef | null;
  objet: VisiteRef | null;
};

// Regroupé pour n'exposer aucun `?.` au corps de VisiteForm : sans visite en
// correction, chaque champ référentiel repart simplement à vide.
function courantsDe(visite: Visite | null): CourantsVisite {
  if (visite === null) {
    return { entreprise: null, direction: null, destinataire: null, objet: null };
  }
  return {
    entreprise: visite.entreprise,
    direction: visite.direction ?? null,
    destinataire: visite.destinataire ?? null,
    objet: visite.objet,
  };
}

function optionsChamp<K extends keyof VisiteReferentiels>(
  referentiels: VisiteReferentiels | undefined,
  key: K,
  courant: VisiteRef | null,
): FilterOption[] {
  return options(referentiels?.[key], courant);
}

function ChoiceError({ message }: { message: string | undefined }): ReactNode {
  if (message === undefined) return null;
  return (
    <p role="alert" className="text-[0.8125rem] text-destructive">
      {message}
    </p>
  );
}

export interface VisitePreremplie {
  visitorName: string;
  phone: string;
  comment: string;
}

function valeursInitiales(visite: Visite | null, preremplie: VisitePreremplie | null) {
  const maintenant = dakarNow();
  if (visite === null) {
    const saisie = preremplie ?? { visitorName: '', phone: '', comment: '' };
    return {
      date: maintenant.date as string | null,
      time: maintenant.time,
      visitorName: saisie.visitorName,
      phone: saisie.phone,
      entrepriseId: null as string | null,
      directionId: null as string | null,
      destinataireId: null as string | null,
      objetId: null as string | null,
      comment: saisie.comment,
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
        <p className="text-[0.9375rem] font-[600] leading-none">{VISITE_COLONNES.date}</p>
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
  preremplie = null,
  nomRef: nomRefDuDialogue,
  onSaved,
  onCancel,
}: {
  referentiels: VisiteReferentiels | undefined;
  visite?: Visite | null;
  preremplie?: VisitePreremplie | null;
  nomRef?: RefObject<HTMLInputElement | null> | undefined;
  onSaved: (visite: Visite) => void;
  onCancel?: (() => void) | undefined;
}) {
  const dateId = useId();
  const nomRefLocal = useRef<HTMLInputElement>(null);
  const nomRef = nomRefDuDialogue ?? nomRefLocal;

  const depart = valeursInitiales(visite, preremplie);
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
  const courants = courantsDe(visite);

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

    const found = validerVisiteForm({
      visitorName,
      phone,
      comment,
      entrepriseId,
      objetId,
      date,
      time,
    });
    setErrors(found);
    if (entrepriseId === null || objetId === null || date === null) return;
    if (Object.keys(found).length > 0) return;

    save.mutate(
      construireVisiteInput({
        date,
        visitorName,
        entrepriseId,
        objetId,
        time,
        phone,
        directionId,
        destinataireId,
        comment,
      }),
    );
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
          dialogue, quatre colonnes y tronquaient chaque valeur choisie. */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChampDate
          correction={correction}
          dateId={dateId}
          date={date}
          erreur={errors.date}
          onChange={setDate}
        />

        <Field label={VISITE_COLONNES.time} error={errors.time}>
          {(props) => (
            <Input
              {...props}
              inputMode="numeric"
              autoComplete="off"
              placeholder="ex. 14:30"
              maxLength={7}
              value={time}
              onChange={(event) => {
                setTime(event.target.value);
              }}
              onBlur={() => {
                setErrors((prev) => withFieldError(prev, 'time', validateTime(time)));
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
            options={optionsChamp(referentiels, 'entreprises', courants.entreprise)}
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
          options={optionsChamp(referentiels, 'directions', courants.direction)}
          value={directionId}
          onChange={setDirectionId}
        />

        <FilterCombobox
          label={VISITE_COLONNES.destinataire}
          placeholder="Choisir"
          options={optionsChamp(referentiels, 'destinataires', courants.destinataire)}
          value={destinataireId}
          onChange={setDestinataireId}
        />

        <div className="flex flex-col gap-1.5">
          <FilterCombobox
            label={VISITE_COLONNES.objet}
            placeholder="Choisir"
            options={optionsChamp(referentiels, 'objets', courants.objet)}
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
