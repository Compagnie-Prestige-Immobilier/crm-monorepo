import { ChevronDownIcon, RotateCcwIcon, SlidersHorizontalIcon } from 'lucide-react';

import type { FiltresGrandPublic } from '@/components/grand-public/filtres';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { FilterCombobox } from '@/components/ui/filter-combobox';
import { SearchField } from '@/components/ui/search-field';
import {
  PROSPECT_STATUTS,
  PROSPECT_STATUT_LABELS,
  PROSPECT_TYPES,
  PROSPECT_TYPE_LABELS,
} from '@/lib/data/grand-public';
import { libelle, type ReferentielItem } from '@/lib/data/referentiels';
import { cn } from '@/lib/utils';

/** Peu d'options, toutes visibles : on désigne au lieu d'ouvrir puis de chercher. */
function RangeeChoix<T extends string>({
  legende,
  options,
  libelles,
  valeur,
  onChange,
}: {
  legende: string;
  options: readonly T[];
  libelles: Readonly<Record<T, string>>;
  valeur: T | null;
  onChange: (valeur: T | null) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-[0.8125rem] font-[600] text-foreground">{legende}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const actif = valeur === option;
          return (
            <Button
              key={option}
              type="button"
              variant={actif ? 'default' : 'outline'}
              aria-pressed={actif}
              onClick={() => {
                onChange(actif ? null : option);
              }}
            >
              {libelles[option]}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function BarreFiltres({
  filtres,
  actifs,
  volet,
  brouillon,
  canaux,
  onVolet,
  onRecherche,
  onFiltres,
  onReinitialiser,
}: {
  filtres: FiltresGrandPublic;
  actifs: number;
  volet: boolean;
  brouillon: string;
  canaux: readonly ReferentielItem[] | undefined;
  onVolet: (ouvert: boolean) => void;
  onRecherche: (valeur: string) => void;
  onFiltres: (patch: Partial<FiltresGrandPublic>) => void;
  onReinitialiser: () => void;
}) {
  return (
    <section
      aria-label="Filtres"
      className="rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          label="Rechercher"
          placeholder="Nom, prénom ou téléphone"
          value={brouillon}
          onChange={onRecherche}
        />
        <Button
          type="button"
          variant="outline"
          aria-expanded={volet}
          onClick={() => {
            onVolet(!volet);
          }}
        >
          <SlidersHorizontalIcon aria-hidden="true" />
          {actifs > 0 ? `Filtres (${String(actifs)})` : 'Filtres'}
          <ChevronDownIcon
            aria-hidden="true"
            className={cn('transition-transform', volet && 'rotate-180')}
          />
        </Button>
      </div>

      {volet ? (
        <div className="mt-5 flex flex-col gap-5 border-t border-border pt-5">
          <FilterCombobox
            label="Canal de provenance"
            placeholder="Tous les canaux"
            value={filtres.canalProvenanceId}
            options={(canaux ?? []).map((canal) => ({ value: canal.id, label: libelle(canal) }))}
            onChange={(canalProvenanceId) => {
              onFiltres({ canalProvenanceId });
            }}
          />
          <div className="grid gap-5 lg:grid-cols-2">
            <RangeeChoix
              legende="Situation"
              options={PROSPECT_TYPES}
              libelles={PROSPECT_TYPE_LABELS}
              valeur={filtres.type}
              onChange={(type) => {
                onFiltres({ type });
              }}
            />
            <RangeeChoix
              legende="Statut"
              options={PROSPECT_STATUTS}
              libelles={PROSPECT_STATUT_LABELS}
              valeur={filtres.statut}
              onChange={(statut) => {
                onFiltres({ statut });
              }}
            />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <DateField
              id="gp-date-from"
              label="Saisi à partir du"
              value={filtres.dateFrom}
              max={filtres.dateTo}
              onChange={(dateFrom) => {
                onFiltres({ dateFrom });
              }}
            />
            <DateField
              id="gp-date-to"
              label="Saisi jusqu’au"
              value={filtres.dateTo}
              min={filtres.dateFrom}
              onChange={(dateTo) => {
                onFiltres({ dateTo });
              }}
            />
            {actifs > 0 ? (
              <Button type="button" variant="ghost" onClick={onReinitialiser}>
                <RotateCcwIcon aria-hidden="true" />
                Tout effacer
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
