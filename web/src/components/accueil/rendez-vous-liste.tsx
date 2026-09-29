'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ClosingDialog } from '@/components/accueil/closing-dialog';
import { ActionsRendezVous } from '@/components/accueil/rendez-vous-actions';
import { BarreRendezVous } from '@/components/accueil/rendez-vous-filtres';
import { Groupes } from '@/components/accueil/rendez-vous-tableau';
import { VisiteDuRendezVous } from '@/components/accueil/visite-du-rendez-vous';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CLE_RENDEZ_VOUS,
  type FiltresRendezVous,
  lireRendezVous,
  type RendezVousObtenu,
} from '@/lib/data/rendez-vous';

function Resultats({
  items,
  pageCount,
  page,
  filtre,
  historique,
  actions,
  setPage,
}: {
  items: RendezVousObtenu[];
  pageCount: number;
  page: number;
  filtre: boolean;
  historique: boolean;
  actions: (fiche: RendezVousObtenu) => React.ReactNode;
  setPage: (page: number) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {filtre
          ? 'Aucun rendez-vous pour cette recherche. Videz la recherche ou le type.'
          : 'Aucun rendez-vous ici. Les rendez-vous pris au téléphone arrivent dans « À traiter ».'}
      </p>
    );
  }
  return (
    <>
      <Groupes items={items} historique={historique} actions={actions} />
      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              setPage(page - 1);
            }}
          >
            Précédents
          </Button>
          <span className="tabular-nums">
            Page {page} sur {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => {
              setPage(page + 1);
            }}
          >
            Suivants
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function RendezVousListe({
  historique,
  peutNoter,
  peutCloser,
  peutExporter,
  peutEnregistrerVisite,
}: {
  historique: boolean;
  peutNoter: boolean;
  peutCloser: boolean;
  peutExporter: boolean;
  peutEnregistrerVisite: boolean;
}) {
  const [filtres, setFiltres] = useState<FiltresRendezVous>({
    historique,
    type: '',
    search: '',
    page: 1,
  });
  const changer = (patch: Partial<FiltresRendezVous>) => {
    setFiltres((avant) => ({ ...avant, page: 1, ...patch }));
  };
  const [closingDe, setClosingDe] = useState<RendezVousObtenu | null>(null);
  const [visiteDe, setVisiteDe] = useState<RendezVousObtenu | null>(null);
  const liste = useQuery({
    queryKey: [...CLE_RENDEZ_VOUS, { ...filtres, historique }],
    queryFn: () => lireRendezVous({ ...filtres, historique }),
  });
  const onEnregistrerVisite = peutEnregistrerVisite ? setVisiteDe : null;
  const actions = (fiche: RendezVousObtenu) => (
    <ActionsRendezVous
      fiche={fiche}
      peutNoter={peutNoter}
      peutCloser={peutCloser}
      onCloser={setClosingDe}
      onEnregistrerVisite={onEnregistrerVisite}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <BarreRendezVous filtres={filtres} changer={changer} peutExporter={peutExporter} />
      {liste.isError ? (
        <QueryErrorState error={liste.error} onRetry={() => void liste.refetch()} />
      ) : null}
      {liste.isPending ? <Skeleton className="h-64 w-full rounded-lg" /> : null}
      {liste.data === undefined ? null : (
        <Resultats
          items={liste.data.items}
          pageCount={liste.data.pageCount}
          page={filtres.page}
          filtre={filtres.search !== '' || filtres.type !== ''}
          historique={historique}
          actions={actions}
          setPage={(page) => {
            setFiltres((avant) => ({ ...avant, page }));
          }}
        />
      )}
      <ClosingDialog
        rendezVous={closingDe}
        onClose={() => {
          setClosingDe(null);
        }}
      />
      <VisiteDuRendezVous
        rendezVous={visiteDe}
        onClose={() => {
          setVisiteDe(null);
        }}
      />
    </div>
  );
}
