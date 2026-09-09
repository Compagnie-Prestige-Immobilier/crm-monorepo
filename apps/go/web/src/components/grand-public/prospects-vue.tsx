import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ClockIcon, PhoneCallIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { BarreFiltres } from '@/components/grand-public/barre-filtres';
import {
  ADAPTATEUR_GRAND_PUBLIC,
  compterFiltres,
  versRequete,
} from '@/components/grand-public/filtres';
import { ProspectFormulaire } from '@/components/grand-public/prospect-formulaire';
import { TableauProspects } from '@/components/grand-public/tableau-prospects';
import { LienTelechargement } from '@/components/exports/liens';
import { QueryErrorState } from '@/components/query-error-state';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SqueletteTableau } from '@/components/ui/pied-de-liste';
import { useRechercheDifferee } from '@/components/ui/search-field';
import { fetchPageProspects } from '@/lib/data/grand-public';
import { REFERENTIELS_STALE_MS, fetchReferentiel } from '@/lib/data/referentiels';
import { useFiltresUrl } from '@/lib/filtres-url';
import { queryKeys } from '@/lib/query-keys';
import { PILOTAGE, SAISIE_GRAND_PUBLIC } from '@/lib/roles';
import type { Role } from '@/lib/types';

const CLE_CANAUX = [...queryKeys.referentielsRoot, 'canaux-provenance'] as const;

function urlExport(requete: Record<string, string | number>): string {
  const params = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(requete)) params.set(cle, String(valeur));
  return `/api/v1/export/prospects.xlsx?${params.toString()}`;
}

export function ProspectsVue({ role }: { role: Role }) {
  const { filtres, setFiltres, reinitialiser } = useFiltresUrl(ADAPTATEUR_GRAND_PUBLIC);
  const [volet, setVolet] = useState(compterFiltres(filtres) > 0);
  const [creation, setCreation] = useState(false);

  const { brouillon, frapper } = useRechercheDifferee(filtres.search, (search) => {
    setFiltres({ search });
  });

  const canaux = useQuery({
    queryKey: CLE_CANAUX,
    queryFn: () => fetchReferentiel('canaux-provenance'),
    staleTime: REFERENTIELS_STALE_MS,
  });

  const requete = versRequete(filtres);
  const liste = useQuery({
    queryKey: queryKeys.prospects({ ...requete }),
    queryFn: () => fetchPageProspects(requete),
    placeholderData: (precedent) => precedent,
  });

  const actifs = compterFiltres(filtres);
  const peutCreer = SAISIE_GRAND_PUBLIC.includes(role);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 font-[700] tracking-[-0.02em]">
            Prospects Grand Public
          </h1>
          <p className="text-body text-muted-foreground">
            Les particuliers démarchés hors syndicat. Les fiches CHUES ne figurent pas ici.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/$projet/rappels"
            params={{ projet: 'grand-public' }}
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            <ClockIcon aria-hidden="true" />
            Voir les rappels
          </Link>
          {PILOTAGE.includes(role) ? (
            <LienTelechargement
              href={urlExport(requete)}
              label="Exporter les prospects Grand Public"
            >
              Exporter
            </LienTelechargement>
          ) : null}
          {peutCreer ? (
            <>
              <Link
                to="/$projet/console"
                params={{ projet: 'grand-public' }}
                className={buttonVariants({ variant: 'outline', size: 'lg' })}
              >
                <PhoneCallIcon aria-hidden="true" />
                Appeler les prospects
              </Link>
              <Button
                size="lg"
                onClick={() => {
                  setCreation(true);
                }}
              >
                <PlusIcon aria-hidden="true" />
                Nouveau prospect
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <BarreFiltres
        filtres={filtres}
        actifs={actifs}
        volet={volet}
        brouillon={brouillon}
        canaux={canaux.data}
        onVolet={setVolet}
        onRecherche={frapper}
        onFiltres={setFiltres}
        onReinitialiser={reinitialiser}
      />

      {liste.data === undefined && liste.isPending ? <SqueletteTableau /> : null}

      {liste.data === undefined && liste.isError ? (
        <QueryErrorState
          error={liste.error}
          onRetry={() => {
            void liste.refetch();
          }}
          fallback="La liste des prospects Grand Public n’a pas pu être chargée."
        />
      ) : null}

      {liste.data === undefined ? null : (
        <TableauProspects
          page={liste.data}
          pageSize={filtres.pageSize}
          filtre={actifs > 0}
          campagnes={role === 'COMMERCIAL'}
          rafraichit={liste.isFetching}
          onPage={(page) => {
            setFiltres({ page });
          }}
          onTaille={(pageSize) => {
            setFiltres({ pageSize, page: 1 });
          }}
        />
      )}

      <Dialog open={creation} onOpenChange={setCreation}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nouveau prospect Grand Public</DialogTitle>
            <DialogDescription>Le nom, le prénom et le téléphone suffisent.</DialogDescription>
          </DialogHeader>
          {creation ? (
            <ProspectFormulaire
              embarque
              onEnregistre={() => {
                setCreation(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
