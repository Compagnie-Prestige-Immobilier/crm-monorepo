'use client';

import { Fragment, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ChampAjoute } from '@/components/forms/champ-ajoute';
import { Field } from '@/components/forms/field';
import { Liste } from '@/components/forms/liste';
import { Input } from '@/components/ui/input';
import {
  reglesChamps,
  type ChampReglable,
  type ConversionDraft,
  type ConversionErrors,
} from '@/lib/data/console';
import type { ChampLibre, ReglageChamp } from '@/lib/data/champs-conversion';
import {
  DUREES_MOIS,
  formatDureeMois,
  PROSPECT_TYPE_LABELS,
  PROSPECT_TYPES,
} from '@/lib/data/grand-public';
import { fetchParametresChues } from '@/lib/data/parametres-chues';
import { fetchBanques, fetchIncomeBands, fetchSyndicats } from '@/lib/data/reference';
import { formatPhone, withRetired } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import {
  ENROLLMENT_METHOD_LABELS,
  ENROLLMENT_METHOD_ORDER,
  PAYMENT_MODE_LABELS,
  PAYMENT_MODES,
  type EnrollmentMethod,
  type PaymentMode,
  type ProspectType,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const REFERENCE_STALE_TIME = 300_000;

const PAIEMENTS: readonly { value: PaymentMode; label: string }[] = PAYMENT_MODES.map((mode) => ({
  value: mode,
  label: PAYMENT_MODE_LABELS[mode],
}));

const DUREES = DUREES_MOIS.map((mois) => ({ value: String(mois), label: formatDureeMois(mois) }));

const COORDONNEES: Partial<
  Record<
    EnrollmentMethod,
    {
      readonly libelle: string;
      readonly cle: 'plateformeChuesUrl' | 'emailChues' | 'whatsappChuesE164';
    }
  >
> = {
  PLATFORM: { libelle: 'Lien de la plateforme CPI CHUES', cle: 'plateformeChuesUrl' },
  VOICE_OR_ELECTRONIC_MESSAGING: { libelle: 'Adresse e-mail CHUES', cle: 'emailChues' },
  WHATSAPP: { libelle: 'Numéro WhatsApp CHUES', cle: 'whatsappChuesE164' },
};

export interface SaisieTelephone {
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}

/** Sur un appel le numéro est celui qu'on vient de composer ; à l'ajout, il se tape. */
function ChampTelephone({
  phoneE164,
  telephone,
}: {
  phoneE164: string | null;
  telephone: SaisieTelephone | undefined;
}) {
  if (telephone === undefined) {
    return (
      <Field label="Téléphone" description="Le numéro ne se corrige pas depuis un appel.">
        {(props) => <Input {...props} readOnly value={formatPhone(phoneE164)} />}
      </Field>
    );
  }
  return (
    <Field label="Téléphone" required error={telephone.error}>
      {(props) => (
        <Input
          {...props}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="77 123 45 67"
          value={telephone.value}
          onChange={(event) => {
            telephone.onChange(event.target.value);
          }}
        />
      )}
    </Field>
  );
}

/**
 * L'ordre, la visibilité et le caractère obligatoire viennent de
 * `reglages` : sans réglage chargé, le formulaire reste celui du projet.
 */
export function ConversionFields({
  draft,
  errors,
  phoneE164,
  telephone,
  disabled,
  reglages,
  libres,
  onChange,
}: {
  draft: ConversionDraft;
  errors: ConversionErrors;
  phoneE164: string | null;
  /** Présent : la fiche n'existe pas encore, son numéro se saisit ici. */
  telephone?: SaisieTelephone | undefined;
  disabled: boolean;
  reglages: readonly ReglageChamp[];
  libres: readonly ChampLibre[];
  onChange: (patch: Partial<ConversionDraft>) => void;
}) {
  const complet = draft.projet === 'CHUES';
  const regles = reglesChamps(reglages);

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

  const noeuds: Readonly<Record<ChampReglable, ReactNode>> = {
    nom: (
      <Field label="Nom" required={regles.requis('nom', true)} error={errors.nom}>
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
    ),
    prenom: (
      <Field label="Prénom" required={regles.requis('prenom', complet)} error={errors.prenom}>
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
    ),
    phoneE164: <ChampTelephone phoneE164={phoneE164} telephone={telephone} />,
    whatsappStatus: (
      <ChoixOuiNon
        label="Ce numéro est-il un numéro WhatsApp ?"
        name="console-whatsapp"
        value={draft.memeWhatsapp}
        nonDemande={false}
        onChange={(memeWhatsapp) => {
          onChange({ memeWhatsapp, ...(memeWhatsapp === false ? {} : { whatsapp: '' }) });
        }}
      />
    ),
    whatsappE164:
      draft.memeWhatsapp === false ? (
        <Field label="Numéro WhatsApp" error={errors.whatsapp}>
          {(props) => (
            <Input
              {...props}
              inputMode="tel"
              autoComplete="off"
              placeholder="77 123 45 67"
              value={draft.whatsapp}
              onChange={(event) => {
                onChange({ whatsapp: event.target.value });
              }}
            />
          )}
        </Field>
      ) : null,
    email: (
      <Field label="E-mail" required={regles.requis('email', false)} error={errors.email}>
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
    ),
    profession: (
      <Field
        label="Profession"
        required={regles.requis('profession', complet)}
        error={errors.profession}
      >
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
    ),
    dureeEtablissementMois: (
      <Field
        label="Durée dans la fonction (mois)"
        required={regles.requis('dureeEtablissementMois', complet)}
        error={errors.dureeEtablissementMois}
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
    ),
    fonctionnaire: (
      <ChoixOuiNon
        label="Fonctionnaire"
        name="console-fonctionnaire"
        value={draft.fonctionnaire}
        nonDemande={!regles.requis('fonctionnaire', complet)}
        error={errors.fonctionnaire}
        onChange={(fonctionnaire) => {
          onChange({ fonctionnaire });
        }}
      />
    ),
    type: (
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
        {errors.type === undefined ? null : (
          <p role="alert" className="text-[0.75rem] text-destructive">
            {errors.type}
          </p>
        )}
      </fieldset>
    ),
    syndicatId: (
      <Field
        label="Syndicat"
        required={regles.requis('syndicatId', complet)}
        error={errors.syndicatId}
      >
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
    ),
    banqueId: (
      <Field label="Banque" required={regles.requis('banqueId', complet)} error={errors.banqueId}>
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
    ),
    engagementEnCours: (
      <ChoixOuiNon
        label="Engagement en cours à la banque"
        name="console-engagement"
        value={draft.engagementEnCours}
        nonDemande={!regles.requis('engagementEnCours', complet)}
        error={errors.engagementEnCours}
        onChange={(engagementEnCours) => {
          onChange({ engagementEnCours });
        }}
      />
    ),
    incomeBandId: (
      <Field
        label="Revenu mensuel"
        required={regles.requis('incomeBandId', complet)}
        error={errors.incomeBandId}
      >
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
    ),
    paymentMode: (
      <Field
        label="Paiement"
        required={regles.requis('paymentMode', false)}
        error={errors.paymentMode}
      >
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
    ),
    dureeSystemeMois:
      draft.paymentMode === 'ECHELONNE' ? (
        <Field
          label="Durée du système de paiement"
          required={regles.requis('dureeSystemeMois', false)}
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
      ) : null,
    method: (
      <>
        <fieldset className="flex min-w-0 flex-col gap-2 sm:col-span-2">
          <legend className="pb-1.5 text-[0.8125rem] font-[600] text-foreground">
            Méthode d’enrôlement
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ENROLLMENT_METHOD_ORDER.map((method) => (
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
        <CoordonneeChues method={draft.method} />
      </>
    ),
    rendezVousAt:
      draft.method === 'APPOINTMENT' ? (
        <Field
          label="Date et heure du rendez-vous"
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
      ) : null,
  };

  // Grand Public pose déjà la question dans « Situation », qui a son option
  // fonctionnaire : la reposer en oui / non ferait deux réponses pour une.
  const ordre = (
    reglages.length > 0 ? reglages.map((regle) => regle.champ) : Object.keys(noeuds)
  ).filter((champ) => complet || champ !== 'fonctionnaire');

  return (
    <fieldset className="grid gap-4 sm:grid-cols-2" disabled={disabled}>
      <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
        Phase 3 · Conversion
      </legend>

      {ordre.map((champ) =>
        regles.visible(champ as ChampReglable, visibleParDefaut(champ, complet)) ? (
          <Fragment key={champ}>{noeuds[champ as ChampReglable]}</Fragment>
        ) : null,
      )}

      {libres.map((champ) => (
        <ChampAjoute
          key={champ.id}
          champ={champ}
          value={draft.champsLibres[champ.id] ?? ''}
          error={errors.libres?.[champ.id]}
          onChange={(valeur) => {
            onChange({ champsLibres: { ...draft.champsLibres, [champ.id]: valeur } });
          }}
        />
      ))}
    </fieldset>
  );
}

/** EB-24 : ce que le téléconseiller dicte au prospect, selon la méthode choisie. */
function CoordonneeChues({ method }: { method: EnrollmentMethod | null }) {
  const parametres = useQuery({
    queryKey: queryKeys.parametresChues,
    queryFn: () => fetchParametresChues(),
    staleTime: REFERENCE_STALE_TIME,
  });

  const attendue = method === null ? undefined : COORDONNEES[method];
  if (attendue === undefined || parametres.data === undefined) return null;

  const valeur = parametres.data[attendue.cle];
  return (
    <p className="rounded-md border border-border px-3 py-2 text-[0.875rem] sm:col-span-2">
      <span className="text-muted-foreground">{attendue.libelle} : </span>
      {valeur === '' ? (
        'à renseigner dans les paramètres CHUES.'
      ) : (
        <span className="select-all font-[600]">{valeur}</span>
      )}
    </p>
  );
}

/** Situation et mode de paiement n'existent pas sur CHUES : le prospect y est enseignant. */
function visibleParDefaut(champ: string, complet: boolean): boolean {
  if (champ === 'type' || champ === 'paymentMode' || champ === 'dureeSystemeMois') {
    return !complet;
  }
  return true;
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
