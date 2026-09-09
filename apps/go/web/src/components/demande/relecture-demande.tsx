import { AlertCircleIcon, LoaderIcon } from 'lucide-react';
import type { RefObject } from 'react';

import { valeurLisible } from '@/components/demande/options-demande';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  cleLibre,
  type FormulairePublic,
  type ReglageChampPublic,
  type Saisie,
} from '@/lib/data/formulaire-public-champs';

export function Refus({ texte }: { texte: string | null }) {
  if (texte === null) return null;
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
    ...(formulaire.libres ?? []).map((libre) => ({
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

/**
 * La fenêtre est PORTÉE hors du formulaire : ses boutons ne peuvent pas le
 * soumettre, et l'envoi passe par `onEnvoyer`.
 */
export function FenetreRelecture({
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
          <div className="mt-4 empty:mt-0">
            <Refus texte={refus} />
          </div>
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
