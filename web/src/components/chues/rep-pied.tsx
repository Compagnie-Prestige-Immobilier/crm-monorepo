import { ArrowLeftIcon, PencilIcon } from 'lucide-react';

import { Chrono, Kbd } from '@/components/chues/console-ui';
import {
  EnTeteRepresentant,
  HistoriqueAppels,
  RecapAppel,
  type RecapAppelProps,
} from '@/components/chues/rep-recap';
import { FormulaireRepresentant } from '@/components/representants/formulaire';
import { Button } from '@/components/ui/button';
import type { Representant } from '@/lib/data/representants';

const CARTE_CLAVIER: readonly (readonly [string, string])[] = [
  ['C', 'Copier le numéro'],
  ['E', 'Corriger la fiche'],
  ['Échap', 'Revenir en arrière'],
  ['?', 'Afficher cette carte'],
];

/** Le retour en arrière, le chronomètre, la fiche et ses appels précédents. */
export function EnTeteEtape({
  representant,
  etape,
  verrouActif,
  departChrono,
  onReculer,
  onAbandon,
}: {
  representant: Representant;
  etape: 1 | 2;
  verrouActif: boolean;
  departChrono: string | null;
  onReculer: () => void;
  onAbandon: () => void;
}) {
  const retour = etape === 2 ? onReculer : onAbandon;
  const libelleRetour = etape === 2 ? 'Étape précédente' : 'Revenir à la liste';
  const retourVisible = etape === 2 || !verrouActif;

  return (
    <>
      {retourVisible ? (
        <Button variant="ghost" className="self-start px-0" onClick={retour}>
          <ArrowLeftIcon aria-hidden="true" />
          {libelleRetour}
        </Button>
      ) : null}

      {departChrono === null ? null : <Chrono firstInputAt={departChrono} />}

      <EnTeteRepresentant representant={representant} />

      {representant.callAttemptCount === 0 ? null : (
        <HistoriqueAppels representantId={representant.id} />
      )}

      <p className="text-[0.8125rem] font-[600] text-muted-foreground">
        Étape {etape} sur 2 ·{' '}
        {etape === 1 ? 'Comment s’est passé l’appel ?' : 'Quelque chose à ajouter ?'}
      </p>
    </>
  );
}

/** La deuxième étape : ce qui va partir, puis le seul bouton qui l'envoie. */
export function EtapeRecap({
  recap,
  bloque,
  onEnregistrer,
}: {
  recap: RecapAppelProps;
  bloque: boolean;
  onEnregistrer: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 pb-20">
      <RecapAppel {...recap} />
      <div className="sticky bottom-0 -mx-1 border-t border-border bg-background px-1 py-3">
        <Button disabled={bloque} onClick={onEnregistrer}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

/** La fiche se corrige SANS quitter l'appel : le verrou interdit d'en sortir. */
export function PiedQualification({
  representant,
  aideOuverte,
  edition,
  onAide,
  onEdition,
}: {
  representant: Representant;
  aideOuverte: boolean;
  edition: boolean;
  onAide: (ouverte: boolean) => void;
  onEdition: (ouvert: boolean) => void;
}) {
  return (
    <>
      <details
        open={aideOuverte}
        className="max-md:hidden"
        onToggle={(evenement) => {
          onAide(evenement.currentTarget.open);
        }}
      >
        <summary className="cursor-pointer list-none text-[0.8125rem] text-muted-foreground">
          Carte clavier <Kbd>?</Kbd>
        </summary>
        <dl className="mt-2 flex flex-col gap-1 text-[0.8125rem]">
          {CARTE_CLAVIER.map(([touche, quoi]) => (
            <div key={touche} className="flex items-baseline gap-2">
              <dt className="w-24 shrink-0 font-[600]">{touche}</dt>
              <dd className="text-muted-foreground">{quoi}</dd>
            </div>
          ))}
        </dl>
      </details>

      <Button
        variant="ghost"
        className="self-start px-0 text-[0.8125rem]"
        onClick={() => {
          onEdition(true);
        }}
      >
        <PencilIcon aria-hidden="true" />
        Corriger la fiche
        <Kbd>E</Kbd>
      </Button>

      {edition ? (
        <FormulaireRepresentant open onOpenChange={onEdition} representant={representant} />
      ) : null}
    </>
  );
}
