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

/**
 * Réaffectation d'un prospect.
 *
 * Deux rattachements distincts, et c'est la raison d'être de cet écran séparé :
 * le REPRÉSENTANT (qui a présenté le prospect, donc le département) et le
 * COMMERCIAL propriétaire (qui le voit dans son application). Les confondre
 * ferait disparaître un prospect de la tournée d'un commercial sans qu'il
 * comprenne pourquoi.
 */
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
    setRepresentantId(prospect.representantId);
    setCommercialId(prospect.ownedByCommercialId);
  }, [prospect]);

  const mutation = useMutation({
    mutationFn: () => {
      if (prospect === null) throw new Error('Aucun prospect sélectionné.');
      return reassignProspects({
        prospectIds: [prospect.id],
        // On n'envoie que ce qui change : réaffecter vers la valeur déjà en
        // place ferait tout de même monter la révision et déclencherait une
        // synchronisation inutile sur tous les téléphones.
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
      toast.success(
        result.updated === 0
          ? 'Rattachement inchangé.'
          : 'Prospect réaffecté.',
      );
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'La réaffectation a échoué.');
    },
  });

  const unchanged =
    prospect !== null &&
    (representantId === null || representantId === prospect.representantId) &&
    (commercialId === null || commercialId === prospect.ownedByCommercialId);

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
          <DialogDescription>
            {prospect === null
              ? null
              : `${prospect.prenom} ${prospect.nom}, ${formatPhone(prospect.phoneE164)}`}
          </DialogDescription>
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
            Le représentant détermine le département. Le commercial propriétaire voit le prospect
            dans l’application mobile.
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
