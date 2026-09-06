'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { FilterCombobox } from '@/components/filters/filter-combobox';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { reassignProspects } from '@/lib/data/prospects';
import { fetchReferenceData } from '@/lib/data/reference';
import { formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { ProspectRow } from '@/lib/types';

function isReassignUnchanged(
  prospect: ProspectRow | null,
  representantId: string | null,
  commercialId: string | null,
) {
  if (prospect === null) return false;
  const sameRepresentant = representantId === null || representantId === prospect.representantId;
  const sameCommercial = commercialId === null || commercialId === prospect.ownedByCommercialId;
  return sameRepresentant && sameCommercial;
}

function reassignSummary(prospect: ProspectRow | null) {
  if (prospect === null) return null;
  return `${prospect.prenom} ${prospect.nom}, ${formatPhone(prospect.phoneE164)}`;
}

export function ProspectReassignDialog({
  prospect,
  onOpenChange,
}: {
  prospect: ProspectRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [representantId, setRepresentantId] = useState<string | null>(null);
  const [commercialId, setCommercialId] = useState<string | null>(null);

  const { data: reference } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (prospect === null) return;
    // oxlint-disable-next-line react/set-state-in-effect -- saisie recalée sur le prospect
    setRepresentantId(prospect.representantId);
    setCommercialId(prospect.ownedByCommercialId);
  }, [prospect]);

  const mutation = useMutation({
    mutationFn: () => {
      if (prospect === null) throw new Error('Aucun prospect sélectionné.');
      return reassignProspects({
        prospectIds: [prospect.id],
        ...(representantId !== null && representantId !== prospect.representantId
          ? { representantId }
          : {}),
        ...(commercialId !== null && commercialId !== prospect.ownedByCommercialId
          ? { commercialId }
          : {}),
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
      toast.success(result.updated === 0 ? 'Rattachement inchangé.' : 'Prospect réaffecté.');
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'La réaffectation a échoué.');
    },
  });

  const unchanged = isReassignUnchanged(prospect, representantId, commercialId);

  return (
    <Dialog
      open={prospect !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Réaffecter le prospect</DialogTitle>
          <DialogDescription>{reassignSummary(prospect)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <FilterCombobox
            label="Représentant"
            placeholder="Choisir un représentant"
            options={reference?.representants ?? []}
            value={representantId}
            onChange={setRepresentantId}
          />
          <FilterCombobox
            label="Téléconseiller"
            placeholder="Choisir un téléconseiller"
            options={reference?.commerciaux ?? []}
            value={commercialId}
            onChange={setCommercialId}
          />
          <p className="text-[0.75rem] text-muted-foreground">
            Le représentant détermine le département. Le téléconseiller propriétaire voit le
            prospect dans l’application mobile.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={unchanged || mutation.isPending}
            onClick={() => {
              mutation.mutate();
            }}
          >
            {mutation.isPending ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Réaffecter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
