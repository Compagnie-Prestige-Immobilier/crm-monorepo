import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { OngletsVisites } from '@/components/accueil/onglets';
import { catalogueVisites } from '@/components/accueil/sources-visites';
import { BarreTableauDeBord } from '@/components/accueil/tableau-de-bord-barre';
import {
  decaler,
  donneesParSource,
  donneesParWidget,
  modifier,
  reordonner,
  widgetsActifs,
  type Brouillon,
} from '@/components/accueil/tableau-de-bord-brouillon';
import { GrilleWidgets } from '@/components/tableau-de-bord/grille';
import { plageTropLarge } from '@/components/tableau-de-bord/periode';
import { marqueRecommandee } from '@/components/tableau-de-bord/recommandation';
import {
  adaptateurPeriode,
  periodeAffichee,
  plageDeFiltres,
  SelecteurPeriode,
} from '@/components/tableau-de-bord/selecteur-periode';
import { mesurerDonnees, type Marque } from '@/components/tableau-de-bord/sources';
import { useDispositionVisites } from '@/components/accueil/use-disposition-visites';
import { QueryErrorState } from '@/components/query-error-state';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { serializeDisposition, type Widget } from '@/lib/data/disposition';
import { fetchStatsVisites } from '@/lib/data/visites-stats';
import { useFiltresUrl } from '@/lib/filtres-url';
import { LIVE_SLOW_INTERVAL_MS } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';
import type { Role } from '@/lib/types';

const ADAPTATEUR = adaptateurPeriode('ce-mois');

function Squelette() {
  return (
    <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {[0, 1, 2].map((rang) => (
        <Card key={`tuile-${String(rang)}`}>
          <CardContent>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
          </CardContent>
        </Card>
      ))}
      {[0, 1, 2, 3].map((rang) => (
        <Card key={`graphique-${String(rang)}`} className="sm:col-span-2">
          <div className="px-5 pt-5">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="px-5 pt-3 pb-1">
            <Skeleton className="h-56 w-full rounded-md" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Le widget ajouté vient à l'écran et prend le focus : sinon il naît hors vue. */
function useDernierAjout(brouillon: Brouillon) {
  const dernierRef = useRef<string | null>(null);

  useEffect(() => {
    const id = dernierRef.current;
    if (id === null) return;
    dernierRef.current = null;
    const noeud = document.getElementById(`widget-${id}`);
    noeud?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    noeud?.focus();
  }, [brouillon]);

  return dernierRef;
}

interface EtatRequete {
  data: unknown;
  isError: boolean;
}

function etatEcran(
  stats: EtatRequete,
  disposition: EtatRequete,
): { pret: boolean; enPanne: boolean } {
  return {
    pret: stats.data !== undefined && disposition.data !== undefined,
    enPanne: stats.isError || disposition.isError,
  };
}

function estModifie(edition: boolean, widgets: readonly Widget[], empreinte: string): boolean {
  if (!edition) return false;
  return JSON.stringify(serializeDisposition(widgets)) !== empreinte;
}

export function TableauDeBordVisitesView({ role }: { role: Role }) {
  const { filtres, setFiltres } = useFiltresUrl(ADAPTATEUR);
  const plage = plageDeFiltres(filtres);
  const catalogue = catalogueVisites();

  const stats = useQuery({
    queryKey: queryKeys.visitesStats(plage.du, plage.au),
    queryFn: () => fetchStatsVisites(plage.du, plage.au),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_SLOW_INTERVAL_MS,
    enabled: !plageTropLarge(plage),
  });

  const { disposition, enregistrer, parDefaut, reinitialiser } = useDispositionVisites();

  const [brouillon, setBrouillon] = useState<Brouillon>(null);
  const [empreinte, setEmpreinte] = useState('');
  const dernierAjoutRef = useDernierAjout(brouillon);
  const edition = brouillon !== null;

  const widgets = widgetsActifs(edition, brouillon, disposition.data?.widgets, catalogue);
  const parSource = donneesParSource(catalogue, stats.data);
  const parWidget = donneesParWidget(widgets, parSource);
  const { pret, enPanne } = etatEcran(stats, disposition);
  const modifie = estModifie(edition, widgets, empreinte);

  // Le tiroir ne propose que les sources absentes : leur nom suffit à
  // identifier la carte ajoutée, sans horloge ni compteur.
  const ajouter = (source: string, marqueChoisie: Marque): void => {
    const donnee = parSource.get(source);
    const forme = catalogue[source]?.forme;
    const marque =
      donnee === undefined || forme === undefined
        ? marqueChoisie
        : marqueRecommandee(forme, mesurerDonnees(donnee));
    const id = `${source}-ajout`;
    setBrouillon((courant) => [...(courant ?? []), { id, source, marque }]);
    dernierAjoutRef.current = id;
  };

  return (
    <div className="flex flex-col gap-6">
      <OngletsVisites role={role} />

      <BarreTableauDeBord
        edition={edition}
        modifie={modifie}
        enregistrement={enregistrer.isPending}
        estAdmin={role === 'ADMIN'}
        pret={pret}
        dispositionUtilisateur={disposition.data?.source === 'utilisateur'}
        reinitialisation={reinitialiser.isPending}
        widgets={widgets}
        catalogue={catalogue}
        parSource={parSource}
        parWidget={parWidget}
        filtres={filtres}
        plage={plage}
        onAjouter={ajouter}
        onReinitialiser={() => {
          reinitialiser.mutate();
        }}
        onEntrer={() => {
          if (disposition.data === undefined) return;
          const copie = disposition.data.widgets.map((widget) => ({ ...widget }));
          setEmpreinte(JSON.stringify(serializeDisposition(copie)));
          setBrouillon(copie);
        }}
        onEnregistrer={() => {
          if (brouillon === null) return;
          enregistrer.mutate(brouillon, {
            onSuccess: () => {
              setBrouillon(null);
            },
          });
        }}
        onQuitter={() => {
          setBrouillon(null);
        }}
        onParDefaut={() => {
          if (brouillon !== null) parDefaut.mutate(brouillon);
        }}
      />

      <SelecteurPeriode filtres={filtres} onChange={setFiltres} />

      <p className="text-[0.9375rem] font-[600] text-foreground" aria-live="polite">
        {periodeAffichee(filtres)}
      </p>

      {enPanne ? (
        <QueryErrorState
          error={stats.error ?? disposition.error}
          onRetry={() => {
            void stats.refetch();
            void disposition.refetch();
          }}
          fallback="Le tableau de bord des visites n’a pas pu être calculé. Réessayez."
        />
      ) : null}

      {!pret && !enPanne ? <Squelette /> : null}

      {pret ? (
        // Pas d'estompage pendant un rafraîchissement : il revient chaque minute
        // et faisait clignoter la page. Les nombres roulent, cela suffit.
        <div aria-busy={stats.isFetching}>
          <GrilleWidgets
            widgets={widgets}
            donnees={parWidget}
            edition={edition}
            catalogue={catalogue}
            messageVide="Aucune visite sur la période."
            onReordonner={(deId, versId) => {
              setBrouillon((courant) => reordonner(courant, deId, versId));
            }}
            onRetirer={(id) => {
              setBrouillon((courant) => courant?.filter((widget) => widget.id !== id) ?? courant);
            }}
            onDecaler={(id, sens) => {
              setBrouillon((courant) => decaler(courant, id, sens));
            }}
            onMarque={(id, marque) => {
              setBrouillon((courant) => modifier(courant, id, { marque }));
            }}
            onTaille={(id, taille) => {
              setBrouillon((courant) => modifier(courant, id, { taille }));
            }}
            onPresentation={(id, presentation) => {
              setBrouillon((courant) => modifier(courant, id, { presentation }));
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
