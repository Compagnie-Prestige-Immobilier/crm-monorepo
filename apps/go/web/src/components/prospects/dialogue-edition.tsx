import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChampsEdition, type Saisie } from '@/components/prospects/dialogue-edition-champs';
import { useOptionsRepresentants } from '@/components/prospects/options-representants';
import type { OptionFiltre } from '@/components/ui/filter-combobox';
import { modifierProspect, type Prospect, type ProspectBody } from '@/lib/data/prospects';
import { fetchReferentiels, REFERENTIELS_STALE_MS } from '@/lib/data/referentiels';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

function saisieDe(prospect: Prospect): Saisie {
  return {
    nom: prospect.nom,
    prenom: prospect.prenom,
    phone: prospect.phoneE164,
    statut: prospect.statut,
    banqueId: prospect.banqueId,
    syndicatId: prospect.syndicatId,
    representantId: prospect.representantId,
  };
}

function corpsDe(saisie: Saisie): ProspectBody {
  return {
    nom: saisie.nom.trim(),
    prenom: saisie.prenom.trim(),
    phone: saisie.phone.trim(),
    statut: saisie.statut,
    banqueId: saisie.banqueId,
    syndicatId: saisie.syndicatId,
    ...(saisie.representantId === null ? {} : { representantId: saisie.representantId }),
  };
}

/** La fiche déjà rattachée reste proposée même si la recherche ne la rend pas. */
function optionDeja(prospect: Prospect | null): OptionFiltre | null {
  if (prospect === null || prospect.representantId === null) return null;
  return { value: prospect.representantId, label: prospect.representantName ?? 'Représentant' };
}

export function DialogueEditionProspect({
  prospect,
  onOpenChange,
}: {
  prospect: Prospect | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const statutId = useId();
  const [saisie, setSaisie] = useState<Saisie | null>(null);

  useEffect(() => {
    if (prospect === null) return;
    // oxlint-disable-next-line react/set-state-in-effect -- formulaire recalé sur la fiche ouverte
    setSaisie(saisieDe(prospect));
  }, [prospect]);

  const referentiels = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferentiels(),
    staleTime: REFERENTIELS_STALE_MS,
  });

  const representants = useOptionsRepresentants(optionDeja(prospect), prospect !== null);

  const enregistrer = useMutation({
    mutationFn: () => {
      if (prospect === null || saisie === null) throw new Error('Aucun prospect sélectionné.');
      return modifierProspect(prospect.id, corpsDe(saisie));
    },
    onSuccess: (enregistre) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      toast.success(`${enregistre.prenom} ${enregistre.nom} enregistré.`);
      onOpenChange(false);
    },
    onError: (erreur) => {
      toastApiError(erreur, 'L’enregistrement a échoué.');
    },
  });

  const modifier = <K extends keyof Saisie>(cle: K, valeur: Saisie[K]): void => {
    setSaisie((courant) => (courant === null ? courant : { ...courant, [cle]: valeur }));
  };

  return (
    <Dialog
      open={prospect !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Modifier le prospect</DialogTitle>
          <DialogDescription>Saisi par {prospect?.ownedByCommercialName ?? '–'}.</DialogDescription>
        </DialogHeader>

        {saisie === null || prospect === null ? null : (
          <ChampsEdition
            statutId={statutId}
            saisie={saisie}
            prospect={prospect}
            banques={referentiels.data?.banques}
            syndicats={referentiels.data?.syndicats}
            representants={representants}
            modifier={modifier}
          />
        )}

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
            disabled={enregistrer.isPending}
            onClick={() => {
              enregistrer.mutate();
            }}
          >
            {enregistrer.isPending ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
