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
  catalogueVisitesDe,
  mesurerDonnees,
  type VisiteSource,
  type DonneesSource,
  type VisiteStats,
} from '@/components/accueil/tableau-de-bord/sources';
import { TiroirWidgets } from '@/components/accueil/tableau-de-bord/tiroir-widgets';
import { BoutonExportExcel } from '@/components/dashboard/bouton-export-excel';
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
import { formatDate, formatDateTime } from '@/lib/format';
import { LIVE_SLOW_INTERVAL_MS, shouldShowError, shouldShowSkeleton } from '@/lib/live';
import type { BlocTableauDeBord, ClasseurTableauDeBord } from '@/lib/tableau-de-bord-xlsx';
import { queryKeys } from '@/lib/query-keys';
import { avecTransition } from '@/lib/transition-de-vue';
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

type Catalogue = ReturnType<typeof catalogueVisitesDe>;

function donneesDuCatalogue(
  catalogue: Catalogue,
  stats: VisiteStats | undefined,
): Map<string, DonneesSource> {
  const donnees = new Map<string, DonneesSource>();
  if (stats === undefined) return donnees;
  for (const source of Object.keys(catalogue) as VisiteSource[]) {
    const definition = catalogue[source];
    if (definition !== undefined) donnees.set(source, definition.extraire(stats));
  }
  return donnees;
}

function donneesDesWidgets(
  widgets: DashboardWidget[],
  parSource: Map<string, DonneesSource>,
): Map<string, DonneesSource> {
  const donnees = new Map<string, DonneesSource>();
  for (const widget of widgets) {
    const donnee = parSource.get(widget.source);
    if (donnee !== undefined) donnees.set(widget.id, donnee);
  }
  return donnees;
}

/** L'onglet du classeur où chaque source se range : ce qui se lit ensemble reste ensemble. */
const GROUPES_EXPORT: Record<string, string> = {
  'par-entreprise': 'Qui vient, et pourquoi',
  'par-objet': 'Qui vient, et pourquoi',
  'par-entreprise-objet': 'Qui vient, et pourquoi',
  'visiteurs-recurrents': 'Qui vient, et pourquoi',
  'par-direction': 'Qui reçoit',
  'par-destinataire': 'Qui reçoit',
  'par-destinataire-direction': 'Qui reçoit',
  'par-jour': 'Dans le temps',
  'par-mois': 'Dans le temps',
  'par-heure': 'Dans le temps',
  'par-jour-semaine': 'Dans le temps',
  'par-heure-jour-semaine': 'Dans le temps',
  'par-objet-mois': 'Dans le temps',
  'par-agent': 'Travail de l’accueil',
  'qualite-de-saisie': 'Travail de l’accueil',
  'avec-telephone': 'Travail de l’accueil',
};

/** Le classeur suit l'écran : ses blocs sont les cartes posées, dans leur ordre. */
function blocsDesWidgets(
  widgets: readonly DashboardWidget[],
  catalogue: Catalogue,
  donneesParWidget: Map<string, DonneesSource>,
): BlocTableauDeBord[] {
  const blocs: BlocTableauDeBord[] = [];
  for (const widget of widgets) {
    const entree = catalogue[widget.source];
    const donnee = donneesParWidget.get(widget.id);
    if (entree === undefined || donnee === undefined) continue;
    blocs.push({
      titre: entree.label,
      question: entree.question,
      groupe: GROUPES_EXPORT[widget.source],
      donnees: donnee,
    });
  }
  return blocs;
}

function classeurDesVisites(
  plage: { du: string; au: string },
  periode: string,
  blocs: BlocTableauDeBord[],
): ClasseurTableauDeBord {
  return {
    fichier: `cpi-visites-${plage.du}-${plage.au}`,
    titre: 'Tableau de bord des visites',
    sousTitre: periode,
    reperes: [
      { libelle: 'Registre', valeur: 'Visites reçues à l’accueil' },
      { libelle: 'Période', valeur: `du ${formatDate(plage.du)} au ${formatDate(plage.au)}` },
      { libelle: 'Chiffres repris', valeur: String(blocs.length) },
      { libelle: 'Édité le', valeur: formatDateTime(new Date().toISOString()) },
    ],
    blocs,
  };
}

type Brouillon = DashboardWidget[] | null;

function reordonner(widgets: Brouillon, fromId: string, toId: string): Brouillon {
  if (widgets === null) return widgets;
  const fromIndex = widgets.findIndex((widget) => widget.id === fromId);
  const toIndex = widgets.findIndex((widget) => widget.id === toId);
  if (fromIndex === -1 || toIndex === -1) return widgets;
  const next = [...widgets];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return widgets;
  next.splice(toIndex, 0, moved);
  return next;
}

function decaler(widgets: Brouillon, id: string, direction: -1 | 1): Brouillon {
  if (widgets === null) return widgets;
  const index = widgets.findIndex((widget) => widget.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= widgets.length) return widgets;
  const next = [...widgets];
  const [moved] = next.splice(index, 1);
  if (moved === undefined) return widgets;
  next.splice(target, 0, moved);
  return next;
}

function modifier(widgets: Brouillon, id: string, patch: Partial<DashboardWidget>): Brouillon {
  return widgets?.map((widget) => (widget.id === id ? { ...widget, ...patch } : widget)) ?? widgets;
}

function widgetsActifs(
  editing: boolean,
  brouillon: Brouillon,
  disposition: { widgets: DashboardWidget[] } | undefined,
  catalogue: Catalogue,
): DashboardWidget[] {
  const base = editing ? (brouillon ?? []) : (disposition?.widgets ?? []);
  return base.filter((widget) => catalogue[widget.source] !== undefined);
}

function clePeriodeComparaison(
  comparaisonPlage: ReturnType<typeof plageComparaison>,
): ReturnType<typeof queryKeys.visitesStats> {
  return queryKeys.visitesStats(comparaisonPlage?.du ?? '', comparaisonPlage?.au ?? '');
}

function comparaisonActivee(
  comparaisonPlage: ReturnType<typeof plageComparaison>,
  tropLarge: boolean,
): boolean {
  return comparaisonPlage !== null && !tropLarge;
}

function BoutonReinitialiser({
  disposition,
  pending,
  onReset,
}: {
  disposition: { source: string } | undefined;
  pending: boolean;
  onReset: () => void;
}) {
  if (disposition?.source !== 'utilisateur') return null;
  return (
    <Button type="button" variant="ghost" disabled={pending} onClick={onReset}>
      Revenir à la disposition par défaut
    </Button>
  );
}

export function DashboardVisitesView({ role }: { role: Role }) {
  const { filters, setFilters } = useUrlFilters(dashboardFiltersAdapter);
  const plage = plageDeFiltres(filters);
  const tropLarge = plageTropLarge(plage);
  const comparaisonPlage = plageComparaison(plage, filters.comparaison);
  const catalogue = catalogueVisitesDe(role);

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
    queryKey: clePeriodeComparaison(comparaisonPlage),
    queryFn: () => {
      const cible = comparaisonPlage ?? plage;
      return fetchVisiteDashboardStats(cible.du, cible.au);
    },
    enabled: comparaisonActivee(comparaisonPlage, tropLarge),
  });

  const dispositionQuery = useQuery({
    queryKey: queryKeys.disposition('visites'),
    queryFn: () => fetchDisposition('visites'),
  });

  const [brouillon, setBrouillon] = useState<DashboardWidget[] | null>(null);
  const editing = brouillon !== null;
  const [snapshot, setSnapshot] = useState('');
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
      saveDisposition('visites', widgets, dispositionQuery.data?.preset, undefined),
    onSuccess: async () => {
      setBrouillon(null);
      if (pausedByEditionRef.current) {
        live.togglePause();
        pausedByEditionRef.current = false;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.disposition('visites') });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (widgets: DashboardWidget[]) =>
      saveDefaultDisposition('visites', widgets, dispositionQuery.data?.preset, undefined),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetDisposition('visites'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.disposition('visites') });
    },
  });

  const widgets = widgetsActifs(editing, brouillon, dispositionQuery.data, catalogue);

  const donneesParSource = donneesDuCatalogue(catalogue, statsQuery.data);
  const donneesParWidget = donneesDesWidgets(widgets, donneesParSource);

  const hasData = statsQuery.data !== undefined && dispositionQuery.data !== undefined;
  const isRefetching = statsQuery.isFetching && statsQuery.data !== undefined;

  const enterEdition = (): void => {
    if (dispositionQuery.data === undefined) return;
    const copie = dispositionQuery.data.widgets.map((widget) => ({ ...widget }));
    setSnapshot(JSON.stringify(serializeDisposition(copie)));
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

  const dirty = editing && JSON.stringify(serializeDisposition(brouillon)) !== snapshot;

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
              onAdd={(source, marqueChoisie) => {
                const donneesSource = donneesParSource.get(source);
                const forme = catalogue[source]?.forme;
                const marque =
                  marqueChoisie ??
                  (donneesSource === undefined || forme === undefined
                    ? undefined
                    : marqueRecommandee(forme, mesurerDonnees(donneesSource)));
                const id = `${source}-${String(Date.now())}`;
                avecTransition(() => {
                  setBrouillon((current) => [...(current ?? []), { id, source, marque }]);
                });
                dernierAjoutRef.current = id;
              }}
            />
          ) : (
            <>
              <BoutonReinitialiser
                disposition={dispositionQuery.data}
                pending={resetMutation.isPending}
                onReset={() => {
                  resetMutation.mutate();
                }}
              />
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
              <BoutonExportExcel
                preparer={() =>
                  classeurDesVisites(
                    plage,
                    periodeAffichee(filters),
                    blocsDesWidgets(widgets, catalogue, donneesParWidget),
                  )
                }
                disabled={!hasData || widgets.length === 0}
              />
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
          // Pas d'estompage pendant un rafraîchissement : il revenait toutes les
          // dix secondes et faisait clignoter la page. Les nombres roulent, cela suffit.
          return (
            <div aria-busy={isRefetching}>
              <WidgetGrid
                widgets={widgets}
                donnees={donneesParWidget}
                editing={editing}
                catalogue={catalogue}
                onReorder={(fromId, toId) => {
                  setBrouillon((current) => reordonner(current, fromId, toId));
                }}
                onRemove={(id) => {
                  avecTransition(() => {
                    setBrouillon((current) => current?.filter((w) => w.id !== id) ?? current);
                  });
                }}
                onMove={(id, direction) => {
                  avecTransition(() => {
                    setBrouillon((current) => decaler(current, id, direction));
                  });
                }}
                onChangeMarque={(id, marque) => {
                  setBrouillon((current) => modifier(current, id, { marque }));
                }}
                onChangeTaille={(id, taille) => {
                  avecTransition(() => {
                    setBrouillon((current) => modifier(current, id, { taille }));
                  });
                }}
                onChangePresentation={(id, presentation) => {
                  setBrouillon((current) => modifier(current, id, { presentation }));
                }}
              />
            </div>
          );
        })();
      })()}
    </div>
  );
}

function DashboardVisitesSkeleton() {
  return (
    <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
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
