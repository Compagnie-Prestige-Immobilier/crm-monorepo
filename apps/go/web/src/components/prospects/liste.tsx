import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { FileSpreadsheetIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { BarreFiltresProspects } from '@/components/prospects/barre-filtres';
import {
  ADAPTATEUR_PROSPECTS,
  TAILLES_PAGE,
  urlExport,
  type FiltresProspects,
  type TriProspects,
} from '@/components/prospects/filtres';
import { DialoguesProspects, type EtatsDialogues } from '@/components/prospects/liste-dialogues';
import {
  ProspectsVides,
  TableauProspects,
  type ActionsProspect,
} from '@/components/prospects/liste-tableau';
import { QueryErrorState } from '@/components/query-error-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { ChampSelect } from '@/components/ui/champ-select';
import { PiedDeListe, SqueletteTableau } from '@/components/ui/pied-de-liste';
import type { PageProspects } from '@/lib/data/grand-public';
import { fetchProspects, supprimerProspect, type Prospect } from '@/lib/data/prospects';
import { useFiltresUrl } from '@/lib/filtres-url';
import { formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';
import { cn } from '@/lib/utils';

function ContenuProspects({
  liste,
  projet,
  peutAdministrer,
  porteeCampagne,
  sortBy,
  sortDir,
  onTrier,
  actions,
}: {
  liste: UseQueryResult<PageProspects>;
  projet: Projet;
  peutAdministrer: boolean;
  porteeCampagne: boolean;
  sortBy: TriProspects;
  sortDir: 'asc' | 'desc';
  onTrier: (id: string) => void;
  actions: ActionsProspect | null;
}) {
  if (liste.isPending) return <SqueletteTableau lignes={8} />;
  if (liste.isError) {
    return (
      <QueryErrorState
        error={liste.error}
        onRetry={() => {
          void liste.refetch();
        }}
        fallback="La liste des prospects n’a pas pu être chargée."
      />
    );
  }
  if (liste.data.items.length === 0) return <ProspectsVides porteeCampagne={porteeCampagne} />;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm transition-opacity',
        liste.isFetching && 'opacity-80',
      )}
    >
      <TableauProspects
        items={liste.data.items}
        projet={projet}
        peutAdministrer={peutAdministrer}
        sortBy={sortBy}
        sortDir={sortDir}
        onTrier={onTrier}
        actions={actions}
      />
    </div>
  );
}

function EnTeteProspects({
  filtres,
  total,
  lectureSeule,
  onNouveau,
}: {
  filtres: FiltresProspects;
  total: number | null;
  lectureSeule: boolean;
  onNouveau: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[0.9375rem] text-muted-foreground">
        <span aria-live="polite" className="font-[600] text-foreground tabular-nums">
          {total === null ? '–' : formatNumber(total)}
        </span>{' '}
        prospect{total !== null && total > 1 ? 's' : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        {lectureSeule ? null : (
          <>
            <a href={urlExport(filtres)} className={buttonVariants({ variant: 'outline' })}>
              <FileSpreadsheetIcon aria-hidden="true" />
              Exporter la vue filtrée
            </a>
            <Button onClick={onNouveau}>
              <PlusIcon aria-hidden="true" />
              Nouveau prospect
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function ListeProspects({
  projet,
  peutAdministrer,
  lectureSeule = false,
  porteeCampagne = false,
}: {
  projet: Projet;
  peutAdministrer: boolean;
  lectureSeule?: boolean;
  /** Téléconseiller : l'API ne lui rend que ses fiches et celles de ses campagnes. */
  porteeCampagne?: boolean;
}) {
  const queryClient = useQueryClient();
  const { filtres, setFiltres, reinitialiser } = useFiltresUrl(ADAPTATEUR_PROSPECTS);

  const [creation, setCreation] = useState(false);
  const [enEdition, setEnEdition] = useState<Prospect | null>(null);
  const [enFusion, setEnFusion] = useState<Prospect | null>(null);
  const [enReaffectation, setEnReaffectation] = useState<Prospect | null>(null);
  const [aSupprimer, setASupprimer] = useState<Prospect | null>(null);

  const liste = useQuery({
    queryKey: queryKeys.prospects(filtres),
    queryFn: () => fetchProspects(filtres),
    placeholderData: (precedent) => precedent,
  });

  const supprimer = useMutation({
    mutationFn: (cible: Prospect) => supprimerProspect(cible.id),
    onSuccess: (_vide, cible) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      toast.success(`${cible.prenom} ${cible.nom} supprimé. Le numéro redevient disponible.`);
      setASupprimer(null);
    },
    onError: (erreur) => {
      toastApiError(erreur, 'La suppression a échoué.');
    },
  });

  function trier(id: string): void {
    if (filtres.sortBy === id) {
      setFiltres({ sortDir: filtres.sortDir === 'asc' ? 'desc' : 'asc' });
      return;
    }
    setFiltres({ sortBy: id as TriProspects, sortDir: 'asc' });
  }

  const fermer = (cle: keyof EtatsDialogues): void => {
    const fermetures: Record<keyof EtatsDialogues, () => void> = {
      creation: () => {
        setCreation(false);
      },
      edition: () => {
        setEnEdition(null);
      },
      fusion: () => {
        setEnFusion(null);
      },
      reaffectation: () => {
        setEnReaffectation(null);
      },
      suppression: () => {
        setASupprimer(null);
      },
    };
    fermetures[cle]();
  };

  const actions: ActionsProspect = {
    onModifier: setEnEdition,
    onFusionner: setEnFusion,
    onReaffecter: setEnReaffectation,
    onSupprimer: setASupprimer,
  };

  return (
    <div className="flex flex-col gap-6">
      <EnTeteProspects
        filtres={filtres}
        total={liste.data?.total ?? null}
        lectureSeule={lectureSeule}
        onNouveau={() => {
          setCreation(true);
        }}
      />

      <BarreFiltresProspects
        filtres={filtres}
        setFiltres={setFiltres}
        reinitialiser={reinitialiser}
      />

      <ContenuProspects
        liste={liste}
        projet={projet}
        peutAdministrer={peutAdministrer}
        porteeCampagne={porteeCampagne}
        sortBy={filtres.sortBy}
        sortDir={filtres.sortDir}
        onTrier={trier}
        actions={lectureSeule ? null : actions}
      />

      {liste.data === undefined ? null : (
        <PiedDeListe
          quoi="Prospects affichés"
          total={liste.data.total}
          page={liste.data.page}
          pageCount={liste.data.pageCount}
          pageSize={filtres.pageSize}
          actions={
            <ChampSelect
              id="prospects-taille-page"
              label="Lignes"
              className="w-28"
              items={TAILLES_PAGE.map((taille) => ({
                value: String(taille),
                label: String(taille),
              }))}
              value={String(filtres.pageSize)}
              onChange={(valeur) => {
                setFiltres({ pageSize: Number(valeur), page: 1 });
              }}
            />
          }
          onPage={(page) => {
            setFiltres({ page });
          }}
        />
      )}

      <DialoguesProspects
        etats={{
          creation,
          edition: enEdition,
          fusion: enFusion,
          reaffectation: enReaffectation,
          suppression: aSupprimer,
        }}
        suppressionEnCours={supprimer.isPending}
        onFermer={fermer}
        onSupprimer={(cible) => {
          supprimer.mutate(cible);
        }}
      />
    </div>
  );
}
