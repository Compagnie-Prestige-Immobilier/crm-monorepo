'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { SearchField } from '@/components/filters/search-field';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  fetchEmployeurs,
  fetchIncomeBands,
  fetchOffers,
  fetchProfessions,
} from '@/lib/data/reference';
import { saveEmployeur, saveIncomeBand, saveOffer, saveProfession } from '@/lib/data/referentiels';
import { toastApiError } from '@/lib/mutation-feedback';
import {
  EMPLOYEUR_TYPE_LABELS,
  type Employeur,
  type EmployeurType,
  type IncomeBand,
  type Offer,
  type Profession,
} from '@/lib/types';

type Kind = 'professions' | 'incomeBands' | 'offers' | 'employeurs';
type Row = Profession | IncomeBand | Offer | Employeur;

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
} as const;

const EMPLOYEUR_TYPES = Object.keys(EMPLOYEUR_TYPE_LABELS) as EmployeurType[];

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

export function OpenReferentialTab({ kind }: { kind: Kind }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const config = CONFIG[kind];
  const queryKey = ['referentiels', kind] as const;
  const query = useQuery<Row[]>({
    queryKey,
    queryFn: async (): Promise<Row[]> => {
      if (kind === 'professions') return fetchProfessions();
      if (kind === 'incomeBands') return fetchIncomeBands();
      if (kind === 'employeurs') return fetchEmployeurs();
      return fetchOffers();
    },
  });

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      if (kind === 'professions') {
        return saveProfession({
          ...(value.id ? { id: value.id } : {}),
          code: value.code,
          label: value.label,
          isTeaching: value.isTeaching,
          isActive: value.isActive,
        });
      }
      if (kind === 'incomeBands') {
        return saveIncomeBand({
          ...(value.id ? { id: value.id } : {}),
          code: value.code,
          label: value.label,
          ...(value.minXof ? { minXof: Number(value.minXof) } : {}),
          ...(value.maxXof ? { maxXof: Number(value.maxXof) } : {}),
          isActive: value.isActive,
        });
      }
      if (kind === 'employeurs') {
        return saveEmployeur({
          ...(value.id ? { id: value.id } : {}),
          code: value.code,
          label: value.label,
          type: value.type,
          isActive: value.isActive,
        });
      }
      return saveOffer({
        ...(value.id ? { id: value.id } : {}),
        code: value.code,
        label: value.label,
        ...(value.description ? { description: value.description } : {}),
        isActive: value.isActive,
      });
    },
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

  const rows = (query.data ?? []).filter((row) =>
    `${row.code} ${row.label}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')),
  );

  function edit(row: Row): void {
    setDraft({
      id: row.id,
      code: row.code,
      label: row.label,
      isActive: row.isActive,
      isTeaching: 'isTeaching' in row ? row.isTeaching : false,
      minXof: 'minXof' in row && row.minXof !== null ? String(row.minXof) : '',
      maxXof: 'maxXof' in row && row.maxXof !== null ? String(row.maxXof) : '',
      description: 'description' in row ? (row.description ?? '') : '',
      type: 'type' in row ? row.type : 'MINISTERE',
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
              <TableHead>Code</TableHead>
              <TableHead>Libellé</TableHead>
              {kind === 'employeurs' ? <TableHead>Type</TableHead> : null}
              <TableHead>État</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-[600]">{row.code}</TableCell>
                <TableCell>{row.label}</TableCell>
                {kind === 'employeurs' ? (
                  <TableCell>{'type' in row ? EMPLOYEUR_TYPE_LABELS[row.type] : ''}</TableCell>
                ) : null}
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
              {kind === 'employeurs' ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="employeur-type">Type</Label>
                  <select
                    id="employeur-type"
                    value={draft.type}
                    className="h-11 rounded-md border border-input bg-background px-3 text-[0.875rem]"
                    onChange={(event) => {
                      setDraft({ ...draft, type: event.target.value as EmployeurType });
                    }}
                  >
                    {EMPLOYEUR_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {EMPLOYEUR_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {kind === 'professions' ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.isTeaching}
                    onChange={(event) => {
                      setDraft({ ...draft, isTeaching: event.target.checked });
                    }}
                  />
                  Profession enseignante
                </label>
              ) : null}
              {kind === 'incomeBands' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="income-min">Minimum FCFA</Label>
                    <Input
                      id="income-min"
                      type="number"
                      min="0"
                      value={draft.minXof}
                      onChange={(event) => {
                        setDraft({ ...draft, minXof: event.target.value });
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
                        setDraft({ ...draft, maxXof: event.target.value });
                      }}
                    />
                  </div>
                </div>
              ) : null}
              {kind === 'offers' ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="offer-description">Description</Label>
                  <Input
                    id="offer-description"
                    value={draft.description}
                    onChange={(event) => {
                      setDraft({ ...draft, description: event.target.value });
                    }}
                  />
                </div>
              ) : null}
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
