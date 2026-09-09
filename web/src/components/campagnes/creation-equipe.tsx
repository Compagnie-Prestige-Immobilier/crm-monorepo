import { useId } from 'react';

import { capaciteDeDefaut } from '@/components/campagnes/cibles';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Compte } from '@/lib/data/users';
import { apiErrorText } from '@/lib/mutation-feedback';
import { cn } from '@/lib/utils';

export function ChampTeleconseillers({
  comptes,
  chargement,
  erreur,
  decoches,
  onChange,
  objectifs,
  onObjectif,
  defaut,
}: {
  comptes: readonly Compte[];
  chargement: boolean;
  erreur: unknown;
  decoches: readonly string[];
  onChange: (decoches: readonly string[]) => void;
  objectifs: Readonly<Record<string, string>>;
  onObjectif: (id: string, saisie: string) => void;
  defaut: number;
}) {
  const aide = useId();
  const toutCoche = comptes.some((compte) => !decoches.includes(compte.id));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-[600]">Téléconseillers</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={aide} className="text-[0.75rem] text-muted-foreground">
          L’ordre de la liste est l’ordre de distribution. L’objectif est le nombre de fiches à
          traiter par jour.
        </p>
        {comptes.length > 0 ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => {
              onChange(toutCoche ? comptes.map((compte) => compte.id) : []);
            }}
          >
            {toutCoche ? 'Tout décocher' : 'Tout cocher'}
          </Button>
        ) : null}
      </div>

      {chargement ? <Skeleton className="h-32 w-full" /> : null}

      {!chargement && erreur !== null ? (
        <output className="block rounded-md bg-muted px-3 py-4 text-[0.8125rem]">
          {apiErrorText(erreur, 'Les téléconseillers n’ont pas pu être lus.')}
        </output>
      ) : null}

      {!chargement && erreur === null && comptes.length === 0 ? (
        <output className="block rounded-md bg-muted px-3 py-4 text-[0.8125rem]">
          Aucun compte téléconseiller actif. Créez-en un depuis l’écran Téléconseillers.
        </output>
      ) : null}

      {comptes.length === 0 ? null : (
        <ul className="scrollbar-thin flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border border-border p-1">
          {comptes.map((compte) => {
            const coche = !decoches.includes(compte.id);
            return (
              <li key={compte.id}>
                <label
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-[0.875rem]',
                    'transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
                    coche ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={coche}
                    aria-describedby={aide}
                    className="size-4 shrink-0 accent-primary"
                    onChange={() => {
                      onChange(
                        coche
                          ? [...decoches, compte.id]
                          : decoches.filter((id) => id !== compte.id),
                      );
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">{compte.fullName}</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    step={1}
                    disabled={!coche}
                    aria-label={`Objectif quotidien de ${compte.fullName}`}
                    placeholder={String(capaciteDeDefaut(compte.role, defaut))}
                    value={objectifs[compte.id] ?? ''}
                    className="h-9 w-20 rounded-sm border border-border bg-background px-2 text-right tabular-nums"
                    onClick={(event) => {
                      event.preventDefault();
                    }}
                    onChange={(event) => {
                      onObjectif(compte.id, event.target.value);
                    }}
                  />
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
