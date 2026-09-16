'use client';

import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { FiltersBar } from '@/components/filters/filters-bar';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { NouveauProspect } from '@/components/grand-public/nouveau-prospect';
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
import type { Projet } from '@/lib/types';

export function ProspectsView({
  canAdminister,
  canExport = false,
  readOnly = false,
  canCreate = false,
  canCreateGrandPublic = false,
  campaignScoped = false,
  viewerId,
}: {
  canAdminister: boolean;
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
          <CreateProspectButton
            visible={peutCreerProjet(filters.projet, canCreate, canCreateGrandPublic)}
            onClick={() => setCreateOpen(true)}
          />
        </div>
      </div>

      <FiltersBar viewerId={viewerId} />
      <ProspectsTable
        canAdminister={canAdminister}
        readOnly={readOnly}
        campaignScoped={campaignScoped}
      />
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <CreationDialogContent
          projet={filters.projet}
          onClose={() => setCreateOpen(false)}
          canCreate={canCreate}
          canCreateGrandPublic={canCreateGrandPublic}
        />
      </Dialog>
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

/** Un seul projet autorise : inutile de le demander. */
function projetImpose(canCreateChues: boolean, canCreateGrandPublic: boolean): Projet | null {
  if (canCreateChues && !canCreateGrandPublic) return 'CHUES';
  if (!canCreateChues && canCreateGrandPublic) return 'GRAND_PUBLIC';
  return null;
}

function ChoixDuProjet({ onChoisir }: { onChoisir: (projet: Projet) => void }) {
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Nouveau prospect</DialogTitle>
        <DialogDescription>Pour quel projet ?</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          onClick={() => {
            onChoisir('CHUES');
          }}
        >
          CHUES
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            onChoisir('GRAND_PUBLIC');
          }}
        >
          Grand Public
        </Button>
      </div>
    </DialogContent>
  );
}

function CreationDialogContent({
  projet,
  onClose,
  canCreate,
  canCreateGrandPublic,
}: {
  projet: Projet | null;
  onClose: () => void;
  canCreate: boolean;
  canCreateGrandPublic: boolean;
}) {
  const [choisi, setChoisi] = useState<Projet | null>(null);
  const vise = projet ?? choisi ?? projetImpose(canCreate, canCreateGrandPublic);
  if (vise === null) return <ChoixDuProjet onChoisir={setChoisi} />;
  const grandPublic = vise === 'GRAND_PUBLIC';

  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>
          {grandPublic ? 'Nouveau prospect Grand Public' : 'Nouveau prospect'}
        </DialogTitle>
        {grandPublic ? null : (
          <DialogDescription>
            Recherchez le représentant par son nom ou son numéro.
          </DialogDescription>
        )}
      </DialogHeader>
      {grandPublic && canCreateGrandPublic ? (
        <NouveauProspect embedded onSaved={onClose} onAnnuler={onClose} />
      ) : (
        <ProspectCreateForm representantId={null} onSaved={onClose} />
      )}
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
