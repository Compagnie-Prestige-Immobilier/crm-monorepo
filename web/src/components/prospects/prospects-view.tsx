'use client';

import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { FiltersBar } from '@/components/filters/filters-bar';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { ProspectExportMenu } from '@/components/prospects/export-menu';
import { NouveauProspectConsole } from '@/components/prospects/nouveau-prospect-console';
import { ProspectsTable } from '@/components/prospects/prospects-table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchProspects } from '@/lib/data/prospects';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { Projet, ProspectFilters } from '@/lib/types';

export function ProspectsView({
  canAdminister,
  canReassign = false,
  canExport = false,
  readOnly = false,
  canCreate = false,
  canCreateGrandPublic = false,
  campaignScoped = false,
  viewerId,
}: {
  canAdminister: boolean;
  /** SUPERVISEUR : réaffecter une fiche malgré la lecture seule du reste. */
  canReassign?: boolean;
  canExport?: boolean;
  readOnly?: boolean;
  canCreate?: boolean;
  canCreateGrandPublic?: boolean;
  /** Téléconseiller : l'API ne lui rend que ses fiches et celles de ses campagnes. */
  campaignScoped?: boolean;
  viewerId?: string | undefined;
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
      <ProspectsEntete
        total={data?.total}
        canExport={canExport}
        filters={filters}
        peutCreer={peutCreerProjet(filters.projet, canCreate, canCreateGrandPublic)}
        onCreer={() => setCreateOpen(true)}
      />

      <FiltersBar viewerId={viewerId} />
      <ProspectsTable
        canAdminister={canAdminister}
        canReassign={canReassign}
        readOnly={readOnly}
        campaignScoped={campaignScoped}
      />
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <CreationDialogContent onClose={() => setCreateOpen(false)} />
      </Dialog>
    </div>
  );
}

function ProspectsEntete({
  total,
  canExport,
  filters,
  peutCreer,
  onCreer,
}: {
  total: number | undefined;
  canExport: boolean;
  filters: ProspectFilters;
  peutCreer: boolean;
  onCreer: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Le chiffre réel remplace « Filtrables et exportables. », qui décrivait
          l'écran à qui l'avait déjà sous les yeux. Pas de `role="status"` ici :
          celui du pied de tableau annonce déjà la page affichée. */}
      <p className="text-[0.9375rem] text-muted-foreground">
        <span aria-live="polite" className="font-[600] text-foreground tabular-nums">
          {total === undefined ? '–' : formatNumber(total)}
        </span>{' '}
        prospect{total !== undefined && total > 1 ? 's' : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        {canExport ? <ProspectExportMenu filters={filters} /> : null}
        <CreateProspectButton visible={peutCreer} onClick={onCreer} />
      </div>
    </div>
  );
}

// La lecture seule du tableau ne vaut pas pour ce bouton : le superviseur et la
// direction ne modifient pas les lignes, mais ils creent des fiches, et le
// serveur le leur accorde.
function peutCreerProjet(
  projet: Projet | null,
  canCreateChues: boolean,
  canCreateGrandPublic: boolean,
): boolean {
  // Sans filtre de projet, le bouton restait cache : la fenetre demande le
  // projet plutot que de faire disparaitre le seul geste de l'ecran.
  if (projet === null) return canCreateChues || canCreateGrandPublic;
  return projet === 'CHUES' ? canCreateChues : canCreateGrandPublic;
}

function CreationDialogContent({ onClose }: { onClose: () => void }) {
  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Nouveau prospect</DialogTitle>
      </DialogHeader>
      <NouveauProspectConsole onSaved={onClose} onAnnuler={onClose} />
    </DialogContent>
  );
}

function CreateProspectButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  if (!visible) return null;
  return (
    <Button onClick={onClick}>
      <PlusIcon aria-hidden="true" />
      Nouveau prospect
    </Button>
  );
}
