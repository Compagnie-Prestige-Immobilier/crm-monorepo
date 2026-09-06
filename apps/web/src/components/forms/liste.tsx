'use client';

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
  items,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  describedBy: string | undefined;
  invalide?: boolean | undefined;
  items: readonly OptionListe[];
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next === null || next === '') return;
        onChange(next);
      }}
    >
      <SelectTrigger
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalide}
        className="aria-invalid:border-destructive aria-invalid:outline-destructive"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
