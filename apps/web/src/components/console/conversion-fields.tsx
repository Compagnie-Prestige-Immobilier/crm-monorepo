'use client';

import { useQuery } from '@tanstack/react-query';

import { Field } from '@/components/forms/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchBanques, fetchSyndicats } from '@/lib/data/reference';
import type { ConversionDraft, ConversionErrors } from '@/lib/data/console';
import { formatPhone, withRetired } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { ENROLLMENT_METHOD_LABELS, type EnrollmentMethod } from '@/lib/types';
import { cn } from '@/lib/utils';

const REFERENCE_STALE_TIME = 300_000;

/** La prise de rendez-vous en tête : c'est l'issue que la campagne cherche. */
const METHOD_ORDER: readonly EnrollmentMethod[] = [
  'APPOINTMENT',
  'VOICE_OR_ELECTRONIC_MESSAGING',
  'PLATFORM',
  'PHYSICAL',
];

/**
 * Trois réponses, pas deux : « non demandé » est l'état d'une question que
 * l'appel n'a pas eu le temps d'atteindre, et le confondre avec « non »
 * inventerait une déclaration que le prospect n'a jamais faite.
 */
const TRI_STATE: readonly { readonly label: string; readonly value: boolean | null }[] = [
  { label: 'Oui', value: true },
  { label: 'Non', value: false },
  { label: 'Non demandé', value: null },
];

export function ConversionFields({
  draft,
  errors,
  phoneE164,
  disabled,
  onChange,
}: {
  draft: ConversionDraft;
  errors: ConversionErrors;
  phoneE164: string;
  disabled: boolean;
  onChange: (patch: Partial<ConversionDraft>) => void;
}) {
  const banques = useQuery({
    queryKey: queryKeys.banques,
    queryFn: () => fetchBanques(),
    staleTime: REFERENCE_STALE_TIME,
  });
  const syndicats = useQuery({
    queryKey: queryKeys.syndicats,
    queryFn: () => fetchSyndicats(),
    staleTime: REFERENCE_STALE_TIME,
  });

  const banqueItems = (banques.data ?? []).map((banque) => ({
    value: banque.id,
    label: withRetired(banque.shortName, banque.isActive),
  }));
  const syndicatItems = (syndicats.data ?? []).map((syndicat) => ({
    value: syndicat.id,
    label: withRetired(syndicat.sigle, syndicat.isActive),
  }));

  return (
    <fieldset className="grid gap-4 sm:grid-cols-2" disabled={disabled}>
      <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
        Phase 3 · Conversion
      </legend>

      <Field label="Nom" required error={errors.nom}>
        {(props) => (
          <Input
            {...props}
            value={draft.nom}
            onChange={(event) => {
              onChange({ nom: event.target.value });
            }}
          />
        )}
      </Field>

      <Field label="Prénom" error={errors.prenom}>
        {(props) => (
          <Input
            {...props}
            value={draft.prenom}
            onChange={(event) => {
              onChange({ prenom: event.target.value });
            }}
          />
        )}
      </Field>

      <Field label="Téléphone" description="Le numéro ne se corrige pas depuis un appel.">
        {(props) => <Input {...props} readOnly value={formatPhone(phoneE164)} />}
      </Field>

      <Field label="E-mail" error={errors.email}>
        {(props) => (
          <Input
            {...props}
            type="email"
            autoComplete="off"
            value={draft.email}
            onChange={(event) => {
              onChange({ email: event.target.value });
            }}
          />
        )}
      </Field>

      <Field label="Profession" error={errors.profession}>
        {(props) => (
          <Input
            {...props}
            value={draft.profession}
            onChange={(event) => {
              onChange({ profession: event.target.value });
            }}
          />
        )}
      </Field>

      <Field
        label="Durée dans l’établissement (mois)"
        error={errors.dureeEtablissementMois}
        description="Ancienneté au poste, pas la durée du système de paiement."
      >
        {(props) => (
          <Input
            {...props}
            type="number"
            inputMode="numeric"
            min={0}
            max={600}
            step={1}
            value={draft.dureeEtablissementMois}
            onChange={(event) => {
              onChange({ dureeEtablissementMois: event.target.value });
            }}
          />
        )}
      </Field>

      <TriStateField
        label="Fonctionnaire"
        name="console-fonctionnaire"
        value={draft.fonctionnaire}
        onChange={(fonctionnaire) => {
          onChange({ fonctionnaire });
        }}
      />

      <Field label="Syndicat" error={errors.syndicatId}>
        {(props) => (
          <Select
            items={syndicatItems}
            value={draft.syndicatId}
            onValueChange={(value) => {
              if (value === null) return;
              onChange({ syndicatId: value });
            }}
          >
            <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']}>
              <SelectValue placeholder="Choisir un syndicat" />
            </SelectTrigger>
            <SelectContent>
              {syndicatItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

      <Field label="Banque" error={errors.banqueId}>
        {(props) => (
          <Select
            items={banqueItems}
            value={draft.banqueId}
            onValueChange={(value) => {
              if (value === null) return;
              onChange({ banqueId: value });
            }}
          >
            <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']}>
              <SelectValue placeholder="Choisir une banque" />
            </SelectTrigger>
            <SelectContent>
              {banqueItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

      <TriStateField
        label="Engagement en cours à la banque"
        name="console-engagement"
        value={draft.engagementEnCours}
        onChange={(engagementEnCours) => {
          onChange({ engagementEnCours });
        }}
      />

      <fieldset className="flex min-w-0 flex-col gap-2 sm:col-span-2">
        <legend className="pb-1.5 text-[0.8125rem] font-[600] text-foreground">
          Méthode d’enrôlement
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {METHOD_ORDER.map((method) => (
            <MethodChoice
              key={method}
              method={method}
              checked={draft.method === method}
              onSelect={() => {
                // Changer de méthode efface la date : le serveur refuse un
                // rendez-vous sur toute autre méthode que la prise de rendez-vous.
                onChange({
                  method,
                  ...(method === 'APPOINTMENT' ? {} : { rendezVousAt: '' }),
                });
              }}
            />
          ))}
        </div>
      </fieldset>

      {draft.method === 'APPOINTMENT' ? (
        <Field
          label="Date du rendez-vous"
          required
          error={errors.rendezVousAt}
          description="Heure de Dakar (UTC+0), quel que soit le fuseau de ce poste."
        >
          {(props) => (
            <Input
              {...props}
              type="datetime-local"
              className="max-w-64"
              value={draft.rendezVousAt}
              onChange={(event) => {
                onChange({ rendezVousAt: event.target.value });
              }}
            />
          )}
        </Field>
      ) : null}
    </fieldset>
  );
}

function MethodChoice({
  method,
  checked,
  onSelect,
}: {
  method: EnrollmentMethod;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-3 rounded-md border p-3 text-[0.875rem]',
        'transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
        checked
          ? 'border-primary bg-secondary text-secondary-foreground'
          : 'border-border hover:bg-secondary/60',
      )}
    >
      <input
        type="radio"
        name="console-method"
        value={method}
        checked={checked}
        className="size-4 accent-[var(--primary)]"
        onChange={onSelect}
      />
      <span className="min-w-0">{ENROLLMENT_METHOD_LABELS[method]}</span>
    </label>
  );
}

function TriStateField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="pb-1.5 text-[0.8125rem] font-[600] text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {TRI_STATE.map((choice) => (
          <label
            key={choice.label}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-[0.875rem]',
              'transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
              value === choice.value
                ? 'border-primary bg-secondary text-secondary-foreground'
                : 'border-border hover:bg-secondary/60',
            )}
          >
            <input
              type="radio"
              name={name}
              checked={value === choice.value}
              className="size-4 accent-[var(--primary)]"
              onChange={() => {
                onChange(choice.value);
              }}
            />
            {choice.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
