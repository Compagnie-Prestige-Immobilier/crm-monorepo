'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheetIcon } from 'lucide-react';

import { meQueryOptions } from '@/api/auth';
import { WidgetGrid } from '@/components/accueil/tableau-de-bord/grille';
import {
  dashboardFiltersAdapter,
  periodeAffichee,
  plageDeFiltres,
  SelecteurPeriode,
} from '@/components/accueil/tableau-de-bord/selecteur-periode';
import { plageComparaison, plageTropLarge } from '@/components/accueil/tableau-de-bord/periode';
import {
  catalogueVisitesDe,
  type CatalogueEntree,
  type VisiteSource,
  type DonneesSource,
  type VisiteStats,
} from '@/components/accueil/tableau-de-bord/sources';
import {
  BoutonAjouterIndicateur,
  cartesDu,
  useTableauDeBord,
} from '@/components/accueil/tableau-de-bord/tableau';
import { BoutonExportExcel } from '@/components/dashboard/bouton-export-excel';
import { useUrlFilters } from '@/components/filters/use-url-filters';
import { LiveIndicator } from '@/components/live/live-indicator';
import { useLive } from '@/components/live/use-live';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { csvRows, downloadCsv } from '@/lib/csv';
import { resetDisposition, type DashboardWidget } from '@/lib/data/disposition';
import { fetchVisiteDashboardStats } from '@/lib/data/visites-dashboard';
import { formatDate, formatDateTime } from '@/lib/format';
import { LIVE_SLOW_INTERVAL_MS, shouldShowError, shouldShowSkeleton } from '@/lib/live';
import type { BlocTableauDeBord, ClasseurTableauDeBord } from '@/lib/tableau-de-bord-xlsx';
import { queryKeys } from '@/lib/query-keys';
import { peut, type Role } from '@/lib/types';

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
  entrees: Map<string, CatalogueEntree>,
  donneesParWidget: Map<string, DonneesSource>,
): BlocTableauDeBord[] {
  const blocs: BlocTableauDeBord[] = [];
  for (const widget of widgets) {
    const entree = entrees.get(widget.id);
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
  const { data: user } = useQuery(meQueryOptions);
  const peutDisposer = peut(user, 'chiffres.disposer');

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

  const tableau = useTableauDeBord('visites', plage);
  const dispositionQuery = tableau.dispositionQuery;

  const resetMutation = useMutation({
    mutationFn: () => resetDisposition('visites'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.disposition('visites') });
    },
  });

  const donneesParSource = donneesDuCatalogue(catalogue, statsQuery.data);
  const cartes = cartesDu(tableau, catalogue, donneesParSource);

  const hasData = statsQuery.data !== undefined && dispositionQuery.data !== undefined;
  const isRefetching = statsQuery.isFetching && statsQuery.data !== undefined;

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
        <div className="flex flex-wrap items-center gap-2">
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
                blocsDesWidgets(cartes.widgets, cartes.entrees, cartes.donnees),
              )
            }
            disabled={!hasData || cartes.widgets.length === 0}
          />
          {peutDisposer ? (
            <BoutonAjouterIndicateur
              ecran="visites"
              catalogue={catalogue}
              plage={plage}
              cleDonnees={[]}
              chargerSource={(source) => Promise.resolve(donneesParSource.get(source) ?? null)}
              onAjouter={tableau.ajouter}
            />
          ) : null}
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
              widgets={cartes.widgets}
              entrees={cartes.entrees}
              donnees={cartes.donnees}
              erreurs={cartes.erreurs}
              editable={peutDisposer}
              onReorder={tableau.deplacer}
              onRemove={(id) => {
                tableau.retirer(id, cartes.entrees.get(id)?.label ?? '');
              }}
              onChangeTaille={tableau.redimensionner}
            />
          </div>
        );
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
