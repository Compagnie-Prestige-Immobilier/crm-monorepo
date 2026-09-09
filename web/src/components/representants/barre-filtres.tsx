import { useQuery } from '@tanstack/react-query';
import { RotateCcwIcon } from 'lucide-react';
import { useCallback, useId } from 'react';

import {
  CHOIX_RELATION,
  compterFiltres,
  effacerAvances,
  LIBELLES_RELATION,
  LIBELLES_TRI,
  TRIS,
  type CleAvancee,
  type FiltresRepresentants,
  type RelationRepresentant,
  type TriRepresentants,
} from '@/components/representants/filtres';
import { ChampsLocalisation } from '@/components/representants/barre-filtres-localisation';
import { AdvancedPanel, type PastilleFiltre } from '@/components/ui/advanced-panel';
import { Button } from '@/components/ui/button';
import { ChampSelect } from '@/components/ui/champ-select';
import { DateField } from '@/components/ui/date-field';
import { SearchField, useRechercheDifferee } from '@/components/ui/search-field';
import { REFERENTIELS_STALE_MS } from '@/lib/data/referentiels';
import { fetchStatutsSaisie } from '@/lib/data/statuts-qualification';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

const PRESENCE = [
  { value: 'tous', label: 'Tous' },
  { value: 'oui', label: 'Au moins un' },
  { value: 'non', label: 'Aucun' },
];

const RELATIONS = [
  { value: 'tous', label: 'Tous' },
  ...CHOIX_RELATION.map((relation) => ({ value: relation, label: LIBELLES_RELATION[relation] })),
];

const SENS = [
  { value: 'desc', label: 'Décroissant' },
  { value: 'asc', label: 'Croissant' },
];

function pastilles(filtres: FiltresRepresentants): PastilleFiltre<CleAvancee>[] {
  const liste: PastilleFiltre<CleAvancee>[] = [];
  if (filtres.dateFrom !== null) {
    liste.push({
      key: 'dateFrom',
      champ: 'Saisi à partir du',
      valeur: formatDate(filtres.dateFrom),
    });
  }
  if (filtres.dateTo !== null) {
    liste.push({ key: 'dateTo', champ: 'Jusqu’au', valeur: formatDate(filtres.dateTo) });
  }
  if (filtres.hasProspects !== null) {
    liste.push({
      key: 'hasProspects',
      champ: 'Prospects apportés',
      valeur: filtres.hasProspects ? 'Au moins un' : 'Aucun',
    });
  }
  return liste;
}

export function BarreFiltresRepresentants({
  filtres,
  setFiltres,
  reinitialiser,
}: {
  filtres: FiltresRepresentants;
  setFiltres: (patch: Partial<FiltresRepresentants>) => void;
  reinitialiser: () => void;
}) {
  const relationId = useId();
  const statutId = useId();
  const presenceId = useId();
  const triId = useId();
  const sensId = useId();

  const statuts = useQuery({
    queryKey: queryKeys.statutsQualification,
    queryFn: () => fetchStatutsSaisie(),
    staleTime: REFERENTIELS_STALE_MS,
  });
  const publierRecherche = useCallback(
    (search: string) => {
      setFiltres({ search });
    },
    [setFiltres],
  );
  const { brouillon, frapper } = useRechercheDifferee(filtres.search, publierRecherche);

  const statutItems = [
    { value: 'tous', label: 'Tous' },
    ...(statuts.data ?? []).map((statut) => ({ value: statut.id, label: statut.label })),
  ];

  return (
    <section
      aria-label="Filtres"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      <div className="flex flex-wrap items-end gap-3">
        <SearchField value={brouillon} onChange={frapper} placeholder="Nom ou téléphone…" />

        <ChampSelect
          id={relationId}
          className="min-w-[13rem] flex-1"
          label="Qualification"
          items={RELATIONS}
          value={filtres.relationStatus ?? 'tous'}
          onChange={(valeur) => {
            setFiltres({
              relationStatus: valeur === 'tous' ? null : (valeur as RelationRepresentant),
            });
          }}
        />

        <ChampSelect
          id={statutId}
          className="min-w-[13rem] flex-1"
          label="Statut de qualification"
          items={statutItems}
          value={filtres.statutQualificationId ?? 'tous'}
          onChange={(valeur) => {
            setFiltres({ statutQualificationId: valeur === 'tous' ? null : valeur });
          }}
        />

        <ChampsLocalisation filtres={filtres} setFiltres={setFiltres} />
      </div>

      <AdvancedPanel
        pastilles={pastilles(filtres)}
        onRetirer={(cle) => {
          setFiltres({ [cle]: null } as Partial<FiltresRepresentants>);
        }}
        onToutRetirer={() => {
          setFiltres(effacerAvances());
        }}
        actions={
          compterFiltres(filtres) > 0 ? (
            <Button variant="ghost" onClick={reinitialiser}>
              <RotateCcwIcon aria-hidden="true" />
              Tout effacer
            </Button>
          ) : null
        }
      >
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-3">
          <DateField
            id="representants-date-from"
            label="Saisi à partir du"
            value={filtres.dateFrom}
            max={filtres.dateTo}
            onChange={(dateFrom) => {
              setFiltres({ dateFrom });
            }}
          />
          <DateField
            id="representants-date-to"
            label="Jusqu’au"
            value={filtres.dateTo}
            min={filtres.dateFrom}
            onChange={(dateTo) => {
              setFiltres({ dateTo });
            }}
          />
          <ChampSelect
            id={presenceId}
            label="Prospects apportés"
            items={PRESENCE}
            value={presenceEnTexte(filtres.hasProspects)}
            onChange={(valeur) => {
              setFiltres({ hasProspects: presenceDepuisTexte(valeur) });
            }}
          />
          <ChampSelect
            id={triId}
            label="Trier par"
            items={TRIS.map((tri) => ({ value: tri, label: LIBELLES_TRI[tri] }))}
            value={filtres.sortBy}
            onChange={(valeur) => {
              setFiltres({ sortBy: valeur as TriRepresentants });
            }}
          />
          <ChampSelect
            id={sensId}
            label="Sens"
            items={SENS}
            value={filtres.sortDir}
            onChange={(valeur) => {
              setFiltres({ sortDir: valeur === 'asc' ? 'asc' : 'desc' });
            }}
          />
        </div>
      </AdvancedPanel>
    </section>
  );
}

function presenceEnTexte(hasProspects: boolean | null): string {
  if (hasProspects === null) return 'tous';
  return hasProspects ? 'oui' : 'non';
}

function presenceDepuisTexte(valeur: string): boolean | null {
  if (valeur === 'oui') return true;
  if (valeur === 'non') return false;
  return null;
}
