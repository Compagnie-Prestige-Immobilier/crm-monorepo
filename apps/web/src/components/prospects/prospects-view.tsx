'use client';

import { FiltersBar } from '@/components/filters/filters-bar';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { ProspectExportMenu } from '@/components/prospects/export-menu';
import { ProspectsTable } from '@/components/prospects/prospects-table';

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
