import { CheckCircle2Icon } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { ChampPublic } from '@/components/demande/champs-demande';
import { ActionsDemande, ComplementDemande } from '@/components/demande/complement-demande';
import { FenetreRelecture, Refus } from '@/components/demande/relecture-demande';
import { Antirobot, useTurnstile } from '@/components/demande/turnstile';
import {
  ecrireBrouillon,
  effacerBrouillon,
  envoyerDemande,
  lireBrouillon,
  messageDeRefus,
} from '@/lib/data/formulaire-public';
import {
  aDesCoordonnees,
  champsRendus,
  corpsDemande,
  etapeDuChamp,
  grouperChamps,
  validerDemande,
  type ChampLibrePublic,
  type Etape,
  type FormulairePublic,
  type ReglageChampPublic,
  type Saisie,
} from '@/lib/data/formulaire-public-champs';

/** Le nom du champ caché que le widget Turnstile pose dans le formulaire. */
const TURNSTILE_CHAMP = 'cf-turnstile-response';

const PIEGE_CHAMP = 'site';

type Phase = 'coordonnees' | 'complement' | 'relecture' | 'envoi' | 'envoye';

const etapeDe = (phase: Phase): Etape => (phase === 'coordonnees' ? 'coordonnees' : 'complement');

function listesDe(formulaire: FormulairePublic): {
  champs: ReglageChampPublic[];
  libres: ChampLibrePublic[];
} {
  return { champs: formulaire.champs ?? [], libres: formulaire.libres ?? [] };
}

export function FormulaireDemande({
  jeton,
  cleSite,
  formulaire,
}: {
  jeton: string;
  cleSite: string;
  formulaire: FormulairePublic;
}) {
  const { champs, libres } = listesDe(formulaire);
  const deuxEtapes = aDesCoordonnees(champs);

  const [saisie, setSaisie] = useState<Saisie>({});
  const [erreurs, setErreurs] = useState<Readonly<Record<string, string>>>({});
  const [phase, setPhase] = useState<Phase>(deuxEtapes ? 'coordonnees' : 'complement');
  const [refus, setRefus] = useState<string | null>(null);
  const element = useRef<HTMLFormElement>(null);
  const repere = useRef<HTMLParagraphElement>(null);
  const verifier = useRef<HTMLButtonElement>(null);

  useTurnstile(cleSite);

  useEffect(() => {
    const brouillon = lireBrouillon(jeton);
    if (brouillon === null) return;
    // oxlint-disable-next-line react/set-state-in-effect -- brouillon relu après le premier rendu
    setSaisie(brouillon.saisie);
    if (brouillon.etape === 'complement') setPhase('complement');
  }, [jeton]);

  const etape = etapeDe(phase);
  const rendus = champsRendus(champs, saisie);
  const sections = grouperChamps(rendus, etape);
  const enCours = phase === 'envoi';
  const enRelecture = phase === 'relecture' || phase === 'envoi';

  function retenir(valeurs: Saisie, suivante: Phase): void {
    ecrireBrouillon(jeton, { saisie: valeurs, etape: etapeDe(suivante) });
  }

  function poser(cle: string, probleme: string | undefined): void {
    setErreurs((precedent) => {
      if (probleme !== undefined) return { ...precedent, [cle]: probleme };
      if (!Object.hasOwn(precedent, cle)) return precedent;
      const { [cle]: _ignore, ...reste } = precedent;
      return reste;
    });
  }

  /** Un champ déjà signalé se corrige à la frappe ; un champ muet le reste. */
  function modifier(cle: string, valeur: string): void {
    const valeurs = { ...saisie, [cle]: valeur };
    setSaisie(valeurs);
    if (Object.hasOwn(erreurs, cle)) poser(cle, validerDemande(valeurs, champs, libres)[cle]);
    setPhase((precedent) => (precedent === 'relecture' ? 'complement' : precedent));
    retenir(valeurs, phase);
  }

  /** Le premier signalement attend que le champ soit quitté. */
  function quitter(cle: string): void {
    poser(cle, validerDemande(saisie, champs, libres)[cle]);
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
    if (element.current === null) return '';
    const valeur = new FormData(element.current).get(nom);
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

    try {
      await envoyerDemande(jeton, {
        ...corpsDemande(saisie, champs, libres),
        turnstileToken,
        ...(piege === '' ? {} : { site: piege }),
      });
      effacerBrouillon(jeton);
      setPhase('envoye');
    } catch (error) {
      setRefus(messageDeRefus(error));
      setPhase('relecture');
    }
  }

  function franchir(): void {
    const portee = phase === 'coordonnees' ? 'coordonnees' : 'tout';
    const problemes = validerDemande(saisie, champs, libres, portee);
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

  function soumettre(evenement: FormEvent<HTMLFormElement>): void {
    evenement.preventDefault();
    if (enRelecture) return;
    franchir();
  }

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
        <ComplementDemande
          libres={libres}
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

      <Antirobot cleSite={cleSite} />

      <Refus texte={enRelecture ? null : refus} />

      <ActionsDemande
        premiereEtape={phase === 'coordonnees'}
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
