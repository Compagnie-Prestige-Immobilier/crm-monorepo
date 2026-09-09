import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ImpressionDialog, type Orientation } from '@/components/accueil/impression-dialog';
import { OngletsVisites } from '@/components/accueil/onglets';
import { RegistreFiltres } from '@/components/accueil/registre-filtres';
import {
  AvisPagesImprimees,
  EnTeteRegistre,
  PaginationRegistre,
  RegistreTableau,
  RegistreVide,
  type PageRegistreAffichee,
} from '@/components/accueil/registre-tableau';
import { VisiteForm } from '@/components/accueil/visite-form';
import { QueryErrorState } from '@/components/query-error-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdaptateurFiltres } from '@/lib/filtres-url';
import { useFiltresUrl } from '@/lib/filtres-url';
import {
  COLONNES_IMPRESSION,
  compterFiltresVisite,
  ecrireFiltresVisite,
  fetchReferentielsVisite,
  fetchVisites,
  FILTRES_VISITE_VIDES,
  lireFiltresVisite,
  maintenantDakar,
  ordonnerVisites,
  TRIS_VISITE,
  type ColonneImpression,
  type FiltresVisite,
  type PageRegistre,
  type Visite,
} from '@/lib/data/visites';
import { queryKeys } from '@/lib/query-keys';
import type { Role } from '@/lib/types';

const ADAPTATEUR: AdaptateurFiltres<FiltresVisite> = {
  lire: lireFiltresVisite,
  ecrire: ecrireFiltresVisite,
  efface: () => FILTRES_VISITE_VIDES,
};

const TOUTES_COLONNES: ReadonlySet<ColonneImpression> = new Set(COLONNES_IMPRESSION);

function pageAffichee(meta: PageRegistre | undefined, pageSize: number): PageRegistreAffichee {
  const total = meta?.total ?? 0;
  const page = meta?.page ?? 1;
  return {
    total,
    page,
    pageCount: meta?.pageCount ?? 1,
    premiere: total === 0 ? 0 : (page - 1) * pageSize + 1,
    derniere: Math.min(page * pageSize, total),
  };
}

/**
 * Le classement du serveur fait foi dès qu'on trie sur autre chose que la date :
 * le re-tri « le plus récent en haut » contredirait un tri par nom.
 */
function ordreAffiche(items: readonly Visite[] | undefined, filtres: FiltresVisite): Visite[] {
  const brutes = items ?? [];
  return filtres.sortBy === 'visitedAt' ? ordonnerVisites(brutes) : [...brutes];
}

/** La journée seule : aucun critère posé, le registre n'est pas amputé. */
function estJourSeul(filtres: FiltresVisite): boolean {
  return !filtres.toutePeriode && compterFiltresVisite(filtres) === 0;
}

export function RegistreView({ role }: { role: Role }) {
  const queryClient = useQueryClient();
  const { filtres, setFiltres, reinitialiser } = useFiltresUrl(ADAPTATEUR);
  const [aujourdhui] = useState(() => maintenantDakar().date);
  const [corrigeeId, setCorrigeeId] = useState<string | null>(null);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  // Déplié d'emblée si un critère est déjà posé : sinon le registre paraîtrait
  // amputé sans qu'on voie pourquoi.
  const [rechercheOuverte, setRechercheOuverte] = useState(() => compterFiltresVisite(filtres) > 0);
  const [impressionOuverte, setImpressionOuverte] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [colonnesImprimees, setColonnesImprimees] = useState(TOUTES_COLONNES);

  const referentiels = useQuery({
    queryKey: queryKeys.visiteReferentielsRoot,
    queryFn: () => fetchReferentielsVisite(),
    staleTime: 5 * 60_000,
  });

  const registre = useQuery({
    queryKey: [...queryKeys.visitesRoot, ecrireFiltresVisite(filtres).toString(), aujourdhui],
    queryFn: () => fetchVisites(filtres, aujourdhui),
    placeholderData: keepPreviousData,
  });

  const page = pageAffichee(registre.data?.meta, filtres.pageSize);
  const visites = ordreAffiche(registre.data?.items, filtres);
  const jourSeul = estJourSeul(filtres);
  const vide = !registre.isPending && visites.length === 0;

  const rafraichir = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.visitesRoot });
  };

  const trier = (colonne: string): void => {
    if (!(TRIS_VISITE as readonly string[]).includes(colonne)) return;
    const cible = colonne as FiltresVisite['sortBy'];
    if (filtres.sortBy === cible) {
      setFiltres({ sortDir: filtres.sortDir === 'asc' ? 'desc' : 'asc' });
      return;
    }
    setFiltres({ sortBy: cible, sortDir: 'asc' });
  };

  return (
    <div className="flex flex-col gap-4">
      <style media="print">{`@page { size: ${orientation}; margin: 10mm; }`}</style>

      <OngletsVisites role={role} />

      <RegistreFiltres
        filtres={filtres}
        referentiels={referentiels.data}
        jourSeul={jourSeul}
        ouvert={rechercheOuverte}
        onOuvrir={() => {
          setRechercheOuverte((courant) => !courant);
        }}
        onAjouter={() => {
          setAjoutOuvert(true);
        }}
        onChange={setFiltres}
        onReinitialiser={reinitialiser}
      />

      <EnTeteRegistre
        total={page.total}
        jourSeul={jourSeul}
        imprimable={visites.length > 0}
        onImprimer={() => {
          setImpressionOuverte(true);
        }}
      />

      <AvisPagesImprimees page={page} />

      {registre.isPending ? <Skeleton className="h-64 w-full" /> : null}

      {registre.isError && registre.data === undefined ? (
        <QueryErrorState
          error={registre.error}
          onRetry={() => {
            void registre.refetch();
          }}
          fallback="Le registre n’a pas pu être chargé."
        />
      ) : null}

      {vide ? (
        <RegistreVide
          jourSeul={jourSeul}
          onToutLeRegistre={() => {
            setFiltres({ toutePeriode: true, dateFrom: null, dateTo: null });
          }}
        />
      ) : (
        <RegistreTableau
          visites={visites}
          colonnesImprimees={colonnesImprimees}
          corrigeeId={corrigeeId}
          referentiels={referentiels.data}
          filtres={filtres}
          rafraichissement={registre.isFetching}
          onTrier={trier}
          onCorriger={setCorrigeeId}
          onAnnuler={() => {
            setCorrigeeId(null);
          }}
          onCorrigee={() => {
            setCorrigeeId(null);
            rafraichir();
          }}
        />
      )}

      <PaginationRegistre
        page={page}
        onPage={(suivante) => {
          setFiltres({ page: suivante });
        }}
      />

      <Dialog open={ajoutOuvert} onOpenChange={setAjoutOuvert}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Enregistrer une visite</DialogTitle>
          </DialogHeader>
          {/* Le dialogue reste ouvert : le formulaire se remet en file de
              lui-même, entreprise conservée, focus sur le nom. L'accueil ferme
              quand il a fini sa file de visiteurs. */}
          <VisiteForm referentiels={referentiels.data} onSaved={rafraichir} />
        </DialogContent>
      </Dialog>

      <ImpressionDialog
        open={impressionOuverte}
        onOpenChange={setImpressionOuverte}
        orientation={orientation}
        onOrientationChange={setOrientation}
        colonnes={colonnesImprimees}
        onColonnesChange={setColonnesImprimees}
        filtres={filtres}
        aujourdhui={aujourdhui}
        total={page.total}
        lignesAffichees={visites.length}
      />
    </div>
  );
}
