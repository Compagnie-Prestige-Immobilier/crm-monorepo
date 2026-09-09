import { Trash2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LIBELLES_TYPE_CHAMP,
  TYPES_CHAMP_LIBRE,
  type ChampLibre,
  type TypeChampLibre,
} from '@/lib/data/champs-conversion';

const OPTIONS_TYPE = TYPES_CHAMP_LIBRE.map((valeur) => ({
  value: valeur,
  label: LIBELLES_TYPE_CHAMP[valeur],
}));

const decouper = (brut: string): string[] =>
  brut
    .split(',')
    .map((valeur) => valeur.trim())
    .filter((valeur) => valeur !== '');

export function ChampsLibres({
  libres,
  onChange,
}: {
  libres: readonly ChampLibre[];
  onChange: (suivants: readonly ChampLibre[]) => void;
}) {
  const majLibre = (index: number, patch: Partial<ChampLibre>): void => {
    onChange(libres.map((champ, rang) => (rang === index ? { ...champ, ...patch } : champ)));
  };

  return (
    <>
      {libres.map((champ, index) => (
        <div
          key={champ.id}
          className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-end"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor={`libelle-${champ.id}`}>Libellé</Label>
            <Input
              id={`libelle-${champ.id}`}
              value={champ.libelle}
              onChange={(event) => {
                majLibre(index, { libelle: event.target.value });
              }}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 sm:w-52">
            <Label htmlFor={`type-${champ.id}`}>Type</Label>
            <Select
              items={OPTIONS_TYPE}
              value={champ.type}
              onValueChange={(valeur) => {
                if (typeof valeur === 'string') majLibre(index, { type: valeur as TypeChampLibre });
              }}
            >
              <SelectTrigger id={`type-${champ.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPTIONS_TYPE.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {champ.type === 'LISTE' ? (
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label htmlFor={`options-${champ.id}`}>Valeurs, séparées par une virgule</Label>
              <Input
                id={`options-${champ.id}`}
                value={(champ.options ?? []).join(', ')}
                onChange={(event) => {
                  majLibre(index, { options: decouper(event.target.value) });
                }}
              />
            </div>
          ) : null}

          <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem]">
            <input
              type="checkbox"
              checked={champ.obligatoire}
              className="size-4 accent-[var(--primary)]"
              onChange={(event) => {
                majLibre(index, { obligatoire: event.target.checked });
              }}
            />
            Obligatoire
          </label>

          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Retirer ${champ.libelle === '' ? 'ce champ' : champ.libelle}`}
            onClick={() => {
              onChange(libres.filter((_, rang) => rang !== index));
            }}
          >
            <Trash2Icon aria-hidden="true" />
          </Button>
        </div>
      ))}
    </>
  );
}
