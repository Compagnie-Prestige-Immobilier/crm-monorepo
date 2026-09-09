import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { FileSpreadsheetIcon, PlusIcon, UploadIcon } from 'lucide-react';
import { useState } from 'react';

import { QueryErrorState } from '@/components/query-error-state';
import { BarreFiltresRepresentants } from '@/components/representants/barre-filtres';
import {
  ADAPTATEUR_REPRESENTANTS,
  compterFiltres,
  urlExport,
  type FiltresRepresentants,
} from '@/components/representants/filtres';
import { FormulaireRepresentant } from '@/components/representants/formulaire';
import { EtatVide, Resultats } from '@/components/representants/liste-tableau';
import { Button, buttonVariants } from '@/components/ui/button';
import { PiedDeListe, SqueletteTableau } from '@/components/ui/pied-de-liste';
import {
  fetchRepresentants,
  type PageRepresentants,
  type Representant,
} from '@/lib/data/representants';
import { useFiltresUrl } from '@/lib/filtres-url';
import { formatNumber } from '@/lib/format';
import { lien } from '@/lib/nav';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';

function complementAcceptes(acceptes: PageRepresentants | undefined): string | null {
  if (acceptes === undefined) return null;
  return `dont ${formatNumber(acceptes.total)} qui ont accepté`;
}

function EnTeteListe({
  projet,
  filtres,
  peutAdministrer,
  lectureSeule,
  onNouveau,
}: {
  projet: Projet;
  filtres: FiltresRepresentants;
  peutAdministrer: boolean;
  lectureSeule: boolean;
  onNouveau: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
        Personnes qui remettent les listes de prospects. La saisie ci-contre et l’import couvrent
        les exceptions.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {lectureSeule ? null : (
          <Button type="button" onClick={onNouveau}>
            <PlusIcon aria-hidden="true" />
            Nouveau représentant
          </Button>
        )}

        {peutAdministrer ? (
          <Link
            {...lien(`/${projet}/representants/import`)}
            className={buttonVariants({ variant: 'outline' })}
          >
            <UploadIcon aria-hidden="true" />
            Import Excel
          </Link>
        ) : null}

        {lectureSeule ? null : (
          <a href={urlExport(filtres, 'filtre')} className={buttonVariants({ variant: 'outline' })}>
            <FileSpreadsheetIcon aria-hidden="true" />
            Exporter la vue filtrée
          </a>
        )}
      </div>
    </div>
  );
}

export function ListeRepresentants({
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
  const { filtres, setFiltres, reinitialiser } = useFiltresUrl(ADAPTATEUR_REPRESENTANTS);
  const [enEdition, setEnEdition] = useState<{ representant: Representant | null } | null>(null);

  const ouvrirEdition = (representant: Representant): void => {
    setEnEdition({ representant });
  };

  const liste = useQuery({
    queryKey: queryKeys.representants(filtres),
    queryFn: () => fetchRepresentants(filtres),
    placeholderData: (precedent) => precedent,
  });

  // Le total de ceux qui ont accepté porte sur la SÉLECTION entière : l'API ne
  // le rend pas avec la liste, il se lit sur le `total` d'une seconde requête.
  const filtresAcceptes: FiltresRepresentants = {
    ...filtres,
    relationStatus: 'AMBASSADEUR',
    page: 1,
  };
  const acceptes = useQuery({
    queryKey: queryKeys.representants(filtresAcceptes),
    queryFn: () => fetchRepresentants(filtresAcceptes),
    enabled: filtres.relationStatus !== 'AMBASSADEUR',
    placeholderData: (precedent) => precedent,
  });

  return (
    <div className="flex flex-col gap-6">
      <EnTeteListe
        projet={projet}
        filtres={filtres}
        peutAdministrer={peutAdministrer}
        lectureSeule={lectureSeule}
        onNouveau={() => {
          setEnEdition({ representant: null });
        }}
      />

      <BarreFiltresRepresentants
        filtres={filtres}
        setFiltres={setFiltres}
        reinitialiser={reinitialiser}
      />

      <ContenuListe
        liste={liste}
        projet={projet}
        filtresActifs={compterFiltres(filtres)}
        porteeCampagne={porteeCampagne}
        onModifier={lectureSeule ? null : ouvrirEdition}
      />

      {/* Le pied n'existe QUE sur la branche chargée : pendant la première
          requête, la région live annoncerait « Aucun résultat » sur le squelette. */}
      {liste.data === undefined ? null : (
        <PiedDeListe
          quoi="Représentants affichés"
          total={liste.data.total}
          page={liste.data.page}
          pageCount={liste.data.pageCount}
          pageSize={filtres.pageSize}
          complement={complementAcceptes(acceptes.data)}
          onPage={(page) => {
            setFiltres({ page });
          }}
        />
      )}

      <FormulaireRepresentant
        open={enEdition !== null}
        onOpenChange={(ouvert) => {
          if (!ouvert) setEnEdition(null);
        }}
        representant={enEdition?.representant ?? null}
      />
    </div>
  );
}

function ContenuListe({
  liste,
  projet,
  filtresActifs,
  porteeCampagne,
  onModifier,
}: {
  liste: UseQueryResult<PageRepresentants>;
  projet: Projet;
  filtresActifs: number;
  porteeCampagne: boolean;
  onModifier: ((representant: Representant) => void) | null;
}) {
  if (liste.isPending) return <SqueletteTableau />;
  if (liste.isError) {
    return (
      <QueryErrorState
        error={liste.error}
        onRetry={() => {
          void liste.refetch();
        }}
        fallback="Liste des représentants non chargée."
      />
    );
  }
  if (liste.data.items.length === 0) {
    return <EtatVide filtresActifs={filtresActifs} porteeCampagne={porteeCampagne} />;
  }
  return (
    <Resultats
      items={liste.data.items}
      projet={projet}
      enCours={liste.isFetching}
      onModifier={onModifier}
    />
  );
}
