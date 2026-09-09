import { useQuery } from '@tanstack/react-query';
import { RotateCcwIcon } from 'lucide-react';
import { useCallback } from 'react';

import { ChampMontant } from '@/components/banque/champs';
import type { FiltresDossiers, VueRapide } from '@/components/banque/filtres';
import {
  compterFiltres,
  correctifVue,
  effacerAvances,
  VUES_RAPIDES,
  vueCourante,
} from '@/components/banque/filtres';
import { etapeInitiale } from '@/components/banque/flux';
import { pastillesAvancees } from '@/components/banque/pastilles';
import { QueryErrorState } from '@/components/query-error-state';
import { AdvancedPanel } from '@/components/ui/advanced-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { FilterCombobox, type OptionFiltre } from '@/components/ui/filter-combobox';
import { SearchField, useRechercheDifferee } from '@/components/ui/search-field';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchEtapes, fetchMotifs } from '@/lib/data/bank-cases';
import { enOptions, fetchReferentiels, REFERENTIELS_STALE_MS } from '@/lib/data/referentiels';
import { queryKeys } from '@/lib/query-keys';

function VuesRapides({
  courante,
  onSelect,
}: {
  courante: VueRapide;
  onSelect: (vue: VueRapide) => void;
}) {
  return (
    // `role="group"` et non `tablist` : rien n'est masqué, ces boutons écrivent un filtre.
    <div className="flex flex-wrap gap-2" role="group" aria-label="Vues rapides">
      {VUES_RAPIDES.map((vue) => (
        <Button
          key={vue.id}
          type="button"
          variant={courante === vue.id ? 'default' : 'outline'}
          size="sm"
          aria-pressed={courante === vue.id}
          onClick={() => {
            onSelect(vue.id);
          }}
        >
          {vue.label}
        </Button>
      ))}
    </div>
  );
}

export function BarreFiltres({
  filtres,
  setFiltres,
  reinitialiser,
  agents = [],
}: {
  filtres: FiltresDossiers;
  setFiltres: (patch: Partial<FiltresDossiers>) => void;
  reinitialiser: () => void;
  agents?: readonly OptionFiltre[] | undefined;
}) {
  const etapes = useQuery({
    queryKey: queryKeys.bankStages(true),
    queryFn: () => fetchEtapes(true),
    staleTime: REFERENTIELS_STALE_MS,
  });
  const motifs = useQuery({
    queryKey: queryKeys.bankRejectionReasons,
    queryFn: () => fetchMotifs(),
    staleTime: REFERENTIELS_STALE_MS,
  });
  const referentiels = useQuery({
    queryKey: queryKeys.referentielsRoot,
    queryFn: () => fetchReferentiels(),
    staleTime: REFERENTIELS_STALE_MS,
  });

  const publierRecherche = useCallback(
    (search: string) => {
      setFiltres({ search });
    },
    [setFiltres],
  );
  const { brouillon, frapper } = useRechercheDifferee(filtres.search, publierRecherche);

  if (etapes.isError) {
    return (
      <QueryErrorState
        error={etapes.error}
        onRetry={() => {
          void etapes.refetch();
        }}
        fallback="Les étapes du flux n’ont pas pu être chargées."
      />
    );
  }

  if (etapes.isPending) return <SqueletteBarre />;

  const initiale = etapeInitiale(etapes.data)?.id ?? null;
  const actifs = compterFiltres(filtres);
  const listes = {
    banques: enOptions(referentiels.data?.banques),
    agents,
    motifs: (motifs.data ?? []).map((motif) => ({ value: motif.id, label: motif.label })),
  };

  return (
    <section
      aria-label="Filtres des dossiers"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      <VuesRapides
        courante={vueCourante(filtres, initiale)}
        onSelect={(vue) => {
          setFiltres(correctifVue(vue, initiale));
        }}
      />

      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          value={brouillon}
          onChange={frapper}
          placeholder="Référence, nom du client, téléphone…"
        />

        <div className="min-w-[13rem] flex-1">
          {/* Le seul critère de liste resté visible : l'étape est la question posée
              à chaque session, celle que les vues rapides écrivent aussi. */}
          <FilterCombobox
            label="Étape"
            placeholder="Toutes les étapes"
            options={etapes.data.map((etape) => ({
              value: etape.id,
              label: etape.label,
              hint: etape.isActive ? undefined : 'désactivée',
            }))}
            value={filtres.stageId}
            onChange={(stageId) => {
              setFiltres({ stageId, stageType: null });
            }}
          />
        </div>

        <DateField
          id="dossiers-date-from"
          label="Créé à partir du"
          value={filtres.dateFrom}
          max={filtres.dateTo}
          onChange={(dateFrom) => {
            setFiltres({ dateFrom });
          }}
        />
        <DateField
          id="dossiers-date-to"
          label="Jusqu’au"
          value={filtres.dateTo}
          min={filtres.dateFrom}
          onChange={(dateTo) => {
            setFiltres({ dateTo });
          }}
        />
      </div>

      <AdvancedPanel
        pastilles={pastillesAvancees(filtres, listes)}
        onRetirer={(cle) => {
          setFiltres({ [cle]: null } as Partial<FiltresDossiers>);
        }}
        onToutRetirer={() => {
          setFiltres(effacerAvances());
        }}
        actions={
          actifs === 0 ? null : (
            <>
              <Badge variant="secondary">
                {actifs} filtre{actifs > 1 ? 's' : ''}
              </Badge>
              <Button variant="ghost" onClick={reinitialiser}>
                <RotateCcwIcon aria-hidden="true" />
                Tout effacer
              </Button>
            </>
          )
        }
      >
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-3">
          <FilterCombobox
            label="Banque de traitement"
            placeholder="Toutes les banques"
            options={listes.banques}
            value={filtres.banqueId}
            onChange={(banqueId) => {
              setFiltres({ banqueId });
            }}
          />
          <FilterCombobox
            label="Agent"
            placeholder="Tous les agents"
            options={listes.agents}
            value={filtres.agentId}
            onChange={(agentId) => {
              setFiltres({ agentId });
            }}
          />
          <FilterCombobox
            label="Motif de rejet"
            placeholder="Tous les motifs"
            options={listes.motifs}
            value={filtres.rejectionReasonId}
            onChange={(rejectionReasonId) => {
              setFiltres({ rejectionReasonId });
            }}
          />
          <ChampMontant
            label="Montant minimum (FCFA)"
            gabarit="0"
            valeur={filtres.amountMin}
            onChange={(amountMin) => {
              setFiltres({ amountMin });
            }}
          />
          <ChampMontant
            label="Montant maximum (FCFA)"
            gabarit="Sans limite"
            valeur={filtres.amountMax}
            onChange={(amountMax) => {
              setFiltres({ amountMax });
            }}
          />
        </div>
      </AdvancedPanel>
    </section>
  );
}

function SqueletteBarre() {
  return (
    <section
      aria-hidden="true"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-9 w-24" />
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-11 min-w-[13rem] flex-1" />
        ))}
      </div>
    </section>
  );
}
