'use client';

import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { meQueryOptions } from '@/api/auth';
import { QuestionsEpinglees } from '@/components/assistant/questions';
import { WidgetGrid } from '@/components/accueil/tableau-de-bord/grille';
import {
  plageDeFiltres,
  periodeAffichee,
  SelecteurPeriode,
} from '@/components/accueil/tableau-de-bord/selecteur-periode';
import type { CatalogueEntree, DonneesSource } from '@/components/accueil/tableau-de-bord/sources';
import {
  BoutonAjouterIndicateur,
  cartesDu,
  useTableauDeBord,
} from '@/components/accueil/tableau-de-bord/tableau';
import { chiffresFiltersAdapter, type ChiffresFilters } from '@/components/chiffres/filtres';
import { BoutonExportExcel } from '@/components/dashboard/bouton-export-excel';
import {
  catalogueDe,
  type Jeu,
  type Jeux,
  type SourceChiffre,
} from '@/components/chiffres/sources';
import { BoutonFiltres, classeRepliable } from '@/components/filters/bouton-filtres';
import { useUrlFilters } from '@/components/filters/use-url-filters';
import { LiveIndicator } from '@/components/live/live-indicator';
import { useLive } from '@/components/live/use-live';
import { QueryErrorState } from '@/components/query-error-state';
import { Button, buttonVariants } from '@/components/ui/button';
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
  fetchChiffresCampagnes,
  fetchChiffresCreneaux,
  fetchChiffresDelais,
  fetchChiffresEnrolement,
  fetchChiffresEntonnoir,
  fetchChiffresMethodes,
  fetchChiffresRendement,
  fetchChiffresRepresentants,
  type PerimetreChiffres,
  type Projet,
} from '@/lib/data/chiffres';
import { fetchLotsExport } from '@/lib/data/lots-export';
import { fetchComptageOuvertures } from '@/lib/data/ouvertures';
import {
  resetDisposition,
  type DashboardEcran,
  type DashboardWidget,
  type Disposition,
} from '@/lib/data/disposition';
import { callbackKeys, fetchCallbacks } from '@/lib/data/console';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import type { BlocTableauDeBord, ClasseurTableauDeBord } from '@/lib/tableau-de-bord-xlsx';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';
import { peut } from '@/lib/types';

/** Une requête par jeu, et seulement pour les jeux qu'une carte posée réclame. */
const CHARGEURS: Record<Jeu, (perimetre: PerimetreChiffres) => Promise<unknown>> = {
  activite: fetchChiffresActivite,
  entonnoir: fetchChiffresEntonnoir,
  delais: fetchChiffresDelais,
  rendement: fetchChiffresRendement,
  methodes: fetchChiffresMethodes,
  banques: fetchChiffresBanques,
  campagne: fetchChiffresCampagne,
  campagnes: fetchChiffresCampagnes,
  creneaux: fetchChiffresCreneaux,
  representants: fetchChiffresRepresentants,
  ouvertures: (perimetre) =>
    fetchComptageOuvertures({
      from: perimetre.plage.from,
      to: perimetre.plage.to,
      ...(perimetre.commercialId === null ? {} : { openedById: perimetre.commercialId }),
    }),
  enrolement: fetchChiffresEnrolement,
};

const clefDeJeu = (jeu: Jeu, perimetre: PerimetreChiffres): readonly unknown[] => [
  'chiffres',
  jeu,
  perimetre.projet,
  perimetre.plage.from,
  perimetre.plage.to,
  perimetre.commercialId,
  perimetre.lotId,
];

/** Une requête par jeu, et seulement pour les jeux qu'une carte posée réclame. */
function jeuxACharger(
  catalogue: Record<string, SourceChiffre>,
  widgets: readonly DashboardWidget[],
): Jeu[] {
  const sources = widgets.flatMap((widget) => {
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

function buildDonneesParSource(
  catalogue: Record<string, SourceChiffre>,
  jeux: Jeux,
): Map<string, DonneesSource> {
  const donnees = new Map<string, DonneesSource>();
  for (const [cle, source] of Object.entries(catalogue)) {
    const donnee = source.extraire(jeux);
    if (donnee !== null) donnees.set(cle, donnee);
  }
  return donnees;
}

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
      groupe: entree.groupe,
      donnees: donnee,
    });
  }
  return blocs;
}

function libelleNomProjet(projet: string | null): string {
  if (projet === null || projet === 'tous') return 'Tous les projets';
  if (projet === 'CHUES') return 'CHUES';
  return 'Grand Public';
}

function classeurDesChiffres(input: {
  projet: Projet | null;
  periode: string;
  plage: { du: string; au: string };
  equipe: readonly { id: string; fullName: string }[];
  teleconseiller: string | null;
  blocs: BlocTableauDeBord[];
}): ClasseurTableauDeBord {
  const nomProjet = libelleNomProjet(input.projet);
  const tagFichier = input.projet === null ? 'tous' : input.projet.toLowerCase();
  return {
    fichier: `cpi-tableau-de-bord-${tagFichier}-${input.plage.du}-${input.plage.au}`,
    titre: `Tableau de bord ${nomProjet}`,
    sousTitre: input.periode,
    reperes: [
      { libelle: 'Projet', valeur: nomProjet },
      {
        libelle: 'Période',
        valeur: `du ${formatDate(input.plage.du)} au ${formatDate(input.plage.au)}`,
      },
      { libelle: 'Téléconseiller', valeur: nomDeLEquipe(input.equipe, input.teleconseiller) },
      { libelle: 'Chiffres repris', valeur: String(input.blocs.length) },
      { libelle: 'Édité le', valeur: formatDateTime(new Date().toISOString()) },
    ],
    blocs: input.blocs,
  };
}

function equipeDe(jeux: Jeux): readonly { id: string; fullName: string }[] {
  return jeux.activite?.teleconseillers ?? [];
}

/**
 * EB-13 : la file de rappel s'atteint depuis le tableau de bord, avec son
 * compte du jour. Elle suit le téléconseiller regardé.
 */
function LienRappels({
  projet,
  teleconseiller,
}: {
  projet: Projet | null;
  teleconseiller: string | null;
}) {
  const rappels = useQuery({
    queryKey: [...callbackKeys.list('today', teleconseiller), projet],
    queryFn: () => fetchCallbacks('today', teleconseiller, undefined, projet ?? undefined),
    retry: false,
  });

  return (
    <Link
      href="/teleconseil/rappels"
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      À rappeler
      {rappels.data === undefined
        ? null
        : ` · ${formatNumber(rappels.data.items.length)} aujourd’hui`}
    </Link>
  );
}

function SelecteurCampagne({
  projet,
  value,
  onChange,
}: {
  projet: Projet | null;
  value: string | null;
  onChange: (campagne: string | null) => void;
}) {
  const query = {
    page: 1,
    pageSize: 50,
    ...(projet === null ? {} : { projet }),
  };
  const campagnes = useQuery({
    queryKey: ['chiffres', 'campagnes-du-filtre', projet],
    queryFn: () => fetchLotsExport(query),
  });
  const lots = campagnes.data?.items ?? [];
  const nomDeLaCampagne = (id: string): string =>
    id === 'toutes' ? 'Toutes les campagnes' : (lots.find((lot) => lot.id === id)?.name ?? '');

  // Même liste que « Projet » et « Équipe » : les trois filtres se lisent d'un
  // seul regard, même hauteur, même bord, même flèche.
  return (
    <Select
      value={value ?? 'toutes'}
      onValueChange={(choix) => {
        if (choix === null) return;
        onChange(choix === 'toutes' ? null : choix);
      }}
    >
      <SelectTrigger size="sm" aria-label="Campagne regardée" className="w-64">
        <SelectValue>{nomDeLaCampagne}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="toutes">Toutes les campagnes</SelectItem>
        {lots.map((lot) => (
          <SelectItem key={lot.id} value={lot.id}>
            {lot.name}
            <span className="ml-2 text-[0.75rem] text-muted-foreground">
              {formatDate(lot.createdAt)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ChiffresView({ ecran }: { ecran: DashboardEcran }) {
  const { filters, setFilters } = useUrlFilters(chiffresFiltersAdapter);
  const live = useLive();
  const queryClient = useQueryClient();
  const { data: user } = useQuery(meQueryOptions);
  const [filtresOuverts, setFiltresOuverts] = useState(false);

  const projet: Projet | null = filters.projet;
  const voitLesMontants = peut(user, 'chiffres.voir_montants');
  const voitLEnrolement = peut(user, 'enrolement.administrer');
  const catalogue = catalogueDe({ chues: true, voitLesMontants, voitLEnrolement, projet });

  const plage = plageDeFiltres(filters);
  const perimetre: PerimetreChiffres = {
    projet,
    plage: { from: plage.du, to: plage.au },
    commercialId: filters.teleconseiller,
    lotId: filters.campagne,
  };

  const tableau = useTableauDeBord(ecran, plage);
  const dispositionQuery = tableau.dispositionQuery;

  const resetMutation = useMutation({
    mutationFn: () => resetDisposition(ecran),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.disposition(ecran) });
    },
  });

  const aCharger = jeuxACharger(catalogue, tableau.widgets);
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

  const donneesParSource = buildDonneesParSource(catalogue, jeux);
  const cartes = cartesDu(tableau, catalogue, donneesParSource);
  const equipe = equipeDe(jeux);
  const peutDisposer = peut(user, 'chiffres.disposer');

  const chargerSource = async (cle: string): Promise<DonneesSource | null> => {
    const source = catalogue[cle];
    if (source === undefined) return null;
    const donnee = await queryClient.fetchQuery({
      queryKey: clefDeJeu(source.jeu, perimetre),
      queryFn: () => CHARGEURS[source.jeu](perimetre),
    });
    return source.extraire({ [source.jeu]: donnee });
  };

  function preparerClasseur(): ClasseurTableauDeBord {
    return classeurDesChiffres({
      projet,
      periode: periodeAffichee(filters),
      plage,
      equipe,
      teleconseiller: filters.teleconseiller,
      blocs: blocsDesWidgets(cartes.widgets, cartes.entrees, cartes.donnees),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ChiffresToolbar
        filters={filters}
        onFiltersChange={setFilters}
        filtresOuverts={filtresOuverts}
        onBasculerFiltres={() => {
          setFiltresOuverts(!filtresOuverts);
        }}
        equipe={equipe}
        projet={projet}
        live={live}
        enErreur={enErreur}
        dataUpdatedAt={dataUpdatedAt}
        dispositionSource={dispositionQuery.data?.source}
        onReset={() => {
          resetMutation.mutate();
        }}
        resetPending={resetMutation.isPending}
        constructeur={
          peutDisposer ? (
            <BoutonAjouterIndicateur
              ecran={ecran}
              catalogue={catalogue}
              plage={plage}
              cleDonnees={[projet, filters.teleconseiller, filters.campagne]}
              chargerSource={chargerSource}
              onAjouter={tableau.ajouter}
            />
          ) : null
        }
        onPreparerClasseur={preparerClasseur}
        exportPret={hasData && cartes.widgets.length > 0}
      />

      {peut(user, 'assistant.utiliser') ? <QuestionsEpinglees /> : null}

      {/* « Comparer à » n'agit que sur le registre des visites : ici il serait inerte. */}
      <div className={classeRepliable(filtresOuverts)}>
        <SelecteurPeriode filters={filters} onChange={setFilters} comparaison={false} />
      </div>

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

        if (cartes.widgets.length === 0)
          return (
            <Card>
              <CardContent className="py-10 text-center text-[0.9375rem] text-muted-foreground">
                Aucun indicateur ici. Ajoutez-en un avec « Ajouter un indicateur ».
              </CardContent>
            </Card>
          );

        return (
          <div aria-busy={isRefetching}>
            <WidgetGrid
              widgets={cartes.widgets}
              entrees={cartes.entrees}
              donnees={cartes.donnees}
              erreurs={cartes.erreurs}
              editable={peutDisposer}
              messageVide="Rien sur la période."
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

function ChiffresToolbar({
  filters,
  onFiltersChange,
  filtresOuverts,
  onBasculerFiltres,
  equipe,
  projet,
  live,
  enErreur,
  dataUpdatedAt,
  dispositionSource,
  onReset,
  resetPending,
  constructeur,
  onPreparerClasseur,
  exportPret,
}: {
  filters: ChiffresFilters;
  onFiltersChange: (patch: Partial<ChiffresFilters>) => void;
  filtresOuverts: boolean;
  onBasculerFiltres: () => void;
  equipe: readonly { id: string; fullName: string }[];
  projet: Projet | null;
  live: ReturnType<typeof useLive>;
  enErreur: boolean;
  dataUpdatedAt: number;
  dispositionSource: Disposition['source'] | undefined;
  onReset: () => void;
  resetPending: boolean;
  constructeur: ReactNode;
  onPreparerClasseur: () => ClasseurTableauDeBord;
  exportPret: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[0.9375rem] font-[600] text-foreground" aria-live="polite">
          {periodeAffichee(filters)}
        </p>
        <BoutonFiltres ouverts={filtresOuverts} onBasculer={onBasculerFiltres} />
        <div className={classeRepliable(filtresOuverts)}>
          <Select
            value={filters.projet ?? 'tous'}
            onValueChange={(value) => {
              if (value === null) return;
              onFiltersChange({ projet: value === 'tous' ? null : (value as Projet) });
            }}
          >
            <SelectTrigger size="sm" aria-label="Projet regardé" className="w-40">
              <SelectValue>{(valeur: string) => libelleNomProjet(valeur)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les projets</SelectItem>
              <SelectItem value="CHUES">CHUES</SelectItem>
              <SelectItem value="GRAND_PUBLIC">Grand Public</SelectItem>
            </SelectContent>
          </Select>
          {equipe.length > 0 ? (
            <Select
              value={filters.teleconseiller ?? 'tous'}
              onValueChange={(value) => {
                if (value === null) return;
                onFiltersChange({ teleconseiller: value === 'tous' ? null : value });
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
          <SelecteurCampagne
            projet={projet}
            value={filters.campagne}
            onChange={(campagne) => {
              onFiltersChange({ campagne });
            }}
          />
          <LienRappels projet={projet} teleconseiller={filters.teleconseiller} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <LiveIndicator
          state={live.stateOf(enErreur)}
          label={live.labelOf(enErreur)}
          updatedAt={dataUpdatedAt === 0 ? null : dataUpdatedAt}
          onTogglePause={live.togglePause}
        />
        {dispositionSource === 'utilisateur' ? (
          <Button type="button" variant="ghost" disabled={resetPending} onClick={onReset}>
            Revenir à l’écran par défaut
          </Button>
        ) : null}
        <BoutonExportExcel preparer={onPreparerClasseur} disabled={!exportPret} />
        {constructeur}
      </div>
    </div>
  );
}

export function ChiffresSkeleton() {
  return (
    <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
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
