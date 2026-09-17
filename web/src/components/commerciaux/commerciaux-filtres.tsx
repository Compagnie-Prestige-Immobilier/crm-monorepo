'use client';

import { SearchIcon, Trash2Icon } from 'lucide-react';
import { useId } from 'react';

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
import { formatNumber } from '@/lib/format';
import { ROLE_LABELS, type Role } from '@/lib/types';
import { useDebouncedSearch } from '@/lib/use-debounced-search';
import { ROLES, type UserFilters } from '@/lib/user-filters';

const TOUS = 'tous';
const ROLE_ITEMS = [
  { value: TOUS, label: 'Tous les rôles' },
  ...ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];
const ETATS = { tous: null, actifs: true, desactives: false } as const;
const ETAT_ITEMS = [
  { value: 'tous', label: 'Tous' },
  { value: 'actifs', label: 'Actifs' },
  { value: 'desactives', label: 'Désactivés' },
] as const;

function valeurEtat(isActive: boolean | null): keyof typeof ETATS {
  if (isActive === null) return 'tous';
  return isActive ? 'actifs' : 'desactives';
}

export function FiltresComptes({
  filters,
  onChange,
}: {
  filters: UserFilters;
  onChange: (patch: Partial<UserFilters>) => void;
}) {
  const searchId = useId();
  const { draft, setDraft } = useDebouncedSearch(filters.search, (search) => {
    onChange({ search });
  });
  const filtre = filters.search !== '' || filters.role !== null || filters.isActive !== null;

  return (
    <section
      aria-label="Filtres"
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      <div className="flex min-w-[min(16rem,100%)] flex-1 flex-col gap-1.5">
        <Label htmlFor={searchId}>Recherche</Label>
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={searchId}
            type="search"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            placeholder="Nom, e-mail, identifiant…"
            className="pl-9"
          />
        </div>
      </div>
      <FiltreListe
        id="role-compte"
        label="Rôle de base"
        items={ROLE_ITEMS}
        value={filters.role ?? TOUS}
        onChange={(value) => {
          onChange({ role: value === TOUS ? null : (value as Role) });
        }}
      />
      <FiltreListe
        id="etat-compte"
        label="État du compte"
        items={ETAT_ITEMS}
        value={valeurEtat(filters.isActive)}
        onChange={(value) => {
          onChange({ isActive: ETATS[value as keyof typeof ETATS] });
        }}
      />
      {filtre ? (
        <Button
          variant="ghost"
          onClick={() => {
            setDraft('');
            onChange({ search: '', role: null, isActive: null });
          }}
        >
          Effacer les filtres
        </Button>
      ) : null}
    </section>
  );
}

function FiltreListe({
  id,
  label,
  items,
  value,
  onChange,
}: {
  id: string;
  label: string;
  items: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex w-48 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function BarreSelection({
  nombre,
  pending,
  onClear,
  onDelete,
}: {
  nombre: number;
  pending: boolean;
  onClear: () => void;
  onDelete: () => void;
}) {
  if (nombre === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-elev-sm">
      <p className="text-[0.875rem]">
        <span className="font-[600] tabular-nums">{formatNumber(nombre)}</span>{' '}
        {nombre === 1 ? 'compte sélectionné' : 'comptes sélectionnés'}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onClear}>
          Tout désélectionner
        </Button>
        <Button variant="destructive" disabled={pending} onClick={onDelete}>
          <Trash2Icon aria-hidden="true" />
          Supprimer
        </Button>
      </div>
    </div>
  );
}
