import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { CheckIcon } from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { ROLE_LABELS } from '@/lib/types';
import { FILTRES_COMPTES_VIDES, fetchComptes, type Compte } from '@/lib/data/users';

function toggle(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}

function compteLabel(count: number): string {
  if (count === 0) return 'Aucun compte choisi.';
  return `${String(count)} compte${count > 1 ? 's' : ''} choisi${count > 1 ? 's' : ''}.`;
}

function ComptesListe({
  comptes,
  selected,
  onChange,
}: {
  comptes: UseQueryResult<{ items: Compte[] }>;
  selected: readonly string[];
  onChange: (ids: string[]) => void;
}) {
  if (comptes.isPending) return <CommandEmpty>Chargement…</CommandEmpty>;
  if (comptes.isError) return <CommandEmpty>Les comptes n’ont pas pu être chargés.</CommandEmpty>;
  if (comptes.data.items.length === 0) return <CommandEmpty>Aucun compte actif.</CommandEmpty>;

  return (
    <CommandGroup>
      {comptes.data.items.map((compte) => {
        const checked = selected.includes(compte.id);
        return (
          <CommandItem
            key={compte.id}
            value={`${compte.fullName} ${compte.username} ${compte.email}`}
            onSelect={() => {
              onChange(toggle(selected, compte.id));
            }}
          >
            <span
              aria-hidden="true"
              className="flex size-4 items-center justify-center rounded-sm border border-input-border"
            >
              {checked ? <CheckIcon className="size-3" /> : null}
            </span>
            <span className="min-w-0 flex-1 truncate">{compte.fullName}</span>
            <span className="text-[0.75rem] text-muted-foreground">{ROLE_LABELS[compte.role]}</span>
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}

export function UserPicker({
  selected,
  onChange,
}: {
  selected: readonly string[];
  onChange: (ids: string[]) => void;
}) {
  const comptes = useQuery({
    queryKey: ['notifications-admin', 'comptes-actifs'],
    queryFn: () => fetchComptes({ ...FILTRES_COMPTES_VIDES, isActive: true, pageSize: 200 }),
  });

  return (
    <div className="flex flex-col gap-2">
      <Label>Comptes choisis</Label>
      <p className="text-[0.75rem] text-muted-foreground">{compteLabel(selected.length)}</p>

      <Command className="rounded-md border border-border">
        <CommandInput placeholder="Rechercher un compte…" />
        <CommandList>
          <ComptesListe comptes={comptes} selected={selected} onChange={onChange} />
        </CommandList>
      </Command>
    </div>
  );
}
