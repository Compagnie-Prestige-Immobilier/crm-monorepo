import { FAMILLE_LABELS, type Famille } from '@/components/supervision/colonnes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  aujourdhui,
  periodeDuPreset,
  PRESET_LABELS,
  type Granularite,
  type Periode,
  type Preset,
} from '@/lib/data/supervision';

const PRESETS: Exclude<Preset, 'custom'>[] = ['today', 'week', 'last7'];

function ChampDate({
  id,
  label,
  valeur,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  valeur: string;
  min?: string | undefined;
  max?: string | undefined;
  onChange: (valeur: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        value={valeur}
        min={min}
        max={max}
        onChange={(event) => {
          onChange(event.target.value === '' ? aujourdhui() : event.target.value);
        }}
      />
    </div>
  );
}

function Bascule<T extends string>({
  valeurs,
  actif,
  libelle,
  onChange,
}: {
  valeurs: readonly T[];
  actif: T;
  libelle: (valeur: T) => string;
  onChange: (valeur: T) => void;
}) {
  if (valeurs.length < 2) return null;
  return (
    <span className="inline-flex overflow-hidden rounded-md border border-border">
      {valeurs.map((valeur) => (
        <Button
          key={valeur}
          variant={actif === valeur ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none"
          aria-pressed={actif === valeur}
          onClick={() => {
            onChange(valeur);
          }}
        >
          {libelle(valeur)}
        </Button>
      ))}
    </span>
  );
}

export function BarreActivite({
  familles,
  famille,
  onFamille,
  preset,
  onPreset,
  periode,
  onPeriode,
  granularite,
  onGranularite,
}: {
  familles: readonly Famille[];
  famille: Famille;
  onFamille: (famille: Famille) => void;
  preset: Preset;
  onPreset: (preset: Preset) => void;
  periode: Periode;
  onPeriode: (periode: Periode) => void;
  granularite: Granularite;
  onGranularite: (granularite: Granularite) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((valeur) => (
          <Button
            key={valeur}
            variant={preset === valeur ? 'default' : 'outline'}
            size="sm"
            aria-pressed={preset === valeur}
            onClick={() => {
              onPreset(valeur);
              onPeriode(periodeDuPreset(valeur));
            }}
          >
            {PRESET_LABELS[valeur]}
          </Button>
        ))}
        <Button
          variant={preset === 'custom' ? 'default' : 'outline'}
          size="sm"
          aria-pressed={preset === 'custom'}
          onClick={() => {
            onPreset('custom');
          }}
        >
          {PRESET_LABELS.custom}
        </Button>

        <span className="ml-auto flex flex-wrap items-center gap-2">
          <Bascule
            valeurs={familles}
            actif={famille}
            libelle={(valeur) => FAMILLE_LABELS[valeur]}
            onChange={onFamille}
          />
          <Bascule
            valeurs={['day', 'week'] as const}
            actif={granularite}
            libelle={(valeur) => (valeur === 'day' ? 'Par jour' : 'Par semaine')}
            onChange={onGranularite}
          />
        </span>
      </div>

      {preset === 'custom' ? (
        <div className="flex flex-wrap items-end gap-3">
          <ChampDate
            id="activite-du"
            label="Du"
            valeur={periode.from}
            max={periode.to}
            onChange={(from) => {
              onPeriode({ from, to: periode.to });
            }}
          />
          <ChampDate
            id="activite-au"
            label="Au"
            valeur={periode.to}
            min={periode.from}
            onChange={(to) => {
              onPeriode({ from: periode.from, to });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
