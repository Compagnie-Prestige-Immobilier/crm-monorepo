'use client';

import { idErreurDe } from '@/components/forms/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface OptionListe {
  readonly value: string;
  readonly label: string;
}

export function Liste({
  id,
  describedBy,
  invalide = false,
  effacable = false,
  items,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  describedBy: string | undefined;
  invalide?: boolean | undefined;
  /** Ajoute « Non renseigné », qui rend la valeur vide. */
  effacable?: boolean | undefined;
  items: readonly OptionListe[];
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const enErreur = invalide || (describedBy?.split(' ').includes(idErreurDe(id)) ?? false);

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null && next !== '') onChange(next);
        else if (effacable) onChange('');
      }}
    >
      <SelectTrigger
        id={id}
        aria-describedby={describedBy}
        aria-invalid={enErreur}
        className="aria-invalid:border-destructive aria-invalid:outline-destructive"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {effacable ? <SelectItem value={null}>Non renseigné</SelectItem> : null}
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
