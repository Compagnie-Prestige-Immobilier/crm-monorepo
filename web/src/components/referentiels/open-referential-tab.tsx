'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { SearchField } from '@/components/filters/search-field';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTriLocal } from '@/components/ui/tri-local';
import {
  fetchEmployeurs,
  fetchIncomeBands,
  fetchOffers,
  fetchProfessions,
  fetchReferentielComplet,
} from '@/lib/data/reference';
import {
  saveEmployeur,
  saveIncomeBand,
  saveOffer,
  saveProfession,
  saveReferentiel,
} from '@/lib/data/referentiels';
import { toastApiError } from '@/lib/mutation-feedback';
import { EMPLOYEUR_TYPE_LABELS, type EmployeurType, type Profession } from '@/lib/types';

type Kind = 'professions' | 'incomeBands' | 'offers' | 'employeurs' | 'pointsRencontre';
/** Profession, tranche de revenu, offre et employeur partagent le même `ReferentielsItem` côté Go. */
type Row = Profession;

/** Les intitulés sont écrits, pas fabriqués : « Nouvelle employeur » se lisait. */
const CONFIG = {
  professions: {
    creer: 'Nouvelle profession',
    modifier: 'Modifier la profession',
    enregistre: 'Profession enregistrée.',
  },
  incomeBands: {
    creer: 'Nouvelle tranche',
    modifier: 'Modifier la tranche',
    enregistre: 'Tranche enregistrée.',
  },
  offers: {
    creer: 'Nouvelle offre',
    modifier: 'Modifier l’offre',
    enregistre: 'Offre enregistrée.',
  },
  employeurs: {
    creer: 'Nouvel employeur',
    modifier: 'Modifier l’employeur',
    enregistre: 'Employeur enregistré.',
  },
  pointsRencontre: {
    creer: 'Nouveau point de rencontre',
    modifier: 'Modifier le point de rencontre',
    enregistre: 'Point de rencontre enregistré.',
  },
} as const;

const EMPLOYEUR_TYPES = Object.keys(EMPLOYEUR_TYPE_LABELS) as EmployeurType[];

function employeurTypeLabel(row: Row): string {
  if (!('type' in row) || row.type === null) return '';
  return EMPLOYEUR_TYPE_LABELS[row.type as EmployeurType] ?? '';
}

const COLONNES_OPEN = {
  code: (row: Row) => row.code,
  label: (row: Row) => row.label,
  type: (row: Row) => employeurTypeLabel(row),
  isActive: (row: Row) => row.isActive,
};

const ENTETES_OPEN = [
  { id: 'code', label: 'Code' },
  { id: 'label', label: 'Libellé' },
  { id: 'type', label: 'Type' },
  { id: 'isActive', label: 'État' },
] as const;

interface Draft {
  id?: string;
  code: string;
  label: string;
  isActive: boolean;
  isTeaching: boolean;
  minXof: string;
  maxXof: string;
  description: string;
  type: EmployeurType;
}

function KindSpecificFields({
  kind,
  draft,
  onChange,
}: {
  kind: Kind;
  draft: Draft;
  onChange: (draft: Draft) => void;
}) {
  if (kind === 'employeurs') {
    return (
      <div className="grid gap-1.5">
        <Label htmlFor="employeur-type">Type</Label>
        <select
          id="employeur-type"
          value={draft.type}
          className="h-11 rounded-md border border-input bg-background px-3 text-[0.875rem]"
          onChange={(event) => {
            onChange({ ...draft, type: event.target.value as EmployeurType });
          }}
        >
          {EMPLOYEUR_TYPES.map((type) => (
            <option key={type} value={type}>
              {EMPLOYEUR_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (kind === 'professions') {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={draft.isTeaching}
          onChange={(event) => {
            onChange({ ...draft, isTeaching: event.target.checked });
          }}
        />
        Profession enseignante
      </label>
    );
  }
  if (kind === 'incomeBands') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="income-min">Minimum FCFA</Label>
          <Input
            id="income-min"
            type="number"
            min="0"
            value={draft.minXof}
            onChange={(event) => {
              onChange({ ...draft, minXof: event.target.value });
            }}
          />
        </div>
        <div>
          <Label htmlFor="income-max">Maximum FCFA</Label>
          <Input
            id="income-max"
            type="number"
            min="0"
            value={draft.maxXof}
            onChange={(event) => {
              onChange({ ...draft, maxXof: event.target.value });
            }}
          />
        </div>
      </div>
    );
  }
  if (kind === 'offers') {
    return (
      <div className="grid gap-1.5">
        <Label htmlFor="offer-description">Description</Label>
        <Input
          id="offer-description"
          value={draft.description}
          onChange={(event) => {
            onChange({ ...draft, description: event.target.value });
          }}
        />
      </div>
    );
  }
  return null;
}

const EMPTY: Draft = {
  code: '',
  label: '',
  isActive: true,
  isTeaching: false,
  minXof: '',
  maxXof: '',
  description: '',
  type: 'MINISTERE',
};

const FETCHERS: Record<Kind, () => Promise<Row[]>> = {
  professions: fetchProfessions,
  incomeBands: fetchIncomeBands,
  employeurs: fetchEmployeurs,
  offers: fetchOffers,
  pointsRencontre: () => fetchReferentielComplet('points-rencontre'),
};

const SAVERS: Record<Kind, (value: Draft) => Promise<Row>> = {
  professions: (value) =>
    saveProfession({
      ...(value.id ? { id: value.id } : {}),
      code: value.code,
      label: value.label,
      isTeaching: value.isTeaching,
      isActive: value.isActive,
    }),
  incomeBands: (value) =>
    saveIncomeBand({
      ...(value.id ? { id: value.id } : {}),
      code: value.code,
      label: value.label,
      ...(value.minXof ? { minXof: Number(value.minXof) } : {}),
      ...(value.maxXof ? { maxXof: Number(value.maxXof) } : {}),
      isActive: value.isActive,
    }),
  employeurs: (value) =>
    saveEmployeur({
      ...(value.id ? { id: value.id } : {}),
      code: value.code,
      label: value.label,
      type: value.type,
      isActive: value.isActive,
    }),
  pointsRencontre: (value) =>
    saveReferentiel('points-rencontre', {
      ...(value.id ? { id: value.id } : {}),
      code: value.code,
      label: value.label,
      isActive: value.isActive,
    }),
  offers: (value) =>
    saveOffer({
      ...(value.id ? { id: value.id } : {}),
      code: value.code,
      label: value.label,
      ...(value.description ? { description: value.description } : {}),
      isActive: value.isActive,
    }),
};

export function OpenReferentialTab({ kind }: { kind: Kind }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const config = CONFIG[kind];
  const queryKey = ['referentiels', kind] as const;
  const query = useQuery<Row[]>({
    queryKey,
    queryFn: () => FETCHERS[kind](),
  });

  const save = useMutation({
    mutationFn: (value: Draft) => SAVERS[kind](value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['reference'] });
      setDraft(null);
      toast.success(config.enregistre);
    },
    onError: (error) => {
      toastApiError(error, 'Enregistrement impossible.');
    },
  });

  if (query.isError) {
    return <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const rows = (query.data ?? []).filter((row) =>
    `${row.code} ${row.label}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')),
  );
  const tri = useTriLocal(rows, COLONNES_OPEN);
  const entetes = ENTETES_OPEN.filter((entete) => entete.id !== 'type' || kind === 'employeurs');

  function edit(row: Row): void {
    setDraft({
      id: row.id,
      code: row.code ?? '',
      label: row.label ?? '',
      isActive: row.isActive ?? false,
      isTeaching: row.isTeaching === true,
      minXof: row.minXof === null ? '' : String(row.minXof),
      maxXof: row.maxXof === null ? '' : String(row.maxXof),
      description: row.description ?? '',
      type: (row.type as EmployeurType | null) ?? 'MINISTERE',
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SearchField
          label="Rechercher"
          placeholder="Code ou libellé"
          value={search}
          onChange={setSearch}
        />
        <Button
          onClick={() => {
            setDraft({ ...EMPTY });
          }}
        >
          <PlusIcon aria-hidden="true" /> {config.creer}
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {entetes.map((colonne) => (
                <SortableTableHead
                  key={colonne.id}
                  column={colonne}
                  sortBy={tri.sortBy}
                  sortDir={tri.sortDir}
                  onToggle={tri.toggle}
                />
              ))}
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tri.lignes.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-[600]">{row.code}</TableCell>
                <TableCell>{row.label}</TableCell>
                {kind === 'employeurs' ? <TableCell>{employeurTypeLabel(row)}</TableCell> : null}
                <TableCell>{row.isActive ? 'Active' : 'Retirée'}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Modifier ${row.label}`}
                    onClick={() => {
                      edit(row);
                    }}
                  >
                    <PencilIcon aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? config.modifier : config.creer}</DialogTitle>
            <DialogDescription>Ces valeurs sont proposées dans les formulaires.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor={`${kind}-code`}>Code</Label>
                <Input
                  id={`${kind}-code`}
                  value={draft.code}
                  onChange={(event) => {
                    setDraft({
                      ...draft,
                      code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/gu, '_'),
                    });
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`${kind}-label`}>Libellé</Label>
                <Input
                  id={`${kind}-label`}
                  value={draft.label}
                  onChange={(event) => {
                    setDraft({ ...draft, label: event.target.value });
                  }}
                />
              </div>
              <KindSpecificFields kind={kind} draft={draft} onChange={setDraft} />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(event) => {
                    setDraft({ ...draft, isActive: event.target.checked });
                  }}
                />
                Active
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDraft(null);
              }}
            >
              Annuler
            </Button>
            <Button
              disabled={!draft?.code || !draft.label || save.isPending}
              onClick={() => {
                if (draft) save.mutate(draft);
              }}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
