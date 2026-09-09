'use client';

import { useQuery } from '@tanstack/react-query';
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
import { fetchProspects } from '@/lib/data/prospects';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

export function ProspectsView({
  canAdminister,
  canExport = false,
  readOnly = false,
  simplified = false,
  campaignScoped = false,
}: {
  canAdminister: boolean;
  canExport?: boolean;
  readOnly?: boolean;
  /** Les critères repliés le RESTENT à l'ouverture, même venus d'un lien filtré. */
  simplified?: boolean;
  /** Téléconseiller : l'API ne lui rend que ses fiches et celles de ses campagnes. */
  campaignScoped?: boolean;
}) {
  const { filters } = useProspectFilters();
  const [createOpen, setCreateOpen] = useState(false);

  // Même clé que le tableau : le compte vient du cache, sans seconde requête.
  const { data } = useQuery({
    queryKey: queryKeys.prospects(filters),
    queryFn: () => fetchProspects(filters),
    placeholderData: (previous) => previous,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Le chiffre réel remplace « Filtrables et exportables. », qui décrivait
            l'écran à qui l'avait déjà sous les yeux. Pas de `role="status"` ici :
            celui du pied de tableau annonce déjà la page affichée. */}
        <p className="text-[0.9375rem] text-muted-foreground">
          <span aria-live="polite" className="font-[600] text-foreground tabular-nums">
            {data === undefined ? '–' : formatNumber(data.total)}
          </span>{' '}
          prospect{data !== undefined && data.total > 1 ? 's' : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          {canExport ? <ProspectExportMenu filters={filters} /> : null}
          {readOnly ? null : (
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon aria-hidden="true" />
              Nouveau prospect
            </Button>
          )}
        </div>
      </div>

      <FiltersBar startCollapsed={simplified} />
      <ProspectsTable
        canAdminister={canAdminister}
        readOnly={readOnly}
        campaignScoped={campaignScoped}
      />
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
