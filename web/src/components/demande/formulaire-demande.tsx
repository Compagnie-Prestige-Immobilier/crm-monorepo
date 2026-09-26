'use client';

import { AlertCircleIcon, CheckCircle2Icon, LoaderIcon } from 'lucide-react';
import Script from 'next/script';
import { useRef, useState, type FormEvent, type RefObject } from 'react';

import { Field } from '@/components/forms/field';
import { Liste, type OptionListe } from '@/components/forms/liste';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getApiClient } from '@/lib/api/browser';
import {
  aDesCoordonnees,
  CHOIX_WHATSAPP,
  champsRendus,
  cleLibre,
  corpsDemande,
  ecrireBrouillon,
  effacerBrouillon,
  estRequis,
  etapeDuChamp,
  grouperChamps,
  lire,
  lireBrouillon,
  MESSAGE_MAX,
  valeursLibre,
  validerDemande,
  widgetDe,
  type ChampLibrePublic,
  type Etape,
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
import { PAYMENT_MODE_LABELS, PAYMENT_MODES } from '@/lib/types';
import { useRecalage } from '@/lib/use-recalage';
import { apiErrorMessage, cn } from '@/lib/utils';

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

/** Le nom du champ caché que le widget Turnstile pose dans le formulaire. */
const TURNSTILE_CHAMP = 'cf-turnstile-response';

const PIEGE_CHAMP = 'site';

const SITUATIONS: readonly OptionListe[] = PROSPECT_TYPES.map((valeur) => ({
  value: valeur,
  label: PROSPECT_TYPE_LABELS[valeur],
}));

/**
 * Le crédit immobilier ne s'offre pas ici : le formulaire est ouvert à des
 * inconnus et son contrat ne l'accepte pas.
 */
const PAIEMENTS: readonly OptionListe[] = PAYMENT_MODES.filter(
  (mode) => mode !== 'CREDIT_IMMOBILIER',
).map((mode) => ({ value: mode, label: PAYMENT_MODE_LABELS[mode] }));

const DUREES: readonly OptionListe[] = DUREES_MOIS.map((mois) => ({
  value: String(mois),
  label: formatDureeMois(mois),
}));

function optionsDe(
  source: SourceListe | undefined,
  formulaire: FormulairePublic,
): readonly OptionListe[] {
  if (source === undefined) return [];
  return {
    banques: formulaire.banques.map(enOption),
    syndicats: formulaire.syndicats.map(enOption),
    revenus: formulaire.revenus.map(enOption),
    professions: formulaire.professions.map(enOption),
    dureesEtablissement: formulaire.dureesEtablissement.map(enTranche),
    situations: SITUATIONS,
    paiements: PAIEMENTS,
    durees: DUREES,
    whatsapp: CHOIX_WHATSAPP,
  }[source];
}

const enOption = (option: { id: string; libelle: string }): OptionListe => ({
  value: option.id,
  label: option.libelle,
});

const enTranche = (tranche: { mois: number; libelle: string }): OptionListe => ({
  value: String(tranche.mois),
  label: tranche.libelle,
});

type Phase = 'coordonnees' | 'complement' | 'relecture' | 'envoi' | 'envoye';

const etapeDe = (phase: Phase): Etape => (phase === 'coordonnees' ? 'coordonnees' : 'complement');

export function FormulaireDemande({
  jeton,
  cleSite,
  formulaire,
}: {
  jeton: string;
  cleSite: string;
  formulaire: FormulairePublic;
}) {
  const deuxEtapes = aDesCoordonnees(formulaire.champs);
  const [saisie, setSaisie] = useState<Saisie>({});
  const [erreurs, setErreurs] = useState<Readonly<Record<string, string>>>({});
  const [phase, setPhase] = useState<Phase>(deuxEtapes ? 'coordonnees' : 'complement');
  const [refus, setRefus] = useState<string | null>(null);
  const element = useRef<HTMLFormElement>(null);
  const repere = useRef<HTMLParagraphElement>(null);
  const verifier = useRef<HTMLButtonElement>(null);

  const etape = etapeDe(phase);
  const rendus = champsRendus(formulaire.champs, saisie);
  const sections = grouperChamps(rendus, etape);
  const enCours = phase === 'envoi';
  const enRelecture = phase === 'relecture' || phase === 'envoi';

  useRecalage([jeton], () => {
    const brouillon = lireBrouillon(jeton);
    if (brouillon === null) return;
    setSaisie(brouillon.saisie);
    if (brouillon.etape === 'complement') setPhase('complement');
  });

  function retenir(valeurs: Saisie, suivante: Phase): void {
    ecrireBrouillon(jeton, { saisie: valeurs, etape: etapeDe(suivante) });
  }

  function poser(cle: string, probleme: string | undefined): void {
    setErreurs((precedent) => {
      if (probleme !== undefined) return { ...precedent, [cle]: probleme };
      if (!Object.hasOwn(precedent, cle)) return precedent;
      const { [cle]: _, ...reste } = precedent;
      return reste;
    });
  }

  const problemeDe = (cle: string, valeurs: Saisie): string | undefined =>
    validerDemande(valeurs, formulaire.champs, formulaire.libres)[cle];

  /** Un champ déjà signalé se corrige à la frappe ; un champ muet le reste. */
  function modifier(cle: string, valeur: string): void {
    const valeurs = { ...saisie, [cle]: valeur };
    setSaisie(valeurs);
    if (Object.hasOwn(erreurs, cle)) poser(cle, problemeDe(cle, valeurs));
    setPhase((precedent) => (precedent === 'relecture' ? 'complement' : precedent));
    retenir(valeurs, phase);
  }

  /** Le premier signalement attend que le champ soit quitté : le corriger à chaque lettre reprend le visiteur en permanence. */
  function quitter(cle: string): void {
    poser(cle, problemeDe(cle, saisie));
  }

  function allerA(suivante: Phase): void {
    setPhase(suivante);
    retenir(saisie, suivante);
    element.current?.scrollIntoView({ block: 'start' });
    repere.current?.focus();
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
    if (enCours) return;
    const turnstileToken = champDom(TURNSTILE_CHAMP);
    if (cleSite !== '' && turnstileToken === '') {
      setRefus('La vérification anti-robot n’est pas terminée. Patientez, puis renvoyez.');
      return;
    }

    setPhase('envoi');
    setRefus(null);
    const piege = champDom(PIEGE_CHAMP);
    const corps = {
      ...corpsDemande(saisie, formulaire.champs, formulaire.libres),
      nom: lire(saisie, 'nom'),
      prenom: lire(saisie, 'prenom'),
      phone: lire(saisie, 'phoneE164'),
      turnstileToken,
      ...(piege === '' ? {} : { site: piege }),
    };

    try {
      const { error } = await getApiClient().POST('/api/v1/formulaire-public/{jeton}', {
        params: { path: { jeton } },
        body: corps,
      });
      if (error !== undefined) {
        setRefus(apiErrorMessage(error, 'Votre demande n’a pas pu être envoyée.'));
        setPhase('relecture');
        return;
      }
      effacerBrouillon(jeton);
      setPhase('envoye');
    } catch {
      setRefus('Le serveur est injoignable. Vérifiez votre connexion.');
      setPhase('relecture');
    }
  }

  function franchir(): void {
    const portee = phase === 'coordonnees' ? 'coordonnees' : 'tout';
    const problemes = validerDemande(saisie, formulaire.champs, formulaire.libres, portee);
    setErreurs(problemes);
    if (Object.keys(problemes).length > 0) {
      setRefus('Vérifiez les champs signalés.');
      // Une erreur sur l'étape 1 depuis l'étape 2 y ramène : la signaler sur un
      // champ qui n'est pas à l'écran laisserait le visiteur sans recours.
      const enAmont = Object.keys(problemes).some((cle) => etapeDuChamp(cle) === 'coordonnees');
      allerA(enAmont && deuxEtapes ? 'coordonnees' : 'complement');
      return;
    }
    setRefus(null);
    allerA(phase === 'coordonnees' ? 'complement' : 'relecture');
  }

  /** Le seul chemin vers le POST part de la fenêtre de relecture : le formulaire, lui, ne fait qu'avancer d'une étape. */
  function soumettre(evenement: FormEvent<HTMLFormElement>): void {
    evenement.preventDefault();
    if (enRelecture) return;
    franchir();
  }

  /** Fermer la fenêtre revient à la saisie : ni la relecture ni le brouillon ne perdent quoi que ce soit. */
  function corriger(): void {
    if (enCours) return;
    setPhase('complement');
    retenir(saisie, 'complement');
  }

  if (phase === 'envoye') {
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
      {deuxEtapes ? (
        <p
          ref={repere}
          tabIndex={-1}
          aria-live="polite"
          className="rail eyebrow text-muted-foreground outline-none"
        >
          Étape {etape === 'coordonnees' ? '1' : '2'} sur 2
        </p>
      ) : null}

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
                onBlur={() => {
                  quitter(champ.champ);
                }}
              />
            ))}
          </div>
        </fieldset>
      ))}

      {etape === 'complement' ? (
        <Complement
          libres={formulaire.libres}
          saisie={saisie}
          erreurs={erreurs}
          enCours={enCours}
          onChange={modifier}
          onBlur={quitter}
        />
      ) : null}

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

      {/* Monté dès l'étape 1 et JAMAIS démonté : le jeton que le widget dépose
          disparaîtrait au changement d'étape, et l'envoi serait refusé. */}
      {cleSite === '' ? null : (
        <>
          <Script src={TURNSTILE_SCRIPT} async defer />
          <div className="cf-turnstile" data-sitekey={cleSite} data-language="fr" />
        </>
      )}

      {refus === null || enRelecture ? null : <Refus texte={refus} />}

      <Actions
        phase={phase}
        deuxEtapes={deuxEtapes}
        verifier={verifier}
        onRetour={() => {
          setRefus(null);
          allerA('coordonnees');
        }}
      />

      <FenetreRelecture
        ouverte={enRelecture}
        enCours={enCours}
        refus={refus}
        formulaire={formulaire}
        rendus={rendus}
        saisie={saisie}
        verifier={verifier}
        onEnvoyer={() => {
          void envoyer();
        }}
        onCorriger={corriger}
      />
    </form>
  );
}

/**
 * La fenêtre est PORTÉE hors du formulaire : ses boutons ne peuvent pas le
 * soumettre, et l'envoi passe par `onEnvoyer`.
 */
function FenetreRelecture({
  ouverte,
  enCours,
  refus,
  formulaire,
  rendus,
  saisie,
  verifier,
  onEnvoyer,
  onCorriger,
}: {
  ouverte: boolean;
  enCours: boolean;
  refus: string | null;
  formulaire: FormulairePublic;
  rendus: readonly ReglageChampPublic[];
  saisie: Saisie;
  verifier: RefObject<HTMLButtonElement | null>;
  onEnvoyer: () => void;
  onCorriger: () => void;
}) {
  return (
    <Dialog
      open={ouverte}
      onOpenChange={(ouvert) => {
        if (!ouvert) onCorriger();
      }}
    >
      <DialogContent
        finalFocus={verifier}
        showCloseButton={false}
        className="grid-rows-[auto_minmax(0,1fr)_auto] overflow-y-hidden"
      >
        <DialogHeader>
          <DialogTitle>Ce qui va être envoyé</DialogTitle>
        </DialogHeader>

        <div className="-mx-1 min-h-0 overflow-y-auto px-1">
          <Relecture formulaire={formulaire} rendus={rendus} saisie={saisie} />
          {refus === null ? null : (
            <div className="mt-4">
              <Refus texte={refus} />
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-start">
          <Button
            type="button"
            size="lg"
            disabled={enCours}
            onClick={onEnvoyer}
            className="w-full sm:w-auto"
          >
            {enCours ? (
              <>
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                Envoi…
              </>
            ) : (
              'Envoyer ma demande'
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={enCours}
            onClick={onCorriger}
            className="w-full sm:w-auto"
          >
            Corriger
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Refus({ texte }: { texte: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.8125rem] text-destructive"
    >
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {texte}
    </p>
  );
}

/** Ce que l'étape 2 ajoute aux sections réglées : les champs libres et le message. */
function Complement({
  libres,
  saisie,
  erreurs,
  enCours,
  onChange,
  onBlur,
}: {
  libres: readonly ChampLibrePublic[];
  saisie: Saisie;
  erreurs: Readonly<Record<string, string>>;
  enCours: boolean;
  onChange: (cle: string, valeur: string) => void;
  onBlur: (cle: string) => void;
}) {
  return (
    <>
      {libres.length === 0 ? null : (
        <fieldset disabled={enCours} className="grid min-w-0 gap-5 sm:grid-cols-2">
          {libres.map((libre) => (
            <ChampAjoute
              key={libre.id}
              champ={libre}
              valeur={saisie[cleLibre(libre.id)] ?? ''}
              erreur={erreurs[cleLibre(libre.id)]}
              onChange={(valeur) => {
                onChange(cleLibre(libre.id), valeur);
              }}
              onBlur={() => {
                onBlur(cleLibre(libre.id));
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
                onChange('message', evenement.target.value);
              }}
              onBlur={() => {
                onBlur('message');
              }}
            />
          )}
        </Field>
      </fieldset>
    </>
  );
}

/**
 * Collée en bas sur mobile : sans cela le bouton d'étape vit sous dix champs et
 * se gagne au défilement.
 */
function Actions({
  phase,
  deuxEtapes,
  verifier,
  onRetour,
}: {
  phase: Phase;
  deuxEtapes: boolean;
  verifier: RefObject<HTMLButtonElement | null>;
  onRetour: () => void;
}) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-6 flex flex-col gap-3 border-t border-border bg-background px-6 py-3',
        'sm:static sm:mx-0 sm:flex-row sm:flex-wrap sm:border-0 sm:bg-transparent sm:px-0 sm:py-0',
      )}
    >
      {phase === 'coordonnees' ? (
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          Suivant
        </Button>
      ) : (
        <>
          <Button ref={verifier} type="submit" size="lg" className="w-full sm:w-auto">
            Vérifier ma demande
          </Button>
          {deuxEtapes ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onRetour}
              className="w-full sm:w-auto"
            >
              Retour
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

function Relecture({
  formulaire,
  rendus,
  saisie,
}: {
  formulaire: FormulairePublic;
  rendus: readonly ReglageChampPublic[];
  saisie: Saisie;
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
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {lignes.map((ligne) => (
        <div key={ligne.libelle} className="flex min-w-0 flex-col">
          <dt className="text-[0.75rem] text-muted-foreground">{ligne.libelle}</dt>
          <dd className="text-[0.875rem] break-words">{ligne.valeur}</dd>
        </div>
      ))}
    </dl>
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
  onBlur,
}: {
  champ: ReglageChampPublic;
  formulaire: FormulairePublic;
  valeur: string;
  erreur: string | undefined;
  onChange: (valeur: string) => void;
  onBlur: () => void;
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
          <Saisir {...props} widget={widget} valeur={valeur} onChange={onChange} onBlur={onBlur} />
        )
      }
    </Field>
  );
}

function Saisir({
  widget,
  valeur,
  onChange,
  onBlur,
  ...props
}: {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
  widget: Widget;
  valeur: string;
  onChange: (valeur: string) => void;
  onBlur: () => void;
}) {
  return (
    <Input
      {...props}
      onBlur={onBlur}
      type={widget.type ?? 'text'}
      inputMode={widget.type === 'tel' ? 'tel' : undefined}
      autoComplete={widget.autoComplete ?? 'off'}
      maxLength={widget.longueurMax}
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
  onBlur,
}: {
  champ: ChampLibrePublic;
  valeur: string;
  erreur: string | undefined;
  onChange: (valeur: string) => void;
  onBlur: () => void;
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
            onBlur={onBlur}
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
