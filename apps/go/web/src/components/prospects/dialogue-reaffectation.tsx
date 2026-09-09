import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useOptionsRepresentants } from '@/components/prospects/options-representants';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FilterCombobox, type OptionFiltre } from '@/components/ui/filter-combobox';
import { reaffecterProspects, type Prospect } from '@/lib/data/prospects';
import { REFERENTIELS_STALE_MS } from '@/lib/data/referentiels';
import { fetchComptes, FILTRES_REPRENEURS } from '@/lib/data/users';
import { formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

/** La fiche déjà rattachée reste proposée même si la recherche ne la rend pas. */
function optionDeja(prospect: Prospect | null): OptionFiltre | null {
  if (prospect === null || prospect.representantId === null) return null;
  return { value: prospect.representantId, label: prospect.representantName ?? 'Représentant' };
}

/** Seuls les rattachements CHANGÉS repartent : le serveur ignore les autres. */
function ecarts(
  prospect: Prospect,
  representantId: string | null,
  commercialId: string | null,
): { representantId?: string; commercialId?: string } {
  const change: { representantId?: string; commercialId?: string } = {};
  if (representantId !== null && representantId !== prospect.representantId) {
    change.representantId = representantId;
  }
  if (commercialId !== null && commercialId !== prospect.ownedByCommercialId) {
    change.commercialId = commercialId;
  }
  return change;
}

export function DialogueReaffectation({
  prospect,
  onOpenChange,
}: {
  prospect: Prospect | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [representantId, setRepresentantId] = useState<string | null>(null);
  const [commercialId, setCommercialId] = useState<string | null>(null);

  useEffect(() => {
    if (prospect === null) return;
    // oxlint-disable-next-line react/set-state-in-effect -- saisie recalée sur la fiche ouverte
    setRepresentantId(prospect.representantId);
    setCommercialId(prospect.ownedByCommercialId);
  }, [prospect]);

  const representants = useOptionsRepresentants(optionDeja(prospect), prospect !== null);

  const teleconseillers = useQuery({
    queryKey: queryKeys.commerciaux({ ...FILTRES_REPRENEURS }),
    queryFn: () => fetchComptes(FILTRES_REPRENEURS),
    staleTime: REFERENTIELS_STALE_MS,
  });

  const reaffecter = useMutation({
    mutationFn: () => {
      if (prospect === null) throw new Error('Aucun prospect sélectionné.');
      return reaffecterProspects({
        prospectIds: [prospect.id],
        ...ecarts(prospect, representantId, commercialId),
      });
    },
    onSuccess: (resultat) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
      toast.success(resultat.updated === 0 ? 'Rattachement inchangé.' : 'Prospect réaffecté.');
      onOpenChange(false);
    },
    onError: (erreur) => {
      toastApiError(erreur, 'La réaffectation a échoué.');
    },
  });

  const inchange =
    prospect === null || Object.keys(ecarts(prospect, representantId, commercialId)).length === 0;

  return (
    <Dialog
      open={prospect !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Réaffecter le prospect</DialogTitle>
          <DialogDescription>
            {prospect === null
              ? ''
              : `${prospect.prenom} ${prospect.nom}, ${formatPhone(prospect.phoneE164)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <FilterCombobox
            label="Représentant"
            placeholder="Choisir un représentant"
            value={representantId}
            options={representants.options}
            filtrer={false}
            onSearchChange={representants.onSearchChange}
            onChange={setRepresentantId}
          />
          <FilterCombobox
            label="Téléconseiller"
            placeholder="Choisir un téléconseiller"
            value={commercialId}
            options={(teleconseillers.data?.items ?? []).map((compte) => ({
              value: compte.id,
              label: compte.fullName,
            }))}
            onChange={setCommercialId}
          />
          <p className="text-[0.75rem] text-muted-foreground">
            Le représentant détermine le département. Le téléconseiller propriétaire retrouve le
            prospect dans ses listes.
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
            disabled={inchange || reaffecter.isPending}
            onClick={() => {
              reaffecter.mutate();
            }}
          >
            {reaffecter.isPending ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Réaffecter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
