'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheetIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { BarreEdition } from '@/components/accueil/tableau-de-bord/barre-edition';
import { WidgetGrid } from '@/components/accueil/tableau-de-bord/grille';
import { marqueRecommandee } from '@/components/accueil/tableau-de-bord/recommandation';
import {
  dashboardFiltersAdapter,
  periodeAffichee,
  plageDeFiltres,
  SelecteurPeriode,
} from '@/components/accueil/tableau-de-bord/selecteur-periode';
import { plageComparaison, plageTropLarge } from '@/components/accueil/tableau-de-bord/periode';
import {
  SOURCES,
  mesurerDonnees,
  type DashboardSource,
  type DonneesSource,
  type VisiteStats,
} from '@/components/accueil/tableau-de-bord/sources';
import { TiroirWidgets } from '@/components/accueil/tableau-de-bord/tiroir-widgets';
import { useUrlFilters } from '@/components/filters/use-url-filters';
import { LiveIndicator } from '@/components/live/live-indicator';
import { useLive } from '@/components/live/use-live';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { csvRows, downloadCsv } from '@/lib/csv';
import {
  fetchDisposition,
  fetchVisiteDashboardStats,
  resetDisposition,
  saveDefaultDisposition,
  saveDisposition,
  serializeDisposition,
  type DashboardWidget,
} from '@/lib/data/visites-dashboard';
import { LIVE_SLOW_INTERVAL_MS, shouldShowError, shouldShowSkeleton } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';
import type { Role } from '@/lib/types';

function exportCsv(stats: VisiteStats, plage: { du: string; au: string }): void {
  const bloc = (
    titre: string,
    items: { label: string; count: number }[],
  ): (string | number | null)[][] => {
    const rows: (string | number | null)[][] = [[titre, 'Visites']];
    for (const item of items) rows.push([item.label, item.count]);
    rows.push([]);
    return rows;
  };

  const rows: (string | number | null)[][] = [
    [`Visites du ${plage.du} au ${plage.au}`],
    ['Total', stats.total],
    [],
    ...bloc('Entreprise', stats.parEntreprise),
    ...bloc('Objet', stats.parObjet),
    ...bloc('Direction', stats.parDirection),
    ...bloc('Destinataire', stats.parDestinataire),
    ...bloc('Agent', stats.parAgent),
    ...bloc(
      'Jour',
      stats.parJour.map((p) => ({ label: p.date, count: p.count })),
    ),
    ...bloc(
      'Mois',
      stats.parMois.map((p) => ({ label: p.month, count: p.count })),
    ),
  ];

  downloadCsv(csvRows(rows), `cpi-visites-${plage.du}-${plage.au}.csv`);
}

export function DashboardVisitesView({ role }: { role: Role }) {
  const { filters, setFilters } = useUrlFilters(dashboardFiltersAdapter);
  const plage = plageDeFiltres(filters);
  const tropLarge = plageTropLarge(plage);
  const comparaisonPlage = plageComparaison(plage, filters.comparaison);

  const live = useLive({ intervalMs: LIVE_SLOW_INTERVAL_MS });
  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: queryKeys.visitesStats(plage.du, plage.au),
    queryFn: () => fetchVisiteDashboardStats(plage.du, plage.au),
    refetchInterval: live.refetchInterval,
    placeholderData: keepPreviousData,
    enabled: !tropLarge,
  });

  const comparaisonQuery = useQuery({
    queryKey: queryKeys.visitesStats(comparaisonPlage?.du ?? '', comparaisonPlage?.au ?? ''),
    queryFn: () => {
      const cible = comparaisonPlage ?? plage;
      return fetchVisiteDashboardStats(cible.du, cible.au);
    },
    enabled: comparaisonPlage !== null && !tropLarge,
  });

  const dispositionQuery = useQuery({
    queryKey: queryKeys.visitesDisposition,
    queryFn: () => fetchDisposition(),
  });

  const [brouillon, setBrouillon] = useState<DashboardWidget[] | null>(null);
  const editing = brouillon !== null;
  const snapshotRef = useRef<string>('');
  const pausedByEditionRef = useRef(false);
  const dernierAjoutRef = useRef<string | null>(null);

  useEffect(() => {
    if (dernierAjoutRef.current === null) return;
    const id = dernierAjoutRef.current;
    dernierAjoutRef.current = null;
    const node = document.getElementById(`widget-${id}`);
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    node?.focus();
  }, [brouillon]);

  const saveMutation = useMutation({
    mutationFn: (widgets: DashboardWidget[]) =>
      saveDisposition(widgets, dispositionQuery.data?.preset, undefined),
    onSuccess: async () => {
      setBrouillon(null);
      if (pausedByEditionRef.current) {
        live.togglePause();
        pausedByEditionRef.current = false;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.visitesDisposition });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (widgets: DashboardWidget[]) =>
      saveDefaultDisposition(widgets, dispositionQuery.data?.preset, undefined),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetDisposition(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.visitesDisposition });
    },
  });

  const widgets = editing ? brouillon : (dispositionQuery.data?.widgets ?? []);

  const donneesParSource = new Map<DashboardSource, DonneesSource>();
  if (statsQuery.data !== undefined) {
    for (const source of Object.keys(SOURCES) as DashboardSource[]) {
      donneesParSource.set(source, SOURCES[source].extraire(statsQuery.data));
    }
  }
  const donneesParWidget = new Map<string, DonneesSource>();
  for (const widget of widgets) {
    const donnee = donneesParSource.get(widget.source);
    if (donnee !== undefined) donneesParWidget.set(widget.id, donnee);
  }

  const hasData = statsQuery.data !== undefined && dispositionQuery.data !== undefined;
  const isRefetching = statsQuery.isFetching && statsQuery.data !== undefined;

  const enterEdition = (): void => {
    if (dispositionQuery.data === undefined) return;
    const copie = dispositionQuery.data.widgets.map((widget) => ({ ...widget }));
    snapshotRef.current = JSON.stringify(serializeDisposition(copie));
    setBrouillon(copie);
    if (!live.paused) {
      live.togglePause();
      pausedByEditionRef.current = true;
    }
  };

  const cancelEdition = (): void => {
    setBrouillon(null);
    if (pausedByEditionRef.current) {
      live.togglePause();
      pausedByEditionRef.current = false;
    }
  };

  const dirty = editing && JSON.stringify(serializeDisposition(brouillon)) !== snapshotRef.current;

  const placees = new Set(widgets.map((widget) => widget.source));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <LiveIndicator
            state={live.stateOf(statsQuery.isError)}
            label={live.labelOf(statsQuery.isError)}
            updatedAt={hasData ? statsQuery.dataUpdatedAt : null}
            onTogglePause={live.togglePause}
          />
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <TiroirWidgets
              placees={placees}
              donnees={donneesParSource}
              onAdd={(source) => {
                const donneesSource = donneesParSource.get(source);
                const marque =
                  donneesSource === undefined
                    ? undefined
                    : marqueRecommandee(SOURCES[source].forme, mesurerDonnees(donneesSource));
                const id = `${source}-${String(Date.now())}`;
                setBrouillon((current) => [
                  ...(current ?? []),
                  { id, source, marque, taille: 'demi' },
                ]);
                dernierAjoutRef.current = id;
              }}
            />
          ) : (
            <>
              {dispositionQuery.data?.source === 'utilisateur' ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={resetMutation.isPending}
                  onClick={() => {
                    resetMutation.mutate();
                  }}
                >
                  Revenir à la disposition par défaut
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={statsQuery.data === undefined}
                onClick={() => {
                  if (statsQuery.data !== undefined) exportCsv(statsQuery.data, plage);
                }}
              >
                <FileSpreadsheetIcon aria-hidden="true" />
                Exporter le détail
              </Button>
            </>
          )}
          <BarreEdition
            editing={editing}
            dirty={dirty}
            pending={saveMutation.isPending}
            isAdmin={role === 'ADMIN'}
            onEnter={enterEdition}
            onSave={() => {
              if (brouillon !== null) saveMutation.mutate(brouillon);
            }}
            onCancel={cancelEdition}
            onSetDefault={() => {
              if (brouillon !== null) setDefaultMutation.mutate(brouillon);
            }}
          />
        </div>
      </div>

      <SelecteurPeriode filters={filters} onChange={setFilters} />

      <p className="text-[0.9375rem] font-[600] text-foreground" aria-live="polite">
        {periodeAffichee(filters)}
      </p>

      {comparaisonQuery.isError ? (
        <p className="text-[0.8125rem] text-muted-foreground">Comparaison indisponible.</p>
      ) : null}

      {(() => {
        if (shouldShowError({ isError: statsQuery.isError || dispositionQuery.isError, hasData }))
          return (
            <QueryErrorState
              error={statsQuery.error ?? dispositionQuery.error}
              onRetry={() => {
                void statsQuery.refetch();
                void dispositionQuery.refetch();
              }}
              fallback="Le tableau de bord des visites n’a pas pu être calculé. Réessayez."
            />
          );
        return (() => {
          if (
            shouldShowSkeleton({
              isPending: statsQuery.isPending || dispositionQuery.isPending,
              hasData,
            })
          )
            return <DashboardVisitesSkeleton />;
          return (
            <div className={isRefetching ? 'opacity-60' : undefined} aria-busy={isRefetching}>
              <WidgetGrid
                widgets={widgets}
                donnees={donneesParWidget}
                editing={editing}
                onReorder={(fromId, toId) => {
                  setBrouillon((current) => {
                    if (current === null) return current;
                    const fromIndex = current.findIndex((w) => w.id === fromId);
                    const toIndex = current.findIndex((w) => w.id === toId);
                    if (fromIndex === -1 || toIndex === -1) return current;
                    const next = [...current];
                    const [moved] = next.splice(fromIndex, 1);
                    if (moved === undefined) return current;
                    next.splice(toIndex, 0, moved);
                    return next;
                  });
                }}
                onRemove={(id) => {
                  setBrouillon((current) => current?.filter((w) => w.id !== id) ?? current);
                }}
                onMove={(id, direction) => {
                  setBrouillon((current) => {
                    if (current === null) return current;
                    const index = current.findIndex((w) => w.id === id);
                    const target = index + direction;
                    if (index === -1 || target < 0 || target >= current.length) return current;
                    const next = [...current];
                    const [moved] = next.splice(index, 1);
                    if (moved === undefined) return current;
                    next.splice(target, 0, moved);
                    return next;
                  });
                }}
                onChangeMarque={(id, marque) => {
                  setBrouillon(
                    (current) =>
                      current?.map((w) => (w.id === id ? { ...w, marque } : w)) ?? current,
                  );
                }}
                onChangeTaille={(id, taille) => {
                  setBrouillon(
                    (current) =>
                      current?.map((w) => (w.id === id ? { ...w, taille } : w)) ?? current,
                  );
                }}
                onChangePresentation={(id, presentation) => {
                  setBrouillon(
                    (current) =>
                      current?.map((w) => (w.id === id ? { ...w, presentation } : w)) ?? current,
                  );
                }}
              />
            </div>
          );
        })();
      })()}
    </div>
  );
}

export function DashboardVisitesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <Card key={`tuile-${String(index)}`}>
          <CardContent>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
          </CardContent>
        </Card>
      ))}
      {[0, 1, 2, 3].map((index) => (
        <Card
          key={`graphique-${String(index)}`}
          className={index < 1 ? 'sm:col-span-2' : 'sm:col-span-2 xl:col-span-2'}
        >
          <div className="px-5 pt-5">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="px-5 pb-1 pt-3">
            <Skeleton className="h-56 w-full rounded-md" />
          </div>
        </Card>
      ))}
    </div>
  );
}
