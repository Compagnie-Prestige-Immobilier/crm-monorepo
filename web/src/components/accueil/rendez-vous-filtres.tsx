'use client';

import { DownloadIcon } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type FiltresRendezVous, lienExportRendezVous } from '@/lib/data/rendez-vous';

const TYPES: readonly { value: string; label: string }[] = [
  { value: 'tous', label: 'Tous les types' },
  { value: 'RV_CPI', label: 'RV CPI' },
  { value: 'RV_SITE', label: 'RV site' },
  { value: 'RV_EXTERNE', label: 'RV externe' },
  { value: 'RDV_TELEPHONIQUE', label: 'RV téléphonique' },
];

export function BarreRendezVous({
  filtres,
  changer,
  peutExporter,
}: {
  filtres: FiltresRendezVous;
  changer: (patch: Partial<FiltresRendezVous>) => void;
  peutExporter: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        type="search"
        value={filtres.search}
        placeholder="Nom ou numéro"
        aria-label="Rechercher un rendez-vous"
        className="max-w-xs"
        onChange={(event) => {
          changer({ search: event.target.value });
        }}
      />
      <Select
        items={TYPES}
        value={filtres.type === '' ? 'tous' : filtres.type}
        onValueChange={(valeur) => {
          changer({ type: valeur === 'tous' || valeur === null ? '' : valeur });
        }}
      >
        <SelectTrigger aria-label="Type de rendez-vous" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPES.map((choix) => (
            <SelectItem key={choix.value} value={choix.value}>
              {choix.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {peutExporter ? (
        <a
          href={lienExportRendezVous(filtres)}
          className={buttonVariants({
            variant: 'outline',
            size: 'sm',
            className: 'ml-auto gap-1.5',
          })}
        >
          <DownloadIcon className="size-3.5" aria-hidden="true" />
          Exporter
        </a>
      ) : null}
    </div>
  );
}
