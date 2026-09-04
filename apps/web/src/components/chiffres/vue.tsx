'use client';

import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { BarreEdition } from '@/components/accueil/tableau-de-bord/barre-edition';
import { WidgetGrid } from '@/components/accueil/tableau-de-bord/grille';
import { marqueRecommandee } from '@/components/accueil/tableau-de-bord/recommandation';
import {
  plageDeFiltres,
  periodeAffichee,
  SelecteurPeriode,
} from '@/components/accueil/tableau-de-bord/selecteur-periode';
import { mesurerDonnees, type DonneesSource } from '@/components/accueil/tableau-de-bord/sources';
import { TiroirWidgets } from '@/components/accueil/tableau-de-bord/tiroir-widgets';
import { chiffresFiltersAdapter } from '@/components/chiffres/filtres';
import {
  catalogueDe,
  type Jeu,
  type Jeux,
  type SourceChiffre,
} from '@/components/chiffres/sources';
import { useUrlFilters } from '@/components/filters/use-url-filters';
import { LiveIndicator } from '@/components/live/live-indicator';
import { useLive } from '@/components/live/use-live';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  fetchChiffresActivite,
  fetchChiffresBanques,
  fetchChiffresCampagne,
  fetchChiffresDelais,
  fetchChiffresEntonnoir,
  fetchChiffresMethodes,
  fetchChiffresRendement,
  type PerimetreChiffres,
  type Projet,
} from '@/lib/data/chiffres';
import {
  fetchDisposition,
  resetDisposition,
  saveDefaultDisposition,
  saveDisposition,
  serializeDisposition,
  type DashboardEcran,
  type DashboardWidget,
} from '@/lib/data/disposition';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';
import type { Role } from '@/lib/types';

/** Une requête par jeu, et seulement pour les jeux qu'une carte posée réclame. */
const CHARGEURS: Record<Jeu, (perimetre: PerimetreChiffres) => Promise<unknown>> = {
  activite: fetchChiffresActivite,
  entonnoir: fetchChiffresEntonnoir,
  delais: fetchChiffresDelais,
  rendement: fetchChiffresRendement,
  methodes: fetchChiffresMethodes,
  banques: fetchChiffresBanques,
  campagne: fetchChiffresCampagne,
};

const clefDeJeu = (jeu: Jeu, perimetre: PerimetreChiffres): readonly unknown[] => [
  'chiffres',
  jeu,
  perimetre.projet,
  perimetre.plage.from,
  perimetre.plage.to,
  perimetre.commercialId,
];

/**
 * Le tiroir a besoin d'une donnée pour conseiller une forme, mais l'ouvrir ne
 * doit pas déclencher six requêtes lourdes : en composition on charge tout, en
 * lecture seulement ce que les cartes posées réclament.
 */
function jeuxACharger(
  catalogue: Record<string, SourceChiffre>,
  widgets: readonly DashboardWidget[],
  editing: boolean,
): Jeu[] {
  const sources = editing
    ? Object.values(catalogue)
    : widgets.flatMap((widget) => {
        const source = catalogue[widget.source];
        return source === undefined ? [] : [source];
      });
  return [...new Set(sources.map((source) => source.jeu))];
}

const TOUTE_L_EQUIPE = 'Toute l’équipe';

/** Le nom porté par le déclencheur du sélecteur, jamais l'identifiant. */
function nomDeLEquipe(
  equipe: readonly { id: string; fullName: string }[],
  valeur: string | null,
): string {
  if (valeur === null || valeur === 'tous') return TOUTE_L_EQUIPE;
  return equipe.find((personne) => personne.id === valeur)?.fullName ?? TOUTE_L_EQUIPE;
}

interface ResultatDeJeu {
  data: unknown;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
  dataUpdatedAt: number;
}

/** Les six requêtes lues comme UN état : ce qui est arrivé, ce qui manque, ce qui a cassé. */
function etatDesJeux(
  aCharger: readonly Jeu[],
  resultats: readonly ResultatDeJeu[],
): {
  jeux: Jeux;
  enErreur: boolean;
  premiereErreur: unknown;
  toutCharge: boolean;
  isRefetching: boolean;
  dataUpdatedAt: number;
} {
  const jeux: Jeux = {};
  aCharger.forEach((jeu, index) => {
    const donnee = resultats[index]?.data;
    if (donnee !== undefined) Object.assign(jeux, { [jeu]: donnee });
  });

  return {
    jeux,
    enErreur: resultats.some((resultat) => resultat.isError),
    premiereErreur: resultats.find((resultat) => resultat.isError)?.error ?? null,
    toutCharge: aCharger.length === 0 || resultats.every((r) => r.data !== undefined),
    isRefetching: resultats.some((r) => r.isFetching && r.data !== undefined),
    dataUpdatedAt: Math.max(0, ...resultats.map((r) => r.dataUpdatedAt)),
  };
}

export function ChiffresView({ ecran, role }: { ecran: DashboardEcran; role: Role }) {
  const { filters, setFilters } = useUrlFilters(chiffresFiltersAdapter);
  const live = useLive();
  const queryClient = useQueryClient();

  const projet: Projet = ecran === 'chues' ? 'CHUES' : 'GRAND_PUBLIC';
  const voitLesMontants = role === 'ADMIN' || role === 'DIRECTION';
  const catalogue = catalogueDe({ chues: ecran === 'chues', voitLesMontants, role });

  const plage = plageDeFiltres(filters);
  const perimetre: PerimetreChiffres = {
    projet,
    plage: { from: plage.du, to: plage.au },
    commercialId: filters.teleconseiller,
  };

  const dispositionQuery = useQuery({
    queryKey: queryKeys.disposition(ecran),
    queryFn: () => fetchDisposition(ecran),
  });

  const [brouillon, setBrouillon] = useState<DashboardWidget[] | null>(null);
  const editing = brouillon !== null;
  const [snapshot, setSnapshot] = useState('');
  const pausedByEditionRef = useRef(false);

  const saveMutation = useMutation({
    mutationFn: (widgets: DashboardWidget[]) =>
      saveDisposition(ecran, widgets, dispositionQuery.data?.preset, undefined),
    onSuccess: async () => {
      setBrouillon(null);
      if (pausedByEditionRef.current) {
        live.togglePause();
        pausedByEditionRef.current = false;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.disposition(ecran) });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (widgets: DashboardWidget[]) =>
      saveDefaultDisposition(ecran, widgets, dispositionQuery.data?.preset, undefined),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetDisposition(ecran),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.disposition(ecran) });
    },
  });

  const widgets = (editing ? brouillon : (dispositionQuery.data?.widgets ?? [])).filter(
    (widget) => catalogue[widget.source] !== undefined,
  );
  const aCharger = jeuxACharger(catalogue, widgets, editing);

  const resultats = useQueries({
    queries: aCharger.map((jeu) => ({
      queryKey: clefDeJeu(jeu, perimetre),
      queryFn: () => CHARGEURS[jeu](perimetre),
      refetchInterval: live.refetchInterval,
      placeholderData: keepPreviousData,
    })),
  });

  const { jeux, enErreur, premiereErreur, toutCharge, isRefetching, dataUpdatedAt } = etatDesJeux(
    aCharger,
    resultats,
  );
  const hasData = dispositionQuery.data !== undefined && toutCharge;

  const donneesParSource = new Map<string, DonneesSource>();
  for (const [cle, source] of Object.entries(catalogue)) {
    const donnee = source.extraire(jeux);
    if (donnee !== null) donneesParSource.set(cle, donnee);
  }
  const donneesParWidget = new Map<string, DonneesSource>();
  for (const widget of widgets) {
    const donnee = donneesParSource.get(widget.source);
    if (donnee !== undefined) donneesParWidget.set(widget.id, donnee);
  }

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
  const equipe = jeux.activite?.teleconseillers ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[0.9375rem] font-[600] text-foreground" aria-live="polite">
            {periodeAffichee(filters)}
          </p>
          {equipe.length > 0 ? (
            <Select
              value={filters.teleconseiller ?? 'tous'}
              onValueChange={(value) => {
                if (value === null) return;
                setFilters({ teleconseiller: value === 'tous' ? null : value });
              }}
            >
              <SelectTrigger size="sm" aria-label="Téléconseiller regardé" className="w-56">
                {/* Sans cette fonction, Base UI rend la VALEUR de l'item : le
                    déclencheur affichait l'identifiant du téléconseiller. */}
                <SelectValue>{(valeur: string) => nomDeLEquipe(equipe, valeur)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">{TOUTE_L_EQUIPE}</SelectItem>
                {equipe.map((personne) => (
                  <SelectItem key={personne.id} value={personne.id}>
                    {personne.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveIndicator
            state={live.stateOf(enErreur)}
            label={live.labelOf(enErreur)}
            updatedAt={dataUpdatedAt === 0 ? null : dataUpdatedAt}
            onTogglePause={live.togglePause}
          />
          {editing ? (
            <TiroirWidgets
              placees={placees}
              donnees={donneesParSource}
              catalogue={catalogue}
              onAdd={(source, marqueChoisie) => {
                const donneesSource = donneesParSource.get(source);
                const forme = catalogue[source]?.forme;
                const marque =
                  marqueChoisie ??
                  (donneesSource === undefined || forme === undefined
                    ? undefined
                    : marqueRecommandee(forme, mesurerDonnees(donneesSource)));
                setBrouillon((current) => [
                  ...(current ?? []),
                  { id: `${source}-${String(Date.now())}`, source, marque, taille: 'demi' },
                ]);
              }}
            />
          ) : (
            dispositionQuery.data?.source === 'utilisateur' && (
              <Button
                type="button"
                variant="ghost"
                disabled={resetMutation.isPending}
                onClick={() => {
                  resetMutation.mutate();
                }}
              >
                Revenir à l’écran par défaut
              </Button>
            )
          )}
          <BarreEdition
            editing={editing}
            dirty={dirty}
            pending={saveMutation.isPending}
            isAdmin={role === 'ADMIN'}
            entryLabel="Composer l’écran"
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

      {/* « Comparer à » n'agit que sur le registre des visites : ici il serait inerte. */}
      <SelecteurPeriode filters={filters} onChange={setFilters} comparaison={false} />

      {(() => {
        if (shouldShowError({ isError: enErreur || dispositionQuery.isError, hasData }))
          return (
            <QueryErrorState
              error={premiereErreur ?? dispositionQuery.error}
              onRetry={() => {
                for (const resultat of resultats) void resultat.refetch();
                void dispositionQuery.refetch();
              }}
              fallback="Les chiffres n’ont pas pu être calculés. Réessayez."
            />
          );

        if (
          shouldShowSkeleton({
            isPending: dispositionQuery.isPending || !toutCharge,
            hasData,
          })
        )
          return <ChiffresSkeleton />;

        if (widgets.length === 0)
          return (
            <Card>
              <CardContent className="py-10 text-center text-[0.9375rem] text-muted-foreground">
                Cet écran est vide. Ouvrez « Composer l’écran » pour y poser vos chiffres.
              </CardContent>
            </Card>
          );

        return (
          <div aria-busy={isRefetching}>
            <WidgetGrid
              widgets={widgets}
              donnees={donneesParWidget}
              editing={editing}
              catalogue={catalogue}
              messageVide="Rien sur la période."
              onReorder={(fromId, toId) => {
                setBrouillon((current) => deplacer(current, fromId, toId));
              }}
              onRemove={(id) => {
                setBrouillon((current) => current?.filter((w) => w.id !== id) ?? current);
              }}
              onMove={(id, direction) => {
                setBrouillon((current) => decaler(current, id, direction));
              }}
              onChangeMarque={(id, marque) => {
                setBrouillon(
                  (current) => current?.map((w) => (w.id === id ? { ...w, marque } : w)) ?? current,
                );
              }}
              onChangeTaille={(id, taille) => {
                setBrouillon(
                  (current) => current?.map((w) => (w.id === id ? { ...w, taille } : w)) ?? current,
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
      })()}
    </div>
  );
}

function deplacer(
  current: DashboardWidget[] | null,
  fromId: string,
  toId: string,
): DashboardWidget[] | null {
  if (current === null) return current;
  const fromIndex = current.findIndex((w) => w.id === fromId);
  const toIndex = current.findIndex((w) => w.id === toId);
  if (fromIndex === -1 || toIndex === -1) return current;
  const next = [...current];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return current;
  next.splice(toIndex, 0, moved);
  return next;
}

function decaler(
  current: DashboardWidget[] | null,
  id: string,
  direction: -1 | 1,
): DashboardWidget[] | null {
  if (current === null) return current;
  const index = current.findIndex((w) => w.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= current.length) return current;
  const next = [...current];
  const [moved] = next.splice(index, 1);
  if (moved === undefined) return current;
  next.splice(target, 0, moved);
  return next;
}

export function ChiffresSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <Card key={`tuile-${String(index)}`}>
          <CardContent>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
          </CardContent>
        </Card>
      ))}
      {[0, 1].map((index) => (
        <Card key={`bloc-${String(index)}`} className="sm:col-span-2 xl:col-span-2">
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
