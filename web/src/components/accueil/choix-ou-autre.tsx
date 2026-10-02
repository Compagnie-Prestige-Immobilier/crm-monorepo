'use client';

import { useId, useState } from 'react';

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

const AUTRE = 'Autre, à préciser';

/** Une liste courte ; « Autre, à préciser » ouvre un champ libre dont le texte devient la valeur. */
export function ChoixOuAutre({
  label,
  options,
  autre: autreOuvert,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  autre: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [autre, setAutre] = useState(autreOuvert && value !== '' && !options.includes(value));
  const items = (autreOuvert ? [...options, AUTRE] : options).map((option) => ({
    value: option,
    label: option,
  }));
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={autre ? AUTRE : value || null}
        onValueChange={(choix) => {
          setAutre(choix === AUTRE);
          onChange(choix === AUTRE || choix === null ? '' : choix);
        }}
      >
        <SelectTrigger id={id} size="sm" className="w-full">
          <SelectValue placeholder="Sélectionner" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {autre ? (
        <Input
          className="h-9"
          aria-label={`${label}, précision`}
          value={value}
          maxLength={120}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      ) : null}
    </div>
  );
}

/** Les mêmes choix en tuiles, pour une réponse qu'on lit d'un coup d'œil. */
export function Tuiles({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [autre, setAutre] = useState(value !== '' && !options.includes(value));
  return (
    <fieldset className="grid gap-2 sm:col-span-2">
      <legend className="mb-1.5 text-[0.9375rem] font-[600]">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {[...options, AUTRE].map((option) => {
          const actif = option === AUTRE ? autre : !autre && value === option;
          return (
            <Button
              key={option}
              type="button"
              variant={actif ? 'default' : 'outline'}
              aria-pressed={actif}
              className="h-auto min-h-11 justify-start px-3 py-2 text-left"
              onClick={() => {
                setAutre(option === AUTRE);
                onChange(option === AUTRE || actif ? '' : option);
              }}
            >
              {option}
            </Button>
          );
        })}
      </div>
      {autre ? (
        <Input
          className="h-9"
          aria-label={`${label}, précision`}
          value={value}
          maxLength={120}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      ) : null}
    </fieldset>
  );
}
