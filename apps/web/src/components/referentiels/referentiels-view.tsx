'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  InboxIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { SearchField } from '@/components/filters/search-field';
import { DeactivateReferentielDialog } from '@/components/referentiels/deactivate-dialog';
import { OpenReferentialTab } from '@/components/referentiels/open-referential-tab';
import {
  BanqueFormDialog,
  DepartementFormDialog,
  SyndicatFormDialog,
} from '@/components/referentiels/referentiel-form-dialog';
import { Badge } from '@/components/ui/badge';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchBanques, fetchDepartements, fetchSyndicats } from '@/lib/data/reference';
import {
  fetchReferentielUsage,
  updateBanque,
  updateDepartement,
  updateSyndicat,
  type UsageCounts,
} from '@/lib/data/referentiels';
import { formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Banque, Departement, Syndicat } from '@/lib/types';
import { cn } from '@/lib/utils';

const TABS = [
  'banques',
  'syndicats',
  'departements',
  'professions',
  'employeurs',
  'incomeBands',
  'offers',
] as const;

type ReferentielTab = (typeof TABS)[number];

export function ReferentielsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab: ReferentielTab = useMemo(() => {
    const raw = searchParams.get('onglet');
    return (TABS as readonly string[]).includes(raw ?? '') ? (raw as ReferentielTab) : 'banques';
  }, [searchParams]);

  const search = searchParams.get('recherche') ?? '';

  const write = useCallback(
    (nextTab: ReferentielTab, nextSearch: string) => {
      const params = new URLSearchParams();
      if (nextTab !== 'banques') params.set('onglet', nextTab);
      if (nextSearch.trim() !== '') params.set('recherche', nextSearch.trim());
      const query = params.toString();
      router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
    },
    [pathname, router],
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-[0.9375rem] text-muted-foreground">
        Listes de valeurs proposées à la saisie des prospects.{' '}
        <Link href="/admin/referentiels/issues-appel" className="underline underline-offset-2">
          Issues d’appel
        </Link>{' '}
        ·{' '}
        <Link
          href="/admin/referentiels/statuts-qualification"
          className="underline underline-offset-2"
        >
          Statuts de qualification
        </Link>
      </p>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          write(value as ReferentielTab, '');
        }}
      >
        <TabsList>
          <TabsTrigger value="banques">Banques</TabsTrigger>
          <TabsTrigger value="syndicats">Syndicats</TabsTrigger>
          <TabsTrigger value="departements">Départements</TabsTrigger>
          <TabsTrigger value="professions">Professions</TabsTrigger>
          <TabsTrigger value="employeurs">Employeurs</TabsTrigger>
          <TabsTrigger value="incomeBands">Revenus</TabsTrigger>
          <TabsTrigger value="offers">Offres</TabsTrigger>
        </TabsList>

        <TabsContent value="banques">
          <BanquesTab
            search={search}
            onSearch={(value) => {
              write('banques', value);
            }}
          />
        </TabsContent>
        <TabsContent value="syndicats">
          <SyndicatsTab
            search={search}
            onSearch={(value) => {
              write('syndicats', value);
            }}
          />
        </TabsContent>
        <TabsContent value="departements">
          <DepartementsTab
            search={search}
            onSearch={(value) => {
              write('departements', value);
            }}
          />
        </TabsContent>
        <TabsContent value="professions">
          <OpenReferentialTab kind="professions" />
        </TabsContent>
        <TabsContent value="employeurs">
          <OpenReferentialTab kind="employeurs" />
        </TabsContent>
        <TabsContent value="incomeBands">
          <OpenReferentialTab kind="incomeBands" />
        </TabsContent>
        <TabsContent value="offers">
          <OpenReferentialTab kind="offers" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function matches(search: string, ...fields: readonly (string | null)[]): boolean {
  const needle = normalize(search.trim());
  if (needle === '') return true;
  return fields.some((field) => field !== null && normalize(field).includes(needle));
}

type UsageKind = 'banques' | 'syndicats' | 'departements';

interface Usage extends Record<UsageKind, UsageCounts> {
  /** Faux tant que le décompte n'est pas revenu. Il ne vaut alors PAS zéro. */
  known: boolean;
  retry: () => void;
}

function useUsage(): Usage {
  const { data, refetch } = useQuery({
    queryKey: queryKeys.referentielUsage,
    queryFn: () => fetchReferentielUsage(),
    staleTime: 60_000,
  });

  return {
    ...(data ?? { banques: {}, syndicats: {}, departements: {} }),
    known: data !== undefined,
    retry: () => {
      void refetch();
    },
  };
}

/**
 * `null` tant que le décompte n'est pas connu.
 *
 * Le rendre à zéro faisait lire « 0 prospect référence cette banque » dans la
 * boîte de confirmation d'une désactivation, alors que l'appel avait échoué.
 */
const usageOf = (usage: Usage, kind: UsageKind, id: string): number | null =>
  usage.known ? (usage[kind][id] ?? 0) : null;

function TabShell({
  title,
  description,
  onCreate,
  createLabel,
  search,
  onSearch,
  searchPlaceholder,
  children,
}: {
  title: string;
  description: string;
  onCreate: () => void;
  createLabel: string;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">{title}</h2>
          <p className="text-[0.8125rem] text-muted-foreground">{description}</p>
        </div>
        <Button onClick={onCreate}>
          <PlusIcon aria-hidden="true" />
          {createLabel}
        </Button>
      </div>

      {/* Le filtrage est en mémoire : la valeur part directement dans l'URL,
          sans temporisation de frappe, puisqu'aucune requête n'en dépend. */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-elev-sm">
        <SearchField
          label="Rechercher"
          value={search}
          onChange={onSearch}
          placeholder={searchPlaceholder}
        />
      </div>

      {children}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div key={index} className="flex items-center gap-4 border-b border-border px-3 py-4">
          {[0, 1, 2, 3].map((cell) => (
            <Skeleton key={cell} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

const inactiveRowClass =
  'bg-muted/50 [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-muted-foreground';

function UsageCell({ count }: { count: number | null }) {
  if (count === null) {
    return (
      <span className="text-muted-foreground" title="Décompte indisponible">
        –
      </span>
    );
  }
  return (
    <span className={cn('tabular-nums', count === 0 && 'text-muted-foreground')}>
      {formatNumber(count)}
    </span>
  );
}

function BanquesTab({ search, onSearch }: { search: string; onSearch: (value: string) => void }) {
  const queryClient = useQueryClient();
  const usage = useUsage();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Banque | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<Banque | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.banques,
    queryFn: () => fetchBanques(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
  };

  const setActive = useMutation({
    mutationFn: ({ banque, isActive }: { banque: Banque; isActive: boolean }) =>
      updateBanque(banque.id, {
        name: banque.name,
        shortName: banque.shortName,
        sortOrder: banque.sortOrder,
        isActive,
      }),
    onSuccess: (saved) => {
      invalidate();
      setDeactivating(null);
      toast.success(
        saved.isActive ? `${saved.shortName} réactivée.` : `${saved.shortName} désactivée.`,
      );
    },
    onError: (error) => {
      toastApiError(error, "Changement d'état impossible. Réessayez.");
    },
  });

  const swap = useMutation({
    mutationFn: async ({ a, b }: { a: Banque; b: Banque }) => {
      await updateBanque(a.id, {
        name: a.name,
        shortName: a.shortName,
        isActive: a.isActive,
        sortOrder: b.sortOrder,
      });
      await updateBanque(b.id, {
        name: b.name,
        shortName: b.shortName,
        isActive: b.isActive,
        sortOrder: a.sortOrder,
      });
    },
    onSuccess: invalidate,
    onError: (error) => {
      toastApiError(error, 'Réordonnancement impossible. Réessayez.');
    },
  });

  const allRows = [...(data ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.shortName.localeCompare(b.shortName, 'fr'),
  );
  const rows = allRows.filter((banque) => matches(search, banque.shortName, banque.name));

  return (
    <TabShell
      title="Banques"
      description="Domiciliation bancaire du prospect."
      createLabel="Nouvelle banque"
      search={search}
      onSearch={onSearch}
      searchPlaceholder="Abréviation ou nom complet…"
      onCreate={() => {
        setEditing(undefined);
        setFormOpen(true);
      }}
    >
      {(() => {
        if (isPending) return <TableSkeleton />;
        return (() => {
          if (isError)
            return (
              <QueryErrorState
                error={error}
                onRetry={() => {
                  void refetch();
                }}
                fallback="Référentiel non chargé."
              />
            );
          return (
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Abréviation</TableHead>
                    <TableHead>Nom complet</TableHead>
                    <TableHead className="text-right">Prospects</TableHead>
                    <TableHead className="text-right">Ordre</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <EmptyRow colSpan={6}>
                      {search.trim() === ''
                        ? 'Aucune banque enregistrée.'
                        : 'Aucune banque ne correspond à cette recherche.'}
                    </EmptyRow>
                  ) : null}
                  {rows.map((banque) => {
                    const index = allRows.indexOf(banque);
                    return (
                      <TableRow
                        key={banque.id}
                        className={cn(!banque.isActive && inactiveRowClass)}
                      >
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'font-[600]',
                                !banque.isActive && 'text-muted-foreground',
                              )}
                            >
                              {banque.shortName}
                            </span>
                            {banque.isActive ? null : <Badge variant="outline">Retirée</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{banque.name}</TableCell>
                        <TableCell className="text-right">
                          <UsageCell count={usageOf(usage, 'banques', banque.id)} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {banque.sortOrder}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Monter ${banque.shortName}`}
                              disabled={index === 0 || swap.isPending}
                              onClick={() => {
                                const previous = allRows[index - 1];
                                if (previous !== undefined) swap.mutate({ a: banque, b: previous });
                              }}
                            >
                              <ChevronUpIcon className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Descendre ${banque.shortName}`}
                              disabled={index === allRows.length - 1 || swap.isPending}
                              onClick={() => {
                                const next = allRows[index + 1];
                                if (next !== undefined) swap.mutate({ a: banque, b: next });
                              }}
                            >
                              <ChevronDownIcon className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Modifier ${banque.shortName}`}
                              onClick={() => {
                                setEditing(banque);
                                setFormOpen(true);
                              }}
                            >
                              <PencilIcon className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={
                                banque.isActive
                                  ? `Désactiver ${banque.shortName}`
                                  : `Réactiver ${banque.shortName}`
                              }
                              disabled={setActive.isPending}
                              onClick={() => {
                                if (banque.isActive) {
                                  setDeactivating(banque);
                                } else {
                                  setActive.mutate({ banque, isActive: true });
                                }
                              }}
                            >
                              {banque.isActive ? (
                                <PowerOffIcon className="size-4" aria-hidden="true" />
                              ) : (
                                <PowerIcon className="size-4" aria-hidden="true" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        })();
      })()}

      <BanqueFormDialog open={formOpen} onOpenChange={setFormOpen} banque={editing} />
      <DeactivateReferentielDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
        label={deactivating?.shortName ?? ''}
        kind="banque"
        usageCount={deactivating === null ? null : usageOf(usage, 'banques', deactivating.id)}
        onRetryUsage={usage.retry}
        pending={setActive.isPending}
        onConfirm={() => {
          if (deactivating !== null) setActive.mutate({ banque: deactivating, isActive: false });
        }}
      />
    </TabShell>
  );
}

function SyndicatsTab({ search, onSearch }: { search: string; onSearch: (value: string) => void }) {
  const queryClient = useQueryClient();
  const usage = useUsage();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Syndicat | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<Syndicat | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.syndicats,
    queryFn: () => fetchSyndicats(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
  };

  const patchOf = (syndicat: Syndicat) => ({
    name: syndicat.name,
    sigle: syndicat.sigle,
    sortOrder: syndicat.sortOrder,
    isActive: syndicat.isActive,
    ...(syndicat.secteur === null ? {} : { secteur: syndicat.secteur }),
  });

  const setActive = useMutation({
    mutationFn: ({ syndicat, isActive }: { syndicat: Syndicat; isActive: boolean }) =>
      updateSyndicat(syndicat.id, { ...patchOf(syndicat), isActive }),
    onSuccess: (saved) => {
      invalidate();
      setDeactivating(null);
      toast.success(saved.isActive ? `${saved.sigle} réactivé.` : `${saved.sigle} désactivé.`);
    },
    onError: (error) => {
      toastApiError(error, "Changement d'état impossible. Réessayez.");
    },
  });

  const swap = useMutation({
    mutationFn: async ({ a, b }: { a: Syndicat; b: Syndicat }) => {
      await updateSyndicat(a.id, { ...patchOf(a), sortOrder: b.sortOrder });
      await updateSyndicat(b.id, { ...patchOf(b), sortOrder: a.sortOrder });
    },
    onSuccess: invalidate,
    onError: (error) => {
      toastApiError(error, 'Réordonnancement impossible. Réessayez.');
    },
  });

  const allRows = [...(data ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.sigle.localeCompare(b.sigle, 'fr'),
  );
  const rows = allRows.filter((syndicat) =>
    matches(search, syndicat.sigle, syndicat.name, syndicat.secteur),
  );

  return (
    <TabShell
      title="Syndicats"
      description="Appartenance syndicale du prospect."
      createLabel="Nouveau syndicat"
      search={search}
      onSearch={onSearch}
      searchPlaceholder="Sigle, nom ou secteur…"
      onCreate={() => {
        setEditing(undefined);
        setFormOpen(true);
      }}
    >
      {(() => {
        if (isPending) return <TableSkeleton />;
        return (() => {
          if (isError)
            return (
              <QueryErrorState
                error={error}
                onRetry={() => {
                  void refetch();
                }}
                fallback="Référentiel non chargé."
              />
            );
          return (
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Sigle</TableHead>
                    <TableHead>Nom complet</TableHead>
                    <TableHead>Secteur</TableHead>
                    <TableHead className="text-right">Prospects</TableHead>
                    <TableHead className="text-right">Ordre</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <EmptyRow colSpan={7}>
                      {search.trim() === ''
                        ? 'Aucun syndicat enregistré.'
                        : 'Aucun syndicat ne correspond à cette recherche.'}
                    </EmptyRow>
                  ) : null}
                  {rows.map((syndicat) => {
                    const index = allRows.indexOf(syndicat);
                    return (
                      <TableRow
                        key={syndicat.id}
                        className={cn(!syndicat.isActive && inactiveRowClass)}
                      >
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'font-[600]',
                                !syndicat.isActive && 'text-muted-foreground',
                              )}
                            >
                              {syndicat.sigle}
                            </span>
                            {syndicat.isActive ? null : <Badge variant="outline">Retiré</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{syndicat.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {syndicat.secteur ?? '–'}
                        </TableCell>
                        <TableCell className="text-right">
                          <UsageCell count={usageOf(usage, 'syndicats', syndicat.id)} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {syndicat.sortOrder}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Monter ${syndicat.sigle}`}
                              disabled={index === 0 || swap.isPending}
                              onClick={() => {
                                const previous = allRows[index - 1];
                                if (previous !== undefined)
                                  swap.mutate({ a: syndicat, b: previous });
                              }}
                            >
                              <ChevronUpIcon className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Descendre ${syndicat.sigle}`}
                              disabled={index === allRows.length - 1 || swap.isPending}
                              onClick={() => {
                                const next = allRows[index + 1];
                                if (next !== undefined) swap.mutate({ a: syndicat, b: next });
                              }}
                            >
                              <ChevronDownIcon className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Modifier ${syndicat.sigle}`}
                              onClick={() => {
                                setEditing(syndicat);
                                setFormOpen(true);
                              }}
                            >
                              <PencilIcon className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={
                                syndicat.isActive
                                  ? `Désactiver ${syndicat.sigle}`
                                  : `Réactiver ${syndicat.sigle}`
                              }
                              disabled={setActive.isPending}
                              onClick={() => {
                                if (syndicat.isActive) {
                                  setDeactivating(syndicat);
                                } else {
                                  setActive.mutate({ syndicat, isActive: true });
                                }
                              }}
                            >
                              {syndicat.isActive ? (
                                <PowerOffIcon className="size-4" aria-hidden="true" />
                              ) : (
                                <PowerIcon className="size-4" aria-hidden="true" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        })();
      })()}

      <SyndicatFormDialog open={formOpen} onOpenChange={setFormOpen} syndicat={editing} />
      <DeactivateReferentielDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
        label={deactivating?.sigle ?? ''}
        kind="syndicat"
        usageCount={deactivating === null ? null : usageOf(usage, 'syndicats', deactivating.id)}
        onRetryUsage={usage.retry}
        pending={setActive.isPending}
        onConfirm={() => {
          if (deactivating !== null) setActive.mutate({ syndicat: deactivating, isActive: false });
        }}
      />
    </TabShell>
  );
}

function DepartementsTab({
  search,
  onSearch,
}: {
  search: string;
  onSearch: (value: string) => void;
}) {
  const queryClient = useQueryClient();
  const usage = useUsage();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Departement | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<Departement | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.departements,
    queryFn: () => fetchDepartements(),
  });

  const setActive = useMutation({
    mutationFn: ({ departement, isActive }: { departement: Departement; isActive: boolean }) =>
      updateDepartement(departement.id, {
        code: departement.code,
        name: departement.name,
        regionId: departement.regionId,
        isActive,
      }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
      setDeactivating(null);
      toast.success(saved.isActive ? `${saved.name} réactivé.` : `${saved.name} désactivé.`);
    },
    onError: (error) => {
      toastApiError(error, "Changement d'état impossible. Réessayez.");
    },
  });

  const rows = [...(data ?? [])]
    .sort(
      (a, b) =>
        a.regionName.localeCompare(b.regionName, 'fr') || a.name.localeCompare(b.name, 'fr'),
    )
    .filter((departement) =>
      matches(search, departement.name, departement.code, departement.regionName),
    );

  return (
    <TabShell
      title="Départements"
      description="Triés par région, puis par nom."
      createLabel="Nouveau département"
      search={search}
      onSearch={onSearch}
      searchPlaceholder="Département, code ou région…"
      onCreate={() => {
        setEditing(undefined);
        setFormOpen(true);
      }}
    >
      {(() => {
        if (isPending) return <TableSkeleton />;
        return (() => {
          if (isError)
            return (
              <QueryErrorState
                error={error}
                onRetry={() => {
                  void refetch();
                }}
                fallback="Référentiel non chargé."
              />
            );
          return (
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Département</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Région</TableHead>
                    <TableHead className="text-right">Prospects</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <EmptyRow colSpan={6}>
                      {search.trim() === ''
                        ? 'Aucun département enregistré.'
                        : 'Aucun département ne correspond à cette recherche.'}
                    </EmptyRow>
                  ) : null}
                  {rows.map((departement) => (
                    <TableRow
                      key={departement.id}
                      className={cn(!departement.isActive && inactiveRowClass)}
                    >
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'font-[600]',
                              !departement.isActive && 'text-muted-foreground',
                            )}
                          >
                            {departement.name}
                          </span>
                          {departement.isActive ? null : <Badge variant="outline">Retiré</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {departement.code}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {departement.regionName}
                      </TableCell>
                      <TableCell className="text-right">
                        <UsageCell count={usageOf(usage, 'departements', departement.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Modifier ${departement.name}`}
                            onClick={() => {
                              setEditing(departement);
                              setFormOpen(true);
                            }}
                          >
                            <PencilIcon className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={
                              departement.isActive
                                ? `Désactiver ${departement.name}`
                                : `Réactiver ${departement.name}`
                            }
                            disabled={setActive.isPending}
                            onClick={() => {
                              if (departement.isActive) {
                                setDeactivating(departement);
                              } else {
                                setActive.mutate({ departement, isActive: true });
                              }
                            }}
                          >
                            {departement.isActive ? (
                              <PowerOffIcon className="size-4" aria-hidden="true" />
                            ) : (
                              <PowerIcon className="size-4" aria-hidden="true" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        })();
      })()}

      <DepartementFormDialog open={formOpen} onOpenChange={setFormOpen} departement={editing} />
      <DeactivateReferentielDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
        label={deactivating?.name ?? ''}
        kind="département"
        usageCount={deactivating === null ? null : usageOf(usage, 'departements', deactivating.id)}
        onRetryUsage={usage.retry}
        pending={setActive.isPending}
        onConfirm={() => {
          if (deactivating !== null) {
            setActive.mutate({ departement: deactivating, isActive: false });
          }
        }}
      />
    </TabShell>
  );
}

function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-[600]">{children}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}
