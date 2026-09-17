'use client';

import { CheckCircle2Icon } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { AdvancedPanel } from '@/components/filters/advanced-panel';
import { type AdvancedChip } from '@/components/filters/advanced-chips';
import { DatePicker } from '@/components/filters/date-picker';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { FiltreOrigine } from '@/components/grand-public/filtre-origine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Projet } from '@/components/console/console-view';
import type { OrigineFiche } from '@/lib/data/grand-public';
import { withRetired } from '@/lib/format';
import { PROSPECT_STATUTS, PROSPECT_STATUT_LABELS, type ReferenceData } from '@/lib/types';
import { cn } from '@/lib/utils';

const REVELE = 'animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none';

type EnTeteAnnuaireProps = {
  lienEnEchec: boolean;
  confirme: string | null;
  cherche: string;
  search: string;
  projet: Projet | null;
  plateforme: boolean;
  origine: OrigineFiche | null;
  resteAAppeler: boolean;
  total: number | null;
  reference: ReferenceData | undefined;
  canaux: { id: string; label: string | null }[] | undefined;
  advancedChips: AdvancedChip[];
  onSearch: (value: string) => void;
  onOrigine: (value: OrigineFiche) => void;
  onResteAAppeler: (value: boolean) => void;
  onRemoveFilter: (key: string) => void;
  onClearFilters: () => void;
  onRepresentantChange: (value: string | null) => void;
  onDepartementChange: (value: string | null) => void;
  onBanqueChange: (value: string | null) => void;
  onSyndicatChange: (value: string | null) => void;
  onStatutChange: (value: string | null) => void;
  onCanalChange: (value: string | null) => void;
  onDateFromChange: (value: string | null) => void;
  onDateToChange: (value: string | null) => void;
  representantId: string | null;
  departementId: string | null;
  banqueId: string | null;
  syndicatId: string | null;
  statut: string | null;
  canalProvenanceId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
};

export function EnTeteAnnuaire({
  lienEnEchec,
  confirme,
  cherche,
  search,
  projet,
  plateforme,
  origine,
  resteAAppeler,
  total,
  reference,
  canaux,
  advancedChips,
  onSearch,
  onOrigine,
  onResteAAppeler,
  onRemoveFilter,
  onClearFilters,
  onRepresentantChange,
  onDepartementChange,
  onBanqueChange,
  onSyndicatChange,
  onStatutChange,
  onCanalChange,
  onDateFromChange,
  onDateToChange,
  representantId,
  departementId,
  banqueId,
  syndicatId,
  statut,
  canalProvenanceId,
  dateFrom,
  dateTo,
}: EnTeteAnnuaireProps) {
  let texteAide: string;
  if (cherche !== '') texteAide = "Choisissez qui vous venez d'appeler.";
  else if (plateforme)
    texteAide =
      "Les contacts transmis par les plateformes, y compris les parcours interrompus. Les plus récents d'abord.";
  else if (projet === null)
    texteAide = 'Vos fiches CHUES et Grand Public, y compris celles confiées par une campagne.';
  else if (projet === 'GRAND_PUBLIC')
    texteAide = 'Les fiches que vos campagnes vous ont confiées. Cherchez un nom ou un numéro.';
  else
    texteAide =
      "Vos fiches et celles que vos campagnes vous ont confiées. Cherchez un nom ou un numéro pour en voir d'autres.";

  return (
    <>
      {lienEnEchec ? (
        <p
          role="alert"
          className="rounded-md border border-border bg-warning-surface px-3 py-2 text-[0.875rem] text-warning"
        >
          La fiche ouverte depuis les rappels n'a pas pu être chargée. Cherchez-la ci-dessous.
        </p>
      ) : null}
      {confirme === null ? null : (
        <div
          role="status"
          className={cn(
            'flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-[0.875rem] font-[600] text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
            REVELE,
          )}
        >
          <CheckCircle2Icon
            className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          <span>{confirme}</span>
        </div>
      )}
      <ChampAnnuaire value={search} onChange={onSearch} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Fiches affichées">
          {(
            [
              [true, 'Reste à appeler'],
              [false, 'Toutes'],
            ] as const
          ).map(([valeur, libelle]) => (
            <Button
              key={libelle}
              type="button"
              size="sm"
              variant={resteAAppeler === valeur ? 'default' : 'outline'}
              aria-pressed={resteAAppeler === valeur}
              onClick={() => {
                onResteAAppeler(valeur);
              }}
            >
              {libelle}
              {resteAAppeler === valeur && total !== null && cherche === '' ? (
                <span className="ml-1.5 rounded-full bg-background/20 px-1.5 text-[0.75rem] tabular-nums">
                  {total}
                </span>
              ) : null}
            </Button>
          ))}
        </div>
        {origine === null ? null : <FiltreOrigine value={origine} onChange={onOrigine} />}
        <p className="text-[0.8125rem] text-muted-foreground">{texteAide}</p>
      </div>
      <AdvancedPanel
        module="console"
        startCollapsed
        chips={advancedChips}
        onRemove={onRemoveFilter}
        onClearAll={onClearFilters}
      >
        <FiltresConsole
          reference={reference}
          canaux={canaux}
          representantId={representantId}
          departementId={departementId}
          banqueId={banqueId}
          syndicatId={syndicatId}
          statut={statut}
          canalProvenanceId={canalProvenanceId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onRepresentantChange={onRepresentantChange}
          onDepartementChange={onDepartementChange}
          onBanqueChange={onBanqueChange}
          onSyndicatChange={onSyndicatChange}
          onStatutChange={onStatutChange}
          onCanalChange={onCanalChange}
          onDateFromChange={onDateFromChange}
          onDateToChange={onDateToChange}
        />
      </AdvancedPanel>
    </>
  );
}

function FiltresConsole({
  reference,
  canaux,
  representantId,
  departementId,
  banqueId,
  syndicatId,
  statut,
  canalProvenanceId,
  dateFrom,
  dateTo,
  onRepresentantChange,
  onDepartementChange,
  onBanqueChange,
  onSyndicatChange,
  onStatutChange,
  onCanalChange,
  onDateFromChange,
  onDateToChange,
}: Omit<
  EnTeteAnnuaireProps,
  | 'lienEnEchec'
  | 'confirme'
  | 'cherche'
  | 'search'
  | 'projet'
  | 'plateforme'
  | 'origine'
  | 'resteAAppeler'
  | 'total'
  | 'advancedChips'
  | 'onSearch'
  | 'onOrigine'
  | 'onResteAAppeler'
  | 'onRemoveFilter'
  | 'onClearFilters'
>) {
  return (
    <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-3">
      {reference && reference.representants.length > 0 ? (
        <FilterCombobox
          label="Représentant"
          placeholder="Tous les représentants"
          options={reference.representants}
          value={representantId}
          onChange={onRepresentantChange}
        />
      ) : null}
      <FilterCombobox
        label="Département"
        placeholder="Tous les départements"
        options={(reference?.departements ?? []).map((d) => ({
          value: d.id,
          label: withRetired(d.name ?? '', d.isActive ?? false),
          hint: d.regionName ?? undefined,
        }))}
        value={departementId}
        onChange={onDepartementChange}
      />
      <FilterCombobox
        label="Banque"
        placeholder="Toutes les banques"
        options={(reference?.banques ?? []).map((b) => ({
          value: b.id,
          label: withRetired(b.shortName ?? '', b.isActive ?? false),
          hint: b.name ?? undefined,
        }))}
        value={banqueId}
        onChange={onBanqueChange}
      />
      <FilterCombobox
        label="Syndicat"
        placeholder="Tous les syndicats"
        options={(reference?.syndicats ?? []).map((s) => ({
          value: s.id,
          label: withRetired(s.sigle ?? '', s.isActive ?? false),
          hint: s.secteur ?? undefined,
        }))}
        value={syndicatId}
        onChange={onSyndicatChange}
      />
      <FilterCombobox
        label="Statut"
        placeholder="Tous les statuts"
        options={PROSPECT_STATUTS.map((s) => ({ value: s, label: PROSPECT_STATUT_LABELS[s] }))}
        value={statut}
        onChange={onStatutChange}
      />
      <FilterCombobox
        label="Canal de provenance"
        placeholder="Tous les canaux"
        options={(canaux ?? []).map((c) => ({ value: c.id, label: c.label ?? '' }))}
        value={canalProvenanceId}
        onChange={onCanalChange}
      />
      <DatePicker
        id="console-date-from"
        label="Saisi à partir du"
        value={dateFrom}
        max={dateTo}
        onChange={onDateFromChange}
      />
      <DatePicker
        id="console-date-to"
        label="Saisi jusqu'au"
        value={dateTo}
        min={dateFrom}
        onChange={onDateToChange}
      />
    </div>
  );
}

function ChampAnnuaire({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => {
    champ.current?.focus();
  }, []);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="console-annuaire" className="text-[0.875rem] font-[600]">
        Quel prospect avez-vous appelé ?
      </label>
      <Input
        id="console-annuaire"
        ref={champ}
        type="search"
        autoComplete="off"
        placeholder="Chercher un prospect : nom ou numéro"
        className="h-12 text-[1rem]"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}
