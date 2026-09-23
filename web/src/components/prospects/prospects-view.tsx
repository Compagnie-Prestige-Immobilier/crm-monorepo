'use client';

import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { FilterCombobox } from '@/components/filters/filter-combobox';
import { FiltersBar } from '@/components/filters/filters-bar';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { NouveauProspect } from '@/components/grand-public/nouveau-prospect';
import { ProspectExportMenu } from '@/components/prospects/export-menu';
import { NouveauProspectConsole } from '@/components/prospects/nouveau-prospect-console';
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
import {
  fetchCanauxProvenance,
  grandPublicKeys,
  type CanalProvenance,
} from '@/lib/data/grand-public';
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

/** Un seul projet autorise : inutile de le demander. */
function projetImpose(canCreateChues: boolean, canCreateGrandPublic: boolean): Projet | null {
  if (canCreateChues && !canCreateGrandPublic) return 'CHUES';
  if (!canCreateChues && canCreateGrandPublic) return 'GRAND_PUBLIC';
  return null;
}

type TypeContact = 'APPEL_ENTRANT' | 'WHATSAPP';

const TYPES_CONTACT: readonly { code: TypeContact; label: string }[] = [
  { code: 'APPEL_ENTRANT', label: 'Appel entrant' },
  { code: 'WHATSAPP', label: 'SMS / Whatsapp' },
];

function ChoixTypeContact({
  canaux,
  onChoisi,
  onAnnuler,
}: {
  canaux: readonly CanalProvenance[];
  onChoisi: (canalProvenanceId: string | null) => void;
  onAnnuler: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[0.9375rem] text-muted-foreground">
        Comment ce prospect a-t-il pris contact ?
      </p>
      <div className="flex flex-wrap gap-3">
        {TYPES_CONTACT.map((type) => (
          <Button
            key={type.code}
            type="button"
            variant="outline"
            className="h-auto min-w-[220px] flex-1 py-4"
            onClick={() => {
              const canal = canaux.find((item) => item.code === type.code);
              onChoisi(canal?.id ?? null);
            }}
          >
            {type.label}
          </Button>
        ))}
      </div>
      <Button variant="ghost" className="self-start px-0" onClick={onAnnuler}>
        Annuler
      </Button>
    </div>
  );
}

function ChoixCanalProvenance({
  canaux,
  initialCanalId,
  onValider,
  onRetour,
}: {
  canaux: readonly CanalProvenance[];
  initialCanalId: string | null;
  onValider: (canalProvenanceId: string | null) => void;
  onRetour: () => void;
}) {
  const [canalId, setCanalId] = useState(initialCanalId);
  const options = canaux
    .filter((canal) => canal.isActive === true)
    .map((canal) => ({ value: canal.id, label: canal.label ?? '' }));

  return (
    <div className="flex flex-col gap-4">
      <FilterCombobox
        label="Canal de provenance"
        placeholder="Choisir un canal"
        value={canalId}
        options={options}
        onChange={setCanalId}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onRetour}>
          Retour
        </Button>
        <Button type="button" onClick={() => onValider(canalId)}>
          Continuer
        </Button>
      </div>
    </div>
  );
}

function EtapeFormulaire({
  projet,
  canCreate,
  canCreateGrandPublic,
  canalProvenanceId,
  onClose,
}: {
  projet: Projet | null;
  canCreate: boolean;
  canCreateGrandPublic: boolean;
  canalProvenanceId: string | null;
  onClose: () => void;
}) {
  const vise = projet ?? projetImpose(canCreate, canCreateGrandPublic);
  if (vise === null) {
    return (
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nouveau prospect</DialogTitle>
        </DialogHeader>
        <NouveauProspectConsole
          canalProvenanceId={canalProvenanceId}
          onSaved={onClose}
          onAnnuler={onClose}
        />
      </DialogContent>
    );
  }
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
        <NouveauProspect
          embedded
          canalProvenanceId={canalProvenanceId}
          onSaved={onClose}
          onAnnuler={onClose}
        />
      ) : (
        <ProspectCreateForm
          representantId={null}
          canalProvenanceId={canalProvenanceId}
          onSaved={onClose}
        />
      )}
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
  const [etape, setEtape] = useState<'contact' | 'canal' | 'formulaire'>('contact');
  const [canalProvenanceId, setCanalProvenanceId] = useState<string | null>(null);

  const canaux = useQuery({
    queryKey: grandPublicKeys.canaux,
    queryFn: () => fetchCanauxProvenance(),
    staleTime: 5 * 60_000,
  });

  if (etape === 'contact') {
    return (
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nouveau prospect</DialogTitle>
        </DialogHeader>
        <ChoixTypeContact
          canaux={canaux.data ?? []}
          onChoisi={(id) => {
            setCanalProvenanceId(id);
            setEtape('canal');
          }}
          onAnnuler={onClose}
        />
      </DialogContent>
    );
  }

  if (etape === 'canal') {
    return (
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nouveau prospect</DialogTitle>
        </DialogHeader>
        <ChoixCanalProvenance
          canaux={canaux.data ?? []}
          initialCanalId={canalProvenanceId}
          onValider={(id) => {
            setCanalProvenanceId(id);
            setEtape('formulaire');
          }}
          onRetour={() => {
            setEtape('contact');
          }}
        />
      </DialogContent>
    );
  }

  return (
    <EtapeFormulaire
      projet={projet}
      canCreate={canCreate}
      canCreateGrandPublic={canCreateGrandPublic}
      canalProvenanceId={canalProvenanceId}
      onClose={onClose}
    />
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
