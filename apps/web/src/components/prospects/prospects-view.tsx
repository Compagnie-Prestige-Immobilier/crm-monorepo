'use client';

import { FiltersBar } from '@/components/filters/filters-bar';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { ProspectExportMenu } from '@/components/prospects/export-menu';
import { ProspectsTable } from '@/components/prospects/prospects-table';

export function ProspectsView({
  canAdminister,
  readOnly = false,
}: {
  canAdminister: boolean;
  readOnly?: boolean;
}) {
  const { filters } = useProspectFilters();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.9375rem] text-muted-foreground">Filtrables et exportables.</p>
        {readOnly ? null : <ProspectExportMenu filters={filters} />}
      </div>

      <FiltersBar />
      <ProspectsTable canAdminister={canAdminister} readOnly={readOnly} />
    </div>
  );
}
