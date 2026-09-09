import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { DialogueCreation } from '@/components/campagnes/creation';
import {
  BarreFiltres,
  CarteCampagne,
  DialogueSuppression,
  ListeVide,
  Pagination,
  TOUTES,
  type FiltreCible,
} from '@/components/campagnes/liste-pieces';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchCampagnes,
  supprimerCampagne,
  type CampagneResume,
  type CampagnesQuery,
  type Page,
} from '@/lib/data/lots-export';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Projet, ProjetApi } from '@/lib/types';

export function ListeCampagnes({
  projet,
  projetApi,
  peutCreer,
  peutSupprimer,
}: {
  projet: Projet;
  projetApi: ProjetApi;
  peutCreer: boolean;
  peutSupprimer: boolean;
}) {
  const [recherche, setRecherche] = useState('');
  const [cible, setCible] = useState<FiltreCible>(TOUTES);
  const [page, setPage] = useState(1);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [aSupprimer, setASupprimer] = useState<{ id: string; name: string } | null>(null);

  const queryClient = useQueryClient();
  const suppression = useMutation({
    mutationFn: (id: string) => supprimerCampagne(id),
    onSuccess: async () => {
      toast.success('Campagne supprimée.');
      setASupprimer(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.lotsExportRoot });
    },
    onError: (error) => {
      toastApiError(error, 'La campagne n’a pas pu être supprimée.');
    },
  });

  const cherche = recherche.trim();
  const requete: CampagnesQuery = {
    page,
    projet: projetApi,
    ...(cherche === '' ? {} : { search: cherche }),
    ...(cible === TOUTES ? {} : { cible }),
  };

  const campagnes = useQuery({
    queryKey: queryKeys.lotsExport(requete),
    queryFn: () => fetchCampagnes(requete),
    placeholderData: (precedent) => precedent,
  });

  const filtre = cherche !== '' || cible !== TOUTES;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Une campagne répartit des fiches entre les téléconseillers et suit leur traitement.
        </p>
        {peutCreer ? (
          <Button
            type="button"
            onClick={() => {
              setCreationOuverte(true);
            }}
          >
            <PlusIcon aria-hidden="true" />
            Nouvelle campagne
          </Button>
        ) : null}
      </div>

      <BarreFiltres
        projet={projet}
        recherche={recherche}
        cible={cible}
        onRecherche={(valeur) => {
          setRecherche(valeur);
          setPage(1);
        }}
        onCible={(valeur) => {
          setCible(valeur);
          setPage(1);
        }}
      />

      <CorpsListe
        campagnes={campagnes}
        projet={projet}
        filtre={filtre}
        peutSupprimer={peutSupprimer}
        onSupprimer={setASupprimer}
      />

      <Pagination page={page} pageCount={campagnes.data?.pageCount ?? 1} onPage={setPage} />

      {peutCreer ? (
        <DialogueCreation
          open={creationOuverte}
          onOpenChange={setCreationOuverte}
          projet={projet}
        />
      ) : null}

      <DialogueSuppression
        cible={aSupprimer}
        enCours={suppression.isPending}
        onFermer={() => {
          setASupprimer(null);
        }}
        onConfirmer={(id) => {
          suppression.mutate(id);
        }}
      />
    </div>
  );
}

function CorpsListe({
  campagnes,
  projet,
  filtre,
  peutSupprimer,
  onSupprimer,
}: {
  campagnes: UseQueryResult<Page<CampagneResume>>;
  projet: Projet;
  filtre: boolean;
  peutSupprimer: boolean;
  onSupprimer: (cible: { id: string; name: string }) => void;
}) {
  if (campagnes.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  if (campagnes.isError) {
    return (
      <QueryErrorState
        error={campagnes.error}
        onRetry={() => {
          void campagnes.refetch();
        }}
        fallback="Les campagnes n’ont pas pu être chargées."
      />
    );
  }

  if (campagnes.data.items.length === 0) return <ListeVide filtre={filtre} />;

  return (
    <ul className="flex flex-col gap-3">
      {campagnes.data.items.map((lot) => (
        <li key={lot.id}>
          <CarteCampagne
            lot={lot}
            projet={projet}
            peutSupprimer={peutSupprimer}
            onSupprimer={() => {
              onSupprimer({ id: lot.id, name: lot.name });
            }}
          />
        </li>
      ))}
    </ul>
  );
}
