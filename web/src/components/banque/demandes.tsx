import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { InboxIcon, RotateCcwIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

import { CarteDemande } from '@/components/banque/demande-carte';
import { DialoguesArbitrage, type Arbitrage } from '@/components/banque/demandes-arbitrage';
import type { FiltresDemandes, StatutFiltre } from '@/components/banque/filtres';
import {
  ADAPTATEUR_DEMANDES,
  compterFiltresDemandes,
  requeteDemandes,
} from '@/components/banque/filtres';
import { EtatVide, SqueletteCartes } from '@/components/banque/pieces';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FilterCombobox, type OptionFiltre } from '@/components/ui/filter-combobox';
import { PiedDeListe } from '@/components/ui/pied-de-liste';
import { SearchField, useRechercheDifferee } from '@/components/ui/search-field';
import { fetchDemandes, type PageDemandes } from '@/lib/data/client-requests';
import { enOptions, fetchReferentiels, REFERENTIELS_STALE_MS } from '@/lib/data/referentiels';
import { useFiltresUrl } from '@/lib/filtres-url';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { Role } from '@/lib/types';

const ONGLETS: readonly { value: StatutFiltre; label: string }[] = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'APPROVED', label: 'Approuvées' },
  { value: 'REJECTED', label: 'Refusées' },
  { value: 'tous', label: 'Toutes' },
];

function descriptionVide(actifs: number, arbitre: boolean): string {
  if (actifs > 0) return 'Changez de statut ou retirez un critère.';
  if (arbitre) {
    return 'Une demande arrivée ici attend votre approbation, ou un refus dont le motif est remonté à la banque.';
  }
  return 'Ouvrez un dossier depuis « Nouveau dossier » : si le client est absent de la base, vous pourrez y demander sa création.';
}

function BarreDemandes({
  filtres,
  arbitre,
  brouillon,
  actifs,
  banques,
  onFrapper,
  setFiltres,
  reinitialiser,
}: {
  filtres: FiltresDemandes;
  arbitre: boolean;
  brouillon: string;
  actifs: number;
  banques: readonly OptionFiltre[];
  onFrapper: (valeur: string) => void;
  setFiltres: (patch: Partial<FiltresDemandes>) => void;
  reinitialiser: () => void;
}) {
  return (
    <section
      aria-label="Filtres des demandes"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          value={brouillon}
          onChange={onFrapper}
          placeholder="Nom, prénom ou téléphone…"
        />
        {/* Sans objet pour un agent bancaire : l'API ne lui rend que ses propres demandes. */}
        {arbitre ? (
          <div className="min-w-[13rem] flex-1">
            <FilterCombobox
              label="Banque demandeuse"
              placeholder="Toutes les banques"
              options={banques}
              value={filtres.banqueId}
              onChange={(banqueId) => {
                setFiltres({ banqueId });
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* `role="group"` et non `tablist` : rien n'est masqué, ces boutons écrivent un filtre. */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
          {ONGLETS.map((onglet) => (
            <Button
              key={onglet.value}
              type="button"
              variant={filtres.statut === onglet.value ? 'default' : 'outline'}
              size="sm"
              aria-pressed={filtres.statut === onglet.value}
              onClick={() => {
                setFiltres({ statut: onglet.value });
              }}
            >
              {onglet.label}
            </Button>
          ))}
        </div>
        {actifs > 0 ? (
          <Button variant="ghost" onClick={reinitialiser}>
            <RotateCcwIcon aria-hidden="true" />
            Tout effacer
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function Resultats({
  etat,
  arbitre,
  actifs,
  onArbitrer,
  onPage,
}: {
  etat: UseQueryResult<PageDemandes>;
  arbitre: boolean;
  actifs: number;
  onArbitrer: (arbitrage: Arbitrage) => void;
  onPage: (page: number) => void;
}) {
  if (etat.isPending) return <SqueletteCartes lignes={3} />;

  if (etat.isError) {
    return (
      <QueryErrorState
        error={etat.error}
        onRetry={() => {
          void etat.refetch();
        }}
        fallback="Les demandes n’ont pas pu être chargées."
      />
    );
  }

  if (etat.data.items.length === 0) {
    return (
      <EtatVide
        icone={InboxIcon}
        titre={actifs === 0 ? 'Aucune demande en attente' : 'Aucune demande sur ces critères'}
        description={descriptionVide(actifs, arbitre)}
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {etat.data.items.map((demande) => (
          <li key={demande.id}>
            <CarteDemande demande={demande} arbitre={arbitre} onArbitrer={onArbitrer} />
          </li>
        ))}
      </ul>
      <PiedDeListe
        quoi="Demandes affichées"
        total={etat.data.total}
        page={etat.data.page}
        pageCount={etat.data.pageCount}
        pageSize={etat.data.pageSize}
        onPage={onPage}
      />
    </>
  );
}

export function DemandesClients({ role }: { role: Role }) {
  const arbitre = role === 'ADMIN';
  const { filtres, setFiltres, reinitialiser } = useFiltresUrl(ADAPTATEUR_DEMANDES);
  const [arbitrage, setArbitrage] = useState<Arbitrage | null>(null);
  const requete = requeteDemandes(filtres);

  const demandes = useQuery({
    queryKey: queryKeys.clientRequests(requete),
    queryFn: () => fetchDemandes(requete),
    placeholderData: (precedent) => precedent,
  });

  const referentiels = useQuery({
    queryKey: queryKeys.referentielsRoot,
    queryFn: () => fetchReferentiels(),
    staleTime: REFERENTIELS_STALE_MS,
    enabled: arbitre,
  });

  const publierRecherche = useCallback(
    (search: string) => {
      setFiltres({ search });
    },
    [setFiltres],
  );
  const { brouillon, frapper } = useRechercheDifferee(filtres.search, publierRecherche);

  const actifs = compterFiltresDemandes(filtres);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          {arbitre
            ? 'Clients absents de la base, demandés par une banque au moment d’ouvrir un dossier. L’approbation crée le prospect en méthode obtenue, avec sa provenance.'
            : 'Vos demandes de création de client. Une fois approuvée, la demande crée le prospect et le dossier peut lui être rattaché.'}
        </p>
        {arbitre && demandes.data !== undefined && demandes.data.pendingCount > 0 ? (
          <Badge variant="warning">{formatNumber(demandes.data.pendingCount)} en attente</Badge>
        ) : null}
      </div>

      <BarreDemandes
        filtres={filtres}
        arbitre={arbitre}
        brouillon={brouillon}
        actifs={actifs}
        banques={enOptions(referentiels.data?.banques)}
        onFrapper={frapper}
        setFiltres={setFiltres}
        reinitialiser={reinitialiser}
      />

      <Resultats
        etat={demandes}
        arbitre={arbitre}
        actifs={actifs}
        onArbitrer={setArbitrage}
        onPage={(page) => {
          setFiltres({ page });
        }}
      />

      <DialoguesArbitrage
        arbitrage={arbitrage}
        onFermer={() => {
          setArbitrage(null);
        }}
      />
    </div>
  );
}
