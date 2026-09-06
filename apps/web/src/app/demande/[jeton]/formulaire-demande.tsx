'use client';

import { AlertCircleIcon, CheckCircle2Icon, LoaderIcon } from 'lucide-react';
import Script from 'next/script';
import { useRef, useState, type FormEvent } from 'react';

import { Field } from '@/components/forms/field';
import { Liste, type OptionListe } from '@/components/forms/liste';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  CHOIX_WHATSAPP,
  champsRendus,
  cleLibre,
  corpsDemande,
  estRequis,
  grouperChamps,
  MESSAGE_MAX,
  valeursLibre,
  validerDemande,
  widgetDe,
  type ChampLibrePublic,
  type FormulairePublic,
  type ReglageChampPublic,
  type Saisie,
  type SourceListe,
  type Widget,
} from '@/lib/data/formulaire-public';
import {
  DUREES_MOIS,
  formatDureeMois,
  PROSPECT_TYPE_LABELS,
  PROSPECT_TYPES,
} from '@/lib/data/grand-public';
import { PAYMENT_MODE_LABELS } from '@/lib/types';
import { apiErrorMessage, cn } from '@/lib/utils';

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

/** Le nom du champ caché que le widget Turnstile pose dans le formulaire. */
const TURNSTILE_CHAMP = 'cf-turnstile-response';

const PIEGE_CHAMP = 'site';

const SITUATIONS: readonly OptionListe[] = PROSPECT_TYPES.map((valeur) => ({
  value: valeur,
  label: PROSPECT_TYPE_LABELS[valeur],
}));

const PAIEMENTS: readonly OptionListe[] = Object.entries(PAYMENT_MODE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const DUREES: readonly OptionListe[] = DUREES_MOIS.map((mois) => ({
  value: String(mois),
  label: formatDureeMois(mois),
}));

const MODES_SAISIE: Readonly<Record<string, 'tel' | 'numeric'>> = { tel: 'tel', number: 'numeric' };

function optionsDe(source: SourceListe | undefined, formulaire: FormulairePublic): OptionListe[] {
  if (source === 'banques') return formulaire.banques.map(enOption);
  if (source === 'syndicats') return formulaire.syndicats.map(enOption);
  if (source === 'revenus') return formulaire.revenus.map(enOption);
  if (source === 'situations') return [...SITUATIONS];
  if (source === 'paiements') return [...PAIEMENTS];
  if (source === 'durees') return [...DUREES];
  if (source === 'whatsapp') return CHOIX_WHATSAPP.map((choix) => ({ ...choix }));
  return [];
}

const enOption = (option: { id: string; libelle: string }): OptionListe => ({
  value: option.id,
  label: option.libelle,
});

type Etat = 'saisie' | 'relecture' | 'envoi' | 'envoye';

export function FormulaireDemande({
  jeton,
  cleSite,
  formulaire,
}: {
  jeton: string;
  cleSite: string;
  formulaire: FormulairePublic;
}) {
  const [saisie, setSaisie] = useState<Saisie>({});
  const [erreurs, setErreurs] = useState<Readonly<Record<string, string>>>({});
  const [etat, setEtat] = useState<Etat>('saisie');
  const [refus, setRefus] = useState<string | null>(null);
  const element = useRef<HTMLFormElement>(null);

  const rendus = champsRendus(formulaire.champs, saisie);
  const sections = grouperChamps(rendus);
  const enCours = etat === 'envoi';

  function modifier(cle: string, valeur: string): void {
    setSaisie((precedent) => ({ ...precedent, [cle]: valeur }));
    setErreurs((precedent) => {
      const { [cle]: _, ...reste } = precedent;
      return reste;
    });
    setEtat((precedent) => (precedent === 'relecture' ? 'saisie' : precedent));
  }

  /**
   * Le widget et le piège posent leurs champs dans le DOM : ils sont lus ici
   * plutôt que recopiés dans un état, qui serait une seconde source de vérité.
   */
  function champDom(nom: string): string {
    const formulaireDom = element.current;
    if (formulaireDom === null) return '';
    const valeur = new FormData(formulaireDom).get(nom);
    return typeof valeur === 'string' ? valeur : '';
  }

  async function envoyer(): Promise<void> {
    const turnstileToken = champDom(TURNSTILE_CHAMP);
    if (cleSite !== '' && turnstileToken === '') {
      setRefus('La vérification anti-robot n’est pas terminée. Patientez, puis renvoyez.');
      return;
    }

    setEtat('envoi');
    setRefus(null);
    const piege = champDom(PIEGE_CHAMP);
    const corps = {
      ...corpsDemande(saisie, formulaire.champs, formulaire.libres),
      turnstileToken,
      ...(piege === '' ? {} : { site: piege }),
    };

    try {
      const reponse = await fetch(`/api/demande/${encodeURIComponent(jeton)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
      if (!reponse.ok) {
        const charge: unknown = await reponse.json().catch(() => null);
        setRefus(apiErrorMessage(charge, 'Votre demande n’a pas pu être envoyée.'));
        setEtat('relecture');
        return;
      }
      setEtat('envoye');
    } catch {
      setRefus('Le serveur est injoignable. Vérifiez votre connexion.');
      setEtat('relecture');
    }
  }

  function soumettre(evenement: FormEvent<HTMLFormElement>): void {
    evenement.preventDefault();
    if (etat === 'envoi' || etat === 'envoye') return;

    const problemes = validerDemande(saisie, formulaire.champs, formulaire.libres);
    setErreurs(problemes);
    if (Object.keys(problemes).length > 0) {
      setRefus('Vérifiez les champs signalés.');
      setEtat('saisie');
      return;
    }

    setRefus(null);
    if (etat === 'saisie') {
      setEtat('relecture');
      return;
    }
    void envoyer();
  }

  if (etat === 'envoye') {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <CheckCircle2Icon className="size-8 text-success" aria-hidden="true" />
        <h2 className="font-display text-h2 font-[700]">Votre demande est enregistrée</h2>
        <p className="text-body text-muted-foreground">
          Un conseiller CPI vous rappelle sur le numéro que vous avez laissé. Si vous avez indiqué
          une adresse e-mail, un accusé de réception vient de vous être envoyé.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={element}
      noValidate
      method="post"
      onSubmit={soumettre}
      className="flex flex-col gap-8"
    >
      {sections.map((section) => (
        <fieldset key={section.titre} disabled={enCours} className="min-w-0">
          <legend className="eyebrow text-muted-foreground">{section.titre}</legend>
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            {section.champs.map((champ) => (
              <ChampPublic
                key={champ.champ}
                champ={champ}
                formulaire={formulaire}
                valeur={saisie[champ.champ] ?? ''}
                erreur={erreurs[champ.champ]}
                onChange={(valeur) => {
                  modifier(champ.champ, valeur);
                }}
              />
            ))}
          </div>
        </fieldset>
      ))}

      {formulaire.libres.length === 0 ? null : (
        <fieldset disabled={enCours} className="grid min-w-0 gap-5 sm:grid-cols-2">
          {formulaire.libres.map((libre) => (
            <ChampAjoute
              key={libre.id}
              champ={libre}
              valeur={saisie[cleLibre(libre.id)] ?? ''}
              erreur={erreurs[cleLibre(libre.id)]}
              onChange={(valeur) => {
                modifier(cleLibre(libre.id), valeur);
              }}
            />
          ))}
        </fieldset>
      )}

      <fieldset disabled={enCours} className="min-w-0">
        <Field label="Votre message" error={erreurs.message}>
          {(props) => (
            <Textarea
              {...props}
              rows={4}
              maxLength={MESSAGE_MAX}
              value={saisie.message ?? ''}
              onChange={(evenement) => {
                modifier('message', evenement.target.value);
              }}
            />
          )}
        </Field>
      </fieldset>

      {/* Piège à robots : hors de l'écran et hors du parcours au clavier, un
          automate le remplit et son envoi est ignoré. */}
      <input
        name={PIEGE_CHAMP}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="sr-only"
      />

      {cleSite === '' ? null : (
        <>
          <Script src={TURNSTILE_SCRIPT} async defer />
          <div className="cf-turnstile" data-sitekey={cleSite} data-language="fr" />
        </>
      )}

      {refus === null ? null : (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.8125rem] text-destructive"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {refus}
        </p>
      )}

      {etat === 'saisie' ? (
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          Vérifier ma demande
        </Button>
      ) : (
        <Relecture
          formulaire={formulaire}
          rendus={rendus}
          saisie={saisie}
          enCours={enCours}
          onCorriger={() => {
            setEtat('saisie');
          }}
        />
      )}
    </form>
  );
}

/**
 * L'étape de contrôle tient dans le formulaire : les champs restent à l'écran
 * et modifiables, une étape de plus ferait abandonner un visiteur public.
 */
function Relecture({
  formulaire,
  rendus,
  saisie,
  enCours,
  onCorriger,
}: {
  formulaire: FormulairePublic;
  rendus: readonly ReglageChampPublic[];
  saisie: Saisie;
  enCours: boolean;
  onCorriger: () => void;
}) {
  const lignes = [
    ...rendus.map((champ) => ({
      libelle: champ.libelle,
      valeur: valeurLisible(champ.champ, saisie[champ.champ] ?? '', formulaire),
    })),
    ...formulaire.libres.map((libre) => ({
      libelle: libre.libelle,
      valeur: (saisie[cleLibre(libre.id)] ?? '').trim(),
    })),
    { libelle: 'Message', valeur: (saisie.message ?? '').trim() },
  ].filter((ligne) => ligne.valeur !== '');

  return (
    <section
      aria-labelledby="relecture-titre"
      className="rounded-md border border-border bg-card p-4"
    >
      <h2 id="relecture-titre" className="font-display text-h4 font-[700]">
        Ce qui va être envoyé
      </h2>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {lignes.map((ligne) => (
          <div key={ligne.libelle} className="flex min-w-0 flex-col">
            <dt className="text-[0.75rem] text-muted-foreground">{ligne.libelle}</dt>
            <dd className="text-[0.875rem] break-words">{ligne.valeur}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={enCours}>
          {enCours ? (
            <>
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              Envoi…
            </>
          ) : (
            'Envoyer ma demande'
          )}
        </Button>
        <Button type="button" variant="outline" size="lg" disabled={enCours} onClick={onCorriger}>
          Corriger
        </Button>
      </div>
    </section>
  );
}

function valeurLisible(champ: string, brut: string, formulaire: FormulairePublic): string {
  const valeur = brut.trim();
  const widget = widgetDe(champ);
  if (valeur === '' || widget === undefined) return valeur;
  if (widget.saisie === 'ouinon') return valeur === 'oui' ? 'Oui' : 'Non';
  if (widget.saisie !== 'liste') return valeur;
  return (
    optionsDe(widget.source, formulaire).find((item) => item.value === valeur)?.label ?? valeur
  );
}

function ChampPublic({
  champ,
  formulaire,
  valeur,
  erreur,
  onChange,
}: {
  champ: ReglageChampPublic;
  formulaire: FormulairePublic;
  valeur: string;
  erreur: string | undefined;
  onChange: (valeur: string) => void;
}) {
  const widget = widgetDe(champ.champ);
  if (widget === undefined) return null;

  if (widget.saisie === 'ouinon') {
    return (
      <ChoixOuiNon
        label={champ.libelle}
        nom={champ.champ}
        requis={estRequis(champ)}
        valeur={valeur}
        erreur={erreur}
        onChange={onChange}
      />
    );
  }

  return (
    <Field label={champ.libelle} required={estRequis(champ)} error={erreur}>
      {(props) =>
        widget.saisie === 'liste' ? (
          <Liste
            id={props.id}
            describedBy={props['aria-describedby']}
            invalide={props['aria-invalid']}
            items={optionsDe(widget.source, formulaire)}
            value={valeur}
            placeholder="Choisir"
            onChange={onChange}
          />
        ) : (
          <Saisir {...props} widget={widget} valeur={valeur} onChange={onChange} />
        )
      }
    </Field>
  );
}

function Saisir({
  widget,
  valeur,
  onChange,
  ...props
}: {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
  widget: Widget;
  valeur: string;
  onChange: (valeur: string) => void;
}) {
  return (
    <Input
      {...props}
      type={widget.type ?? 'text'}
      inputMode={widget.type === undefined ? undefined : MODES_SAISIE[widget.type]}
      autoComplete={widget.autoComplete ?? 'off'}
      maxLength={widget.longueurMax}
      min={widget.min}
      max={widget.max}
      value={valeur}
      onChange={(evenement) => {
        onChange(evenement.target.value);
      }}
    />
  );
}

function ChampAjoute({
  champ,
  valeur,
  erreur,
  onChange,
}: {
  champ: ChampLibrePublic;
  valeur: string;
  erreur: string | undefined;
  onChange: (valeur: string) => void;
}) {
  if (champ.type === 'TEXTE') {
    return (
      <Field label={champ.libelle} required={champ.obligatoire} error={erreur}>
        {(props) => (
          <Input
            {...props}
            maxLength={500}
            value={valeur}
            onChange={(evenement) => {
              onChange(evenement.target.value);
            }}
          />
        )}
      </Field>
    );
  }

  const items = valeursLibre(champ).map((option) => ({ value: option, label: option }));
  return (
    <Field label={champ.libelle} required={champ.obligatoire} error={erreur}>
      {(props) => (
        <Liste
          id={props.id}
          describedBy={props['aria-describedby']}
          invalide={props['aria-invalid']}
          items={items}
          value={valeur}
          placeholder="Choisir"
          onChange={onChange}
        />
      )}
    </Field>
  );
}

const OUI_NON: readonly OptionListe[] = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
];

function ChoixOuiNon({
  label,
  nom,
  requis,
  valeur,
  erreur,
  onChange,
}: {
  label: string;
  nom: string;
  requis: boolean;
  valeur: string;
  erreur: string | undefined;
  onChange: (valeur: string) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="pb-1.5 text-[0.8125rem] font-[600] text-foreground">
        {label}
        {requis ? (
          <span className="ps-2 text-[0.8125rem] font-[500] text-destructive">Obligatoire</span>
        ) : null}
      </legend>
      <div className="flex flex-wrap gap-2">
        {OUI_NON.map((choix) => (
          <label
            key={choix.value}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-[0.875rem]',
              'transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
              valeur === choix.value
                ? 'border-primary bg-secondary text-secondary-foreground'
                : 'border-border hover:bg-secondary/60',
            )}
          >
            <input
              type="radio"
              name={nom}
              value={choix.value}
              checked={valeur === choix.value}
              className="size-4 accent-[var(--primary)]"
              onChange={() => {
                onChange(choix.value);
              }}
            />
            {choix.label}
          </label>
        ))}
      </div>
      {erreur === undefined ? null : (
        <p role="alert" className="text-[0.75rem] text-destructive">
          {erreur}
        </p>
      )}
    </fieldset>
  );
}
