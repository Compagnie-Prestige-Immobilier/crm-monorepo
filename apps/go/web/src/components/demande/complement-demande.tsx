import type { RefObject } from 'react';

import { ChampAjoute } from '@/components/demande/champs-demande';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import {
  MESSAGE_MAX,
  cleLibre,
  type ChampLibrePublic,
  type Saisie,
} from '@/lib/data/formulaire-public-champs';
import { cn } from '@/lib/utils';

/** Ce que l'étape 2 ajoute aux sections réglées : les champs libres et le message. */
export function ComplementDemande({
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
 * Collées en bas sur mobile : sans cela le bouton d'étape vit sous dix champs
 * et se gagne au défilement.
 */
export function ActionsDemande({
  premiereEtape,
  deuxEtapes,
  verifier,
  onRetour,
}: {
  premiereEtape: boolean;
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
      {premiereEtape ? (
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
              className="w-full sm:w-auto"
              onClick={onRetour}
            >
              Retour
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
