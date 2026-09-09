import type { RefObject } from 'react';

import { Kbd } from '@/components/chues/console-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatCallbackAt, type CreneauRappel } from '@/lib/data/callbacks';

/** L'échéance s'ouvre aussi PAR-DESSUS un dossier déjà rempli. */
export function PanneauEcheance({
  creneaux,
  now,
  echeanceLibre,
  surDossier,
  disabled,
  inputRef,
  onChoisir,
  onEcheanceLibre,
  onValider,
}: {
  creneaux: readonly CreneauRappel[];
  now: number;
  echeanceLibre: string;
  surDossier: boolean;
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onChoisir: (at: string) => void;
  onEcheanceLibre: (value: string) => void;
  onValider: () => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="pb-2 text-[0.75rem] font-[600] tracking-[0.08em] text-muted-foreground uppercase">
        Quand rappeler
      </legend>
      {surDossier ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          Vous retrouverez le dossier déjà rempli au prochain appel.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {creneaux.map((creneau) => (
          <Button
            key={creneau.key}
            variant="outline"
            className="h-auto flex-col items-start gap-0.5 py-2"
            onClick={() => {
              onChoisir(creneau.at);
            }}
          >
            <span className="flex items-center gap-2">
              <Kbd>{creneau.key}</Kbd>
              {creneau.label}
            </span>
            <span className="text-[0.75rem] font-[400] text-muted-foreground md:pl-7">
              {formatCallbackAt(creneau.at, now)}
            </span>
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="console-callback-at"
          className="flex items-center gap-2 text-[0.875rem] font-[600]"
        >
          <Kbd>0</Kbd>
          Autre échéance
        </label>
        <Input
          id="console-callback-at"
          ref={inputRef}
          type="datetime-local"
          className="max-w-64"
          value={echeanceLibre}
          onChange={(evenement) => {
            onEcheanceLibre(evenement.target.value);
          }}
          onKeyDown={(evenement) => {
            if (evenement.key !== 'Enter') return;
            evenement.preventDefault();
            onValider();
          }}
        />
        <p className="text-[0.75rem] text-muted-foreground">
          Heure de Dakar (UTC+0), quel que soit le fuseau de ce poste.
        </p>
      </div>
    </fieldset>
  );
}

export function Commentaire({
  value,
  obligatoire,
  inputRef,
  onChange,
  onValider,
}: {
  value: string;
  obligatoire: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onValider: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="console-comment" className="text-[0.875rem] font-[600]">
        Commentaire
        {obligatoire ? ' (obligatoire pour Autre)' : ''}
      </label>
      <Textarea
        id="console-comment"
        ref={inputRef}
        value={value}
        onChange={(evenement) => {
          onChange(evenement.target.value);
        }}
        onKeyDown={(evenement) => {
          if (evenement.key !== 'Enter' || evenement.shiftKey) return;
          evenement.preventDefault();
          onValider();
        }}
        placeholder="Entrée valide, Maj+Entrée passe à la ligne."
      />
    </div>
  );
}
