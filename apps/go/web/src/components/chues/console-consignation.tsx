import { useRouter } from '@tanstack/react-router';
import { ArrowLeftIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { BarreDossier, BarreIssues } from '@/components/chues/console-actions';
import { useConsigner, type Consigner } from '@/components/chues/console-consigner';
import { Commentaire, PanneauEcheance } from '@/components/chues/console-echeance';
import { CarteClavier, EnTeteProspect } from '@/components/chues/console-fiche';
import { ISSUES, RAPPEL_KEY } from '@/components/chues/console-repere';
import { Chrono, copyPhone } from '@/components/chues/console-ui';
import { ConversionFields } from '@/components/chues/conversion-fields';
import { useChampsConversion, type Formulaire } from '@/components/chues/conversion-regles';
import { EnvoiLienFormulaire } from '@/components/chues/envoi-lien';
import { useShortcuts, useVerrouNavigation } from '@/components/chues/hooks';
import { BoutonNoteVocale, useNoteVocale, type NoteVocale } from '@/components/chues/note-vocale';
import { Button } from '@/components/ui/button';
import type { Prospect } from '@/lib/data/console';
import type { OuvertureFiche } from '@/lib/data/ouvertures';
import type { Projet } from '@/lib/types';

/** Les chiffres ne commandent que l'étape visible : sinon « 2 » ferait deux choses. */
function chiffresDe(appel: Consigner): Record<string, () => void> {
  if (appel.etape === 'dossier') return { [RAPPEL_KEY]: appel.ouvrirEcheance };
  if (appel.etape === 'echeance') {
    const map: Record<string, () => void> = {
      '0': () => {
        appel.echeanceRef.current?.focus();
      },
    };
    for (const creneau of appel.creneaux ?? []) {
      map[creneau.key] = () => {
        appel.rappeler(creneau.at);
      };
    }
    return map;
  }
  return Object.fromEntries(
    ISSUES.map((issue) => [
      issue.key,
      () => {
        appel.choisir(issue.outcome);
      },
    ]),
  );
}

/**
 * La consignation d'un appel, en deux temps : d'abord si la personne était
 * joignable, puis, si oui, son dossier et la manière dont elle adhère.
 */
export function Consignation({
  prospect,
  ouverture,
  projet,
  verrouActif,
  onAbandon,
  onEnregistre,
}: {
  prospect: Prospect;
  ouverture: OuvertureFiche | null;
  projet: Projet;
  verrouActif: boolean;
  onAbandon: () => void;
  onEnregistre: (nom: string) => void;
}) {
  const router = useRouter();
  const [aideOuverte, setAideOuverte] = useState(false);
  const [now] = useState(() => Date.now());

  const formulaire = useChampsConversion(projet);
  const note = useNoteVocale();
  const appel = useConsigner({
    prospect,
    ouverture,
    verrouActif,
    formulaire,
    note,
    onAbandon,
    onEnregistre,
  });

  useVerrouNavigation(appel.verrouille, () => {
    toast.error('Consignez l’appel avant de quitter cette fiche.');
  });

  const versRepresentant = (chemin: string): void => {
    const rep = prospect.representantId;
    if (rep !== null) void router.navigate({ href: `/${projet}/${chemin}${rep}` });
  };

  useShortcuts({
    ...chiffresDe(appel),
    Enter: appel.valider,
    Escape: appel.annuler,
    c: () => {
      copyPhone(prospect.phoneE164);
    },
    n: () => {
      versRepresentant('prospects/nouveau?rep=');
    },
    r: () => {
      versRepresentant('representants/');
    },
    '?': () => {
      setAideOuverte((ouverte) => !ouverte);
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {appel.verrouille ? null : (
        <Button variant="ghost" className="self-start px-0" onClick={onAbandon}>
          <ArrowLeftIcon aria-hidden="true" />
          Revenir à la liste
        </Button>
      )}

      {appel.departChrono === null ? null : <Chrono firstInputAt={appel.departChrono} />}

      <section aria-label="Fiche courante" className="flex flex-col gap-4 pb-24">
        <EnTeteProspect prospect={prospect} projet={projet} close={appel.close} />

        <Dossier appel={appel} prospect={prospect} formulaire={formulaire} />
        <Echeance appel={appel} now={now} />
        <Saisie appel={appel} note={note} />
      </section>

      {appel.etape !== 'issues' ? null : (
        <BarreIssues
          issuePosee={appel.issuePosee}
          disabled={appel.enCours}
          onChoisir={appel.choisir}
        />
      )}

      {appel.etape !== 'dossier' ? null : (
        <BarreDossier
          disabled={appel.enCours}
          onEnregistrer={appel.enregistrerAdhesion}
          onRefus={appel.refuser}
          onRappeler={appel.ouvrirEcheance}
          onAnnuler={appel.effacerDossier}
        />
      )}

      <CarteClavier
        avecNavigation={projet === 'chues' && !appel.verrouille}
        ouverte={aideOuverte}
        onOuverte={setAideOuverte}
      />
    </div>
  );
}

function Dossier({
  appel,
  prospect,
  formulaire,
}: {
  appel: Consigner;
  prospect: Prospect;
  formulaire: Formulaire;
}) {
  if (appel.etape !== 'dossier' || appel.conversion === null) return null;

  return (
    <>
      <p className="text-[0.8125rem] font-[600] text-muted-foreground">
        Joignable · son dossier, et la manière dont il adhère
      </p>
      <EnvoiLienFormulaire prospect={prospect} email={appel.conversion.email} />
      <ConversionFields
        draft={appel.conversion}
        errors={appel.erreurs}
        phoneE164={prospect.phoneE164}
        disabled={appel.enCours}
        reglages={formulaire.champs}
        libres={formulaire.libres}
        onChange={appel.appliquer}
      />
      <p className="text-[0.8125rem] text-muted-foreground">
        « À rappeler » garde ce dossier pour le prochain appel. « Annuler » l’efface.
      </p>
    </>
  );
}

function Echeance({ appel, now }: { appel: Consigner; now: number }) {
  if (appel.etape !== 'echeance' || appel.creneaux === null) return null;

  return (
    <PanneauEcheance
      creneaux={appel.creneaux}
      now={now}
      echeanceLibre={appel.echeanceLibre}
      surDossier={appel.conversion !== null}
      disabled={appel.enCours}
      inputRef={appel.echeanceRef}
      onChoisir={appel.rappeler}
      onEcheanceLibre={appel.setEcheanceLibre}
      onValider={appel.valider}
    />
  );
}

function Saisie({ appel, note }: { appel: Consigner; note: NoteVocale }) {
  if (appel.etape === null) return null;

  return (
    <>
      <Commentaire
        value={appel.comment}
        obligatoire={appel.issuePosee === 'OTHER'}
        inputRef={appel.commentRef}
        onChange={appel.setComment}
        onValider={appel.valider}
      />
      <BoutonNoteVocale note={note} disabled={appel.enCours} />
    </>
  );
}
