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
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { DeactivateReferentielDialog } from '@/components/referentiels/deactivate-dialog';
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

/**
 * Référentiels : banques, syndicats, départements.
 *
 * Ces trois listes descendent EN LECTURE SEULE vers l'application mobile. Toute
 * modification faite ici change ce que les commerciaux peuvent choisir lors de
 * leur prochaine synchronisation — d'où le compteur d'usage affiché sur chaque
 * ligne et la confirmation explicite avant désactivation.
 */
export function ReferentielsView() {
  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="banques">
        <TabsList>
          <TabsTrigger value="banques">Banques</TabsTrigger>
          <TabsTrigger value="syndicats">Syndicats</TabsTrigger>
          <TabsTrigger value="departements">Départements</TabsTrigger>
        </TabsList>

        <TabsContent value="banques">
          <BanquesTab />
        </TabsContent>
        <TabsContent value="syndicats">
          <SyndicatsTab />
        </TabsContent>
        <TabsContent value="departements">
          <DepartementsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Compteurs d'usage, partagés par les trois onglets. */
function useUsage(): { banques: UsageCounts; syndicats: UsageCounts; departements: UsageCounts } {
  const { data } = useQuery({
    queryKey: queryKeys.referentielUsage,
    queryFn: () => fetchReferentielUsage(),
    staleTime: 60_000,
  });
  return data ?? { banques: {}, syndicats: {}, departements: {} };
}

function TabShell({
  title,
  onCreate,
  createLabel,
  children,
}: {
  title: string;
  onCreate: () => void;
  createLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">{title}</h2>
        </div>
        <Button onClick={onCreate}>
          <PlusIcon aria-hidden="true" />
          {createLabel}
        </Button>
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

/** Ligne désactivée : atténuée, badge explicite, liseré. Pas juste un booléen. */
const inactiveRowClass =
  // Liseré à pleine opacité : à `/40` il tombait à 1,90:1, sous les 3:1 exigés
  // d'un élément graphique porteur de sens — et c'est le seul marqueur visuel
  // qui distingue une ligne désactivée.
  'bg-muted/50 [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-muted-foreground';

function UsageCell({ count }: { count: number }) {
  return (
    <span className={cn('tabular-nums', count === 0 && 'text-muted-foreground')}>
      {formatNumber(count)}
    </span>
  );
}

// ─── Banques ────────────────────────────────────────────────────────────────

function BanquesTab() {
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
        saved.isActive
          ? `${saved.shortName} est de nouveau proposée à la saisie.`
          : `${saved.shortName} retirée de la saisie. Les prospects existants la conservent.`,
      );
    },
    onError: (error) => {
      toastApiError(error, "Le changement d'état a échoué.");
    },
  });

  // Réordonner = échanger le `sortOrder` avec le voisin. Deux PATCH plutôt
  // qu'un endpoint de réordonnancement, que le contrat n'expose pas.
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
      toastApiError(error, 'Le réordonnancement a échoué.');
    },
  });

  const rows = [...(data ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.shortName.localeCompare(b.shortName, 'fr'),
  );

  return (
    <TabShell
      title="Banques"
      createLabel="Nouvelle banque"
      onCreate={() => {
        setEditing(undefined);
        setFormOpen(true);
      }}
    >
      {isPending ? (
        <TableSkeleton />
      ) : isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="Ce référentiel n’a pas pu être chargé."
        />
      ) : (
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
                <EmptyRow colSpan={6}>Aucune banque enregistrée.</EmptyRow>
              ) : null}
              {rows.map((banque, index) => (
                <TableRow key={banque.id} className={cn(!banque.isActive && inactiveRowClass)}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn('font-[600]', !banque.isActive && 'text-muted-foreground')}
                      >
                        {banque.shortName}
                      </span>
                      {banque.isActive ? null : <Badge variant="outline">Retirée</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{banque.name}</TableCell>
                  <TableCell className="text-right">
                    <UsageCell count={usage.banques[banque.id] ?? 0} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{banque.sortOrder}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Monter ${banque.shortName}`}
                        disabled={index === 0 || swap.isPending}
                        onClick={() => {
                          const previous = rows[index - 1];
                          if (previous !== undefined) swap.mutate({ a: banque, b: previous });
                        }}
                      >
                        <ChevronUpIcon className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Descendre ${banque.shortName}`}
                        disabled={index === rows.length - 1 || swap.isPending}
                        onClick={() => {
                          const next = rows[index + 1];
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <BanqueFormDialog open={formOpen} onOpenChange={setFormOpen} banque={editing} />
      <DeactivateReferentielDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
        label={deactivating?.shortName ?? ''}
        kind="banque"
        usageCount={deactivating === null ? 0 : (usage.banques[deactivating.id] ?? 0)}
        pending={setActive.isPending}
        onConfirm={() => {
          if (deactivating !== null) setActive.mutate({ banque: deactivating, isActive: false });
        }}
      />
    </TabShell>
  );
}

// ─── Syndicats ──────────────────────────────────────────────────────────────

function SyndicatsTab() {
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
      toast.success(
        saved.isActive
          ? `${saved.sigle} est de nouveau proposé à la saisie.`
          : `${saved.sigle} retiré de la saisie. Les prospects existants le conservent.`,
      );
    },
    onError: (error) => {
      toastApiError(error, "Le changement d'état a échoué.");
    },
  });

  const swap = useMutation({
    mutationFn: async ({ a, b }: { a: Syndicat; b: Syndicat }) => {
      await updateSyndicat(a.id, { ...patchOf(a), sortOrder: b.sortOrder });
      await updateSyndicat(b.id, { ...patchOf(b), sortOrder: a.sortOrder });
    },
    onSuccess: invalidate,
    onError: (error) => {
      toastApiError(error, 'Le réordonnancement a échoué.');
    },
  });

  const rows = [...(data ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.sigle.localeCompare(b.sigle, 'fr'),
  );

  return (
    <TabShell
      title="Syndicats"
      createLabel="Nouveau syndicat"
      onCreate={() => {
        setEditing(undefined);
        setFormOpen(true);
      }}
    >
      {isPending ? (
        <TableSkeleton />
      ) : isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="Ce référentiel n’a pas pu être chargé."
        />
      ) : (
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
                <EmptyRow colSpan={7}>Aucun syndicat enregistré.</EmptyRow>
              ) : null}
              {rows.map((syndicat, index) => (
                <TableRow key={syndicat.id} className={cn(!syndicat.isActive && inactiveRowClass)}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn('font-[600]', !syndicat.isActive && 'text-muted-foreground')}
                      >
                        {syndicat.sigle}
                      </span>
                      {syndicat.isActive ? null : <Badge variant="outline">Retiré</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{syndicat.name}</TableCell>
                  <TableCell className="text-muted-foreground">{syndicat.secteur ?? '–'}</TableCell>
                  <TableCell className="text-right">
                    <UsageCell count={usage.syndicats[syndicat.id] ?? 0} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{syndicat.sortOrder}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Monter ${syndicat.sigle}`}
                        disabled={index === 0 || swap.isPending}
                        onClick={() => {
                          const previous = rows[index - 1];
                          if (previous !== undefined) swap.mutate({ a: syndicat, b: previous });
                        }}
                      >
                        <ChevronUpIcon className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Descendre ${syndicat.sigle}`}
                        disabled={index === rows.length - 1 || swap.isPending}
                        onClick={() => {
                          const next = rows[index + 1];
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <SyndicatFormDialog open={formOpen} onOpenChange={setFormOpen} syndicat={editing} />
      <DeactivateReferentielDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
        label={deactivating?.sigle ?? ''}
        kind="syndicat"
        usageCount={deactivating === null ? 0 : (usage.syndicats[deactivating.id] ?? 0)}
        pending={setActive.isPending}
        onConfirm={() => {
          if (deactivating !== null) setActive.mutate({ syndicat: deactivating, isActive: false });
        }}
      />
    </TabShell>
  );
}

// ─── Départements ───────────────────────────────────────────────────────────

function DepartementsTab() {
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
      toast.success(
        saved.isActive
          ? `${saved.name} est de nouveau proposé à la saisie.`
          : `${saved.name} retiré de la saisie. Les représentants et prospects existants le conservent.`,
      );
    },
    onError: (error) => {
      toastApiError(error, "Le changement d'état a échoué.");
    },
  });

  // Pas de `sortOrder` sur les départements dans le contrat : ils sont
  // présentés par région puis par nom, comme dans le découpage administratif.
  const rows = [...(data ?? [])].sort(
    (a, b) => a.regionName.localeCompare(b.regionName, 'fr') || a.name.localeCompare(b.name, 'fr'),
  );

  return (
    <TabShell
      title="Départements"
      createLabel="Nouveau département"
      onCreate={() => {
        setEditing(undefined);
        setFormOpen(true);
      }}
    >
      {isPending ? (
        <TableSkeleton />
      ) : isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="Ce référentiel n’a pas pu être chargé."
        />
      ) : (
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
                <EmptyRow colSpan={6}>Aucun département enregistré.</EmptyRow>
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
                  <TableCell className="text-muted-foreground">{departement.regionName}</TableCell>
                  <TableCell className="text-right">
                    <UsageCell count={usage.departements[departement.id] ?? 0} />
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
      )}

      <DepartementFormDialog open={formOpen} onOpenChange={setFormOpen} departement={editing} />
      <DeactivateReferentielDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
        label={deactivating?.name ?? ''}
        kind="département"
        usageCount={deactivating === null ? 0 : (usage.departements[deactivating.id] ?? 0)}
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

/**
 * Ligne « aucun élément » d'un référentiel.
 *
 * Les trois tableaux rendaient `rows.map(...)` sans garde : un référentiel vide
 * — installation neuve, ou réponse filtrée par l'API — n'affichait qu'une ligne
 * d'en-tête au-dessus d'une carte blanche, sans un mot d'explication. Les
 * tableaux voisins (prospects, représentants, commerciaux) traitent tous ce cas.
 */
function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-[600]">{children}</p>
          <p className="text-[0.8125rem] text-muted-foreground">
            Utilisez «&nbsp;Ajouter&nbsp;» pour créer la première entrée.
          </p>
        </div>
      </TableCell>
    </TableRow>
  );
}
