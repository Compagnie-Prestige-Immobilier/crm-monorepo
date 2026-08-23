'use client';

import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { FiltersBar } from '@/components/filters/filters-bar';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { ProspectExportMenu } from '@/components/prospects/export-menu';
import { ProspectCreateForm } from '@/components/prospects/prospect-create-form';
import { ProspectsTable } from '@/components/prospects/prospects-table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ProspectsView({
  canAdminister,
  readOnly = false,
}: {
  canAdminister: boolean;
  readOnly?: boolean;
}) {
  const { filters } = useProspectFilters();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.9375rem] text-muted-foreground">Filtrables et exportables.</p>
        {readOnly ? null : (
          <div className="flex flex-wrap gap-2">
            <ProspectExportMenu filters={filters} />
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon aria-hidden="true" />
              Nouveau prospect
            </Button>
          </div>
        )}
      </div>

      <FiltersBar />
      <ProspectsTable canAdminister={canAdminister} readOnly={readOnly} />
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nouveau prospect CHUES</DialogTitle>
            <DialogDescription>
              Recherchez le représentant par son nom ou son numéro.
            </DialogDescription>
          </DialogHeader>
          <ProspectCreateForm representantId={null} onSaved={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
