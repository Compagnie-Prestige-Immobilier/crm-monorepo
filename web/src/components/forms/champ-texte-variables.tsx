'use client';

import { RotateCcwIcon } from 'lucide-react';
import { useRef } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/**
 * Un texte à trous : les mots entre accolades se posent d'un clic, à l'endroit
 * du curseur, et le texte d'origine se rétablit d'un autre. Vide, c'est le
 * texte d'origine qui part.
 */
export function ChampTexteVariables({
  label,
  info,
  valeur,
  usine,
  variables,
  lignes = 4,
  onChange,
}: {
  label: string;
  info?: string | undefined;
  valeur: string;
  usine: string;
  variables: readonly string[];
  lignes?: number;
  onChange: (texte: string) => void;
}) {
  const zone = useRef<HTMLTextAreaElement>(null);

  const inserer = (variable: string) => {
    const champ = zone.current;
    const jeton = `{${variable}}`;
    if (champ === null) {
      onChange(valeur + jeton);
      return;
    }
    const debut = champ.selectionStart;
    const fin = champ.selectionEnd;
    onChange(valeur.slice(0, debut) + jeton + valeur.slice(fin));
    requestAnimationFrame(() => {
      champ.focus();
      champ.setSelectionRange(debut + jeton.length, debut + jeton.length);
    });
  };

  return (
    <Field label={label} info={info}>
      {(props) => (
        <div className="flex flex-col gap-2">
          <Textarea
            {...props}
            ref={zone}
            rows={lignes}
            spellCheck={false}
            value={valeur}
            placeholder={usine}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {variables.map((variable) => (
              <Button
                key={variable}
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 px-2 font-mono text-[0.75rem]"
                onClick={() => {
                  inserer(variable);
                }}
              >
                {`{${variable}}`}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-7"
              disabled={valeur === usine}
              onClick={() => {
                onChange(usine);
              }}
            >
              <RotateCcwIcon className="size-3.5" aria-hidden="true" />
              Texte d’origine
            </Button>
          </div>
        </div>
      )}
    </Field>
  );
}
