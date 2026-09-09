import { CalendarRangeIcon } from 'lucide-react';

import {
  estPreset,
  joursDansPlage,
  libellePreset,
  plageDuPreset,
  plageTropLarge,
  PLAGE_MAX_JOURS,
  PRESETS,
  type Plage,
} from '@/components/tableau-de-bord/periode';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AdaptateurFiltres } from '@/lib/filtres-url';
import { lireDate, lireTexte } from '@/lib/filtres-url';
import { formatDate } from '@/lib/format';

export interface FiltresPeriode {
  preset: string;
  du: string;
  au: string;
}

export const adaptateurPeriode = (defaut: string): AdaptateurFiltres<FiltresPeriode> => ({
  lire: (params) => {
    const brut = lireTexte(params, 'periode');
    if (brut === 'libre') {
      const du = lireDate(params, 'du');
      const au = lireDate(params, 'au');
      if (du !== null && au !== null) return { preset: 'libre', du, au };
    }
    const preset = brut !== null && estPreset(brut) ? brut : defaut;
    const plage = plageDuPreset(estPreset(preset) ? preset : 'ce-mois', new Date());
    return { preset, du: plage.du, au: plage.au };
  },
  ecrire: (filtres) => {
    const params = new URLSearchParams();
    params.set('periode', filtres.preset);
    if (filtres.preset === 'libre') {
      params.set('du', filtres.du);
      params.set('au', filtres.au);
    }
    return params;
  },
  efface: () => {
    const plage = plageDuPreset(estPreset(defaut) ? defaut : 'ce-mois', new Date());
    return { preset: defaut, du: plage.du, au: plage.au };
  },
});

export function plageDeFiltres(filtres: FiltresPeriode): Plage {
  if (filtres.preset === 'libre') return { du: filtres.du, au: filtres.au };
  if (estPreset(filtres.preset)) return plageDuPreset(filtres.preset, new Date());
  return { du: filtres.du, au: filtres.au };
}

export function periodeAffichee(filtres: FiltresPeriode): string {
  if (estPreset(filtres.preset)) return libellePreset(filtres.preset);
  return `${formatDate(filtres.du)} – ${formatDate(filtres.au)}`;
}

export function SelecteurPeriode({
  filtres,
  onChange,
}: {
  filtres: FiltresPeriode;
  onChange: (patch: Partial<FiltresPeriode>) => void;
}) {
  const plage = plageDeFiltres(filtres);
  const tropLarge = plageTropLarge(plage);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Période affichée">
        {PRESETS.map((entree) => (
          <Button
            key={entree.preset}
            type="button"
            size="sm"
            variant={filtres.preset === entree.preset ? 'default' : 'outline'}
            aria-pressed={filtres.preset === entree.preset}
            onClick={() => {
              const suivante = plageDuPreset(entree.preset, new Date());
              onChange({ preset: entree.preset, du: suivante.du, au: suivante.au });
            }}
          >
            {entree.label}
          </Button>
        ))}

        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                size="sm"
                variant={filtres.preset === 'libre' ? 'default' : 'outline'}
                aria-pressed={filtres.preset === 'libre'}
              />
            }
          >
            <CalendarRangeIcon aria-hidden="true" />
            Plage libre
          </PopoverTrigger>
          <PopoverContent className="flex w-auto flex-wrap gap-3 p-4" align="start">
            <Field label="Du">
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  className="w-44"
                  value={filtres.du}
                  max={filtres.au}
                  onChange={(evenement) => {
                    if (evenement.target.value !== '') {
                      onChange({ preset: 'libre', du: evenement.target.value });
                    }
                  }}
                />
              )}
            </Field>
            <Field label="Au">
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  className="w-44"
                  value={filtres.au}
                  min={filtres.du}
                  onChange={(evenement) => {
                    if (evenement.target.value !== '') {
                      onChange({ preset: 'libre', au: evenement.target.value });
                    }
                  }}
                />
              )}
            </Field>
          </PopoverContent>
        </Popover>
      </div>

      {tropLarge ? (
        <p className="text-[0.8125rem] text-destructive" role="alert">
          Cette plage dépasse {String(PLAGE_MAX_JOURS)} jours ({String(joursDansPlage(plage))}{' '}
          jours) : revenez à une période plus courte.
        </p>
      ) : null}
    </div>
  );
}
