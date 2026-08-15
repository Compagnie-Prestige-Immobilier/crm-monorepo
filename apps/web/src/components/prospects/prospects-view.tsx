'use client';

import { FiltersBar } from '@/components/filters/filters-bar';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { ProspectExportMenu } from '@/components/prospects/export-menu';
import { ProspectsTable } from '@/components/prospects/prospects-table';

/**
 * Un seul `useProspectFilters()` alimente la barre de filtre, le tableau ET
 * l'export. Le fichier téléchargé décrit donc exactement la liste affichée -
 * c'est la garantie que l'administrateur ne peut pas envoyer au siège un
 * export qui ne correspond pas à ce qu'il vient de lire.
 */
export function ProspectsView({ canAdminister }: { canAdminister: boolean }) {
  const { filters } = useProspectFilters();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.9375rem] text-muted-foreground">Filtrables et exportables.</p>
        <ProspectExportMenu filters={filters} />
      </div>

      <FiltersBar />
      <ProspectsTable canAdminister={canAdminister} />
    </div>
  );
}
