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
import type { ConversionDraft, ConversionErrors } from '@/lib/data/console';
import {
  DUREES_MOIS,
  formatDureeMois,
  PROSPECT_TYPE_LABELS,
  PROSPECT_TYPES,
} from '@/lib/data/grand-public';
import { fetchBanques, fetchIncomeBands, fetchSyndicats } from '@/lib/data/reference';
import { formatPhone, withRetired } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import {
  ENROLLMENT_METHOD_LABELS,
  type EnrollmentMethod,
  type PaymentMode,
  type ProspectType,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const REFERENCE_STALE_TIME = 300_000;

/** La prise de rendez-vous en tête : c'est l'issue que l'appel cherche. */
const METHOD_ORDER: readonly EnrollmentMethod[] = [
  'APPOINTMENT',
  'VOICE_OR_ELECTRONIC_MESSAGING',
  'PLATFORM',
  'PHYSICAL',
];

const PAIEMENTS: readonly { value: PaymentMode; label: string }[] = [
  { value: 'COMPTANT', label: 'Comptant' },
  { value: 'ECHELONNE', label: 'Échelonné' },
];

const DUREES = DUREES_MOIS.map((mois) => ({ value: String(mois), label: formatDureeMois(mois) }));

/**
 * Sur CHUES le prospect est enseignant : ni situation ni mode de paiement, et
 * l'adhésion exige le dossier complet. Le Grand Public garde ces deux champs,
 * facultatifs, et « non demandé » pour les questions qu'on n'a pas posées.
 */
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
  const complet = draft.projet === 'CHUES';

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
  const tranches = useQuery({
    queryKey: queryKeys.incomeBands,
    queryFn: () => fetchIncomeBands(),
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
  const trancheItems = (tranches.data ?? []).map((tranche) => ({
    value: tranche.id,
    label: withRetired(tranche.label, tranche.isActive),
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

      <Field label="Prénom" required={complet} error={errors.prenom}>
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

      <Field label="Profession" required={complet} error={errors.profession}>
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
        required={complet}
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

      <ChoixOuiNon
        label="Fonctionnaire"
        name="console-fonctionnaire"
        value={draft.fonctionnaire}
        nonDemande={!complet}
        error={errors.fonctionnaire}
        onChange={(fonctionnaire) => {
          onChange({ fonctionnaire });
        }}
      />

      {complet ? null : (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="pb-1.5 text-[0.8125rem] font-[600] text-foreground">Situation</legend>
          <div className="flex flex-wrap gap-2">
            {PROSPECT_TYPES.map((option) => (
              <ChoixSituation
                key={option}
                option={option}
                checked={draft.type === option}
                onSelect={() => {
                  onChange({ type: draft.type === option ? null : option });
                }}
              />
            ))}
          </div>
        </fieldset>
      )}

      <Field label="Syndicat" required={complet} error={errors.syndicatId}>
        {(props) => (
          <Liste
            id={props.id}
            describedBy={props['aria-describedby']}
            items={syndicatItems}
            value={draft.syndicatId}
            placeholder="Choisir un syndicat"
            onChange={(syndicatId) => {
              onChange({ syndicatId });
            }}
          />
        )}
      </Field>

      <Field label="Banque" required={complet} error={errors.banqueId}>
        {(props) => (
          <Liste
            id={props.id}
            describedBy={props['aria-describedby']}
            items={banqueItems}
            value={draft.banqueId}
            placeholder="Choisir une banque"
            onChange={(banqueId) => {
              onChange({ banqueId });
            }}
          />
        )}
      </Field>

      <ChoixOuiNon
        label="Engagement en cours à la banque"
        name="console-engagement"
        value={draft.engagementEnCours}
        nonDemande={!complet}
        error={errors.engagementEnCours}
        onChange={(engagementEnCours) => {
          onChange({ engagementEnCours });
        }}
      />

      <Field label="Revenu mensuel" required={complet} error={errors.incomeBandId}>
        {(props) => (
          <Liste
            id={props.id}
            describedBy={props['aria-describedby']}
            items={trancheItems}
            value={draft.incomeBandId}
            placeholder="Choisir une tranche"
            onChange={(incomeBandId) => {
              onChange({ incomeBandId });
            }}
          />
        )}
      </Field>

      {complet ? null : (
        <Field label="Paiement">
          {(props) => (
            <Liste
              id={props.id}
              describedBy={props['aria-describedby']}
              items={PAIEMENTS}
              value={draft.paymentMode ?? ''}
              placeholder="Choisir un mode"
              onChange={(value) => {
                const paymentMode = value as PaymentMode;
                onChange({
                  paymentMode,
                  ...(paymentMode === 'ECHELONNE' ? {} : { dureeSystemeMois: '' }),
                });
              }}
            />
          )}
        </Field>
      )}

      {complet || draft.paymentMode === 'ECHELONNE' ? (
        <Field
          label="Durée du système de paiement"
          required={complet}
          error={errors.dureeSystemeMois}
        >
          {(props) => (
            <Liste
              id={props.id}
              describedBy={props['aria-describedby']}
              items={DUREES}
              value={draft.dureeSystemeMois}
              placeholder="Choisir une durée"
              onChange={(dureeSystemeMois) => {
                onChange({ dureeSystemeMois });
              }}
            />
          )}
        </Field>
      ) : null}

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
        {errors.method === undefined ? null : (
          <p role="alert" className="text-[0.75rem] text-destructive">
            {errors.method}
          </p>
        )}
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

function Liste({
  id,
  describedBy,
  items,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  describedBy: string | undefined;
  items: readonly { value: string; label: string }[];
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next === null || next === '') return;
        onChange(next);
      }}
    >
      <SelectTrigger id={id} aria-describedby={describedBy}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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

function ChoixSituation({
  option,
  checked,
  onSelect,
}: {
  option: ProspectType;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-[0.875rem]',
        'transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
        checked
          ? 'border-primary bg-secondary text-secondary-foreground'
          : 'border-border hover:bg-secondary/60',
      )}
    >
      <input
        type="checkbox"
        name="console-situation"
        value={option}
        checked={checked}
        className="size-4 accent-[var(--primary)]"
        onChange={onSelect}
      />
      {PROSPECT_TYPE_LABELS[option]}
    </label>
  );
}

/**
 * « Non demandé » n'existe que là où la question peut rester sans réponse :
 * confondre ce silence avec « non » inventerait une déclaration jamais faite.
 */
function ChoixOuiNon({
  label,
  name,
  value,
  nonDemande,
  error,
  onChange,
}: {
  label: string;
  name: string;
  value: boolean | null;
  nonDemande: boolean;
  error?: string | undefined;
  onChange: (value: boolean | null) => void;
}) {
  const choix: readonly { readonly label: string; readonly value: boolean | null }[] = [
    { label: 'Oui', value: true },
    { label: 'Non', value: false },
    ...(nonDemande ? [{ label: 'Non demandé', value: null }] : []),
  ];

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="pb-1.5 text-[0.8125rem] font-[600] text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {choix.map((choice) => (
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
      {error === undefined ? null : (
        <p role="alert" className="text-[0.75rem] text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
