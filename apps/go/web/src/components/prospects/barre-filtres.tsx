import { useQuery } from '@tanstack/react-query';
import { RotateCcwIcon } from 'lucide-react';
import { useCallback, useId } from 'react';

import { SEGMENTS, SEGMENT_LABELS } from '@/components/campagnes/cibles';
import { LIBELLES_METHODE } from '@/components/chues/conversion-champs';
import {
  compterFiltres,
  effacerAvances,
  LIBELLES_TRI,
  METHODES,
  PHASE2,
  TRIS,
  type CleAvancee,
  type FiltresProspects,
} from '@/components/prospects/filtres';
import { AdvancedPanel, type PastilleFiltre } from '@/components/ui/advanced-panel';
import { Button } from '@/components/ui/button';
import { ChampSelect } from '@/components/ui/champ-select';
import { DateField } from '@/components/ui/date-field';
import { FilterCombobox } from '@/components/ui/filter-combobox';
import { SearchField, useRechercheDifferee } from '@/components/ui/search-field';
import { PHASE2_STATUS_LABELS } from '@/lib/data/console';
import { PROSPECT_STATUTS, PROSPECT_STATUT_LABELS } from '@/lib/data/grand-public';
import { enOptions, fetchReferentiels, REFERENTIELS_STALE_MS } from '@/lib/data/referentiels';
import { fetchComptes, FILTRES_REPRENEURS } from '@/lib/data/users';
import { queryKeys } from '@/lib/query-keys';

const TOUS = 'tous';

function avecTous(items: readonly { value: string; label: string }[]) {
  return [{ value: TOUS, label: 'Tous' }, ...items];
}

const STATUTS = avecTous(
  PROSPECT_STATUTS.map((statut) => ({ value: statut, label: PROSPECT_STATUT_LABELS[statut] })),
);
const SEGMENTS_ITEMS = avecTous(
  SEGMENTS.map((segment) => ({ value: segment, label: SEGMENT_LABELS[segment] })),
);
const PHASE2_ITEMS = avecTous(
  PHASE2.map((phase) => ({ value: phase, label: PHASE2_STATUS_LABELS[phase] })),
);
const METHODES_ITEMS = avecTous(
  METHODES.map((methode) => ({ value: methode, label: LIBELLES_METHODE[methode] })),
);
const REVUE_ITEMS = [
  { value: TOUS, label: 'Toutes' },
  { value: 'oui', label: 'Revues' },
  { value: 'non', label: 'Non revues' },
];
const SENS = [
  { value: 'desc', label: 'Décroissant' },
  { value: 'asc', label: 'Croissant' },
];

function ouiNonTexte(valeur: boolean | null): string | null {
  if (valeur === null) return null;
  return valeur ? 'Oui' : 'Non';
}

function valeurRevue(valeur: boolean | null): string {
  if (valeur === null) return TOUS;
  return valeur ? 'oui' : 'non';
}

function pastilles(filtres: FiltresProspects): PastilleFiltre<CleAvancee>[] {
  const liste: PastilleFiltre<CleAvancee>[] = [];
  const poser = (key: CleAvancee, champ: string, valeur: string | null): void => {
    if (valeur !== null) liste.push({ key, champ, valeur });
  };
  poser(
    'statut',
    'Statut',
    filtres.statut === null ? null : PROSPECT_STATUT_LABELS[filtres.statut],
  );
  poser('segment', 'Segment', filtres.segment);
  poser(
    'phase2Status',
    'Résultat de l’appel',
    filtres.phase2Status === null ? null : PHASE2_STATUS_LABELS[filtres.phase2Status],
  );
  poser(
    'enrollmentMethod',
    'Méthode',
    filtres.enrollmentMethod === null ? null : LIBELLES_METHODE[filtres.enrollmentMethod],
  );
  poser('revue', 'Revue', ouiNonTexte(filtres.revue));
  return liste;
}

type Setter = (patch: Partial<FiltresProspects>) => void;

function ChampsAvances({ filtres, setFiltres }: { filtres: FiltresProspects; setFiltres: Setter }) {
  const statutId = useId();
  const segmentId = useId();
  const phase2Id = useId();
  const methodeId = useId();
  const revueId = useId();
  const triId = useId();
  const sensId = useId();

  const referentiels = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferentiels(),
    staleTime: REFERENTIELS_STALE_MS,
  });

  return (
    <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-3">
      <FilterCombobox
        label="Banque"
        placeholder="Toutes les banques"
        value={filtres.banqueId}
        options={enOptions(referentiels.data?.banques)}
        onChange={(banqueId) => {
          setFiltres({ banqueId });
        }}
      />
      <FilterCombobox
        label="Syndicat"
        placeholder="Tous les syndicats"
        value={filtres.syndicatId}
        options={enOptions(referentiels.data?.syndicats)}
        onChange={(syndicatId) => {
          setFiltres({ syndicatId });
        }}
      />
      <FilterCombobox
        label="Département"
        placeholder="Tous les départements"
        value={filtres.departementId}
        options={enOptions(referentiels.data?.departements, (item) => item.regionName ?? undefined)}
        onChange={(departementId) => {
          setFiltres({ departementId });
        }}
      />
      <ChampSelect
        id={statutId}
        label="Statut"
        items={STATUTS}
        value={filtres.statut ?? TOUS}
        onChange={(valeur) => {
          setFiltres({ statut: valeur === TOUS ? null : (valeur as FiltresProspects['statut']) });
        }}
      />
      <ChampSelect
        id={segmentId}
        label="Segment"
        items={SEGMENTS_ITEMS}
        value={filtres.segment ?? TOUS}
        onChange={(valeur) => {
          setFiltres({ segment: valeur === TOUS ? null : (valeur as FiltresProspects['segment']) });
        }}
      />
      <ChampSelect
        id={phase2Id}
        label="Résultat de l’appel"
        items={PHASE2_ITEMS}
        value={filtres.phase2Status ?? TOUS}
        onChange={(valeur) => {
          setFiltres({
            phase2Status: valeur === TOUS ? null : (valeur as FiltresProspects['phase2Status']),
          });
        }}
      />
      <ChampSelect
        id={methodeId}
        label="Méthode d’enrôlement"
        items={METHODES_ITEMS}
        value={filtres.enrollmentMethod ?? TOUS}
        onChange={(valeur) => {
          setFiltres({
            enrollmentMethod:
              valeur === TOUS ? null : (valeur as FiltresProspects['enrollmentMethod']),
          });
        }}
      />
      <ChampSelect
        id={revueId}
        label="Demandes revues"
        items={REVUE_ITEMS}
        value={valeurRevue(filtres.revue)}
        onChange={(valeur) => {
          setFiltres({ revue: valeur === TOUS ? null : valeur === 'oui' });
        }}
      />
      <DateField
        id="prospects-date-from"
        label="Saisi à partir du"
        value={filtres.dateFrom}
        max={filtres.dateTo}
        onChange={(dateFrom) => {
          setFiltres({ dateFrom });
        }}
      />
      <DateField
        id="prospects-date-to"
        label="Jusqu’au"
        value={filtres.dateTo}
        min={filtres.dateFrom}
        onChange={(dateTo) => {
          setFiltres({ dateTo });
        }}
      />
      <ChampSelect
        id={triId}
        label="Trier par"
        items={TRIS.map((tri) => ({ value: tri, label: LIBELLES_TRI[tri] }))}
        value={filtres.sortBy}
        onChange={(valeur) => {
          setFiltres({ sortBy: valeur as FiltresProspects['sortBy'] });
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
  );
}

export function BarreFiltresProspects({
  filtres,
  setFiltres,
  reinitialiser,
}: {
  filtres: FiltresProspects;
  setFiltres: Setter;
  reinitialiser: () => void;
}) {
  const teleconseillers = useQuery({
    queryKey: queryKeys.commerciaux({ ...FILTRES_REPRENEURS }),
    queryFn: () => fetchComptes(FILTRES_REPRENEURS),
    staleTime: REFERENTIELS_STALE_MS,
  });

  const publierRecherche = useCallback(
    (search: string) => {
      setFiltres({ search });
    },
    [setFiltres],
  );
  const { brouillon, frapper } = useRechercheDifferee(filtres.search, publierRecherche);

  return (
    <section
      aria-label="Filtres"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      <div className="flex flex-wrap items-end gap-3">
        <SearchField value={brouillon} onChange={frapper} placeholder="Nom ou téléphone…" />
        <FilterCombobox
          className="min-w-[13rem] flex-1"
          label="Téléconseiller"
          placeholder="Tous les téléconseillers"
          value={filtres.commercialId}
          options={(teleconseillers.data?.items ?? []).map((compte) => ({
            value: compte.id,
            label: compte.fullName,
          }))}
          onChange={(commercialId) => {
            setFiltres({ commercialId });
          }}
        />
      </div>

      <AdvancedPanel
        pastilles={pastilles(filtres)}
        onRetirer={(cle) => {
          setFiltres({ [cle]: null } as Partial<FiltresProspects>);
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
        <ChampsAvances filtres={filtres} setFiltres={setFiltres} />
      </AdvancedPanel>
    </section>
  );
}
