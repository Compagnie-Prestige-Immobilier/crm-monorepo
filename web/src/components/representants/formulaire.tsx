import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, LoaderIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';

import type { ConflitNumero } from '@/components/representants/aide-numero';
import {
  CorpsFormulaireRepresentant,
  type SaisieOuverte,
} from '@/components/representants/formulaire-corps';
import {
  corpsDeCreation,
  corpsDeModification,
  ficheEnvoyable,
  valeursDeDepart,
  type AmorceRepresentant,
  type SaisieFiche,
} from '@/components/representants/formulaire-patch';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  chercherRepresentantParNumero,
  creerRepresentant,
  modifierRepresentant,
  type Representant,
} from '@/lib/data/representants';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

export type { AmorceRepresentant };

export function FormulaireRepresentant({
  open,
  onOpenChange,
  representant,
  amorce = null,
  onEnregistre,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  representant: Representant | null;
  /** Amorce d'une création : un nom ou un numéro proposé pendant un appel. */
  amorce?: AmorceRepresentant | null;
  onEnregistre?: ((representant: Representant) => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const ids = {
    nom: useId(),
    phone: useId(),
    notes: useId(),
    relation: useId(),
    motif: useId(),
    whatsapp: useId(),
    whatsappNumber: useId(),
    profession: useId(),
    prenom: useId(),
    etablissement: useId(),
    connaitUES: useId(),
    contacte: useId(),
  };

  const [saisie, setSaisie] = useState<SaisieOuverte>(() => valeursDeDepart(representant, amorce));
  const [conflit, setConflit] = useState<ConflitNumero | null>(null);

  useEffect(() => {
    if (!open) return;
    // oxlint-disable-next-line react/set-state-in-effect -- formulaire recalé à l'ouverture
    setSaisie(valeursDeDepart(representant, amorce));
    setConflit(null);
  }, [open, representant, amorce]);

  const verifierNumero = useMutation({
    mutationFn: (valeur: string) => chercherRepresentantParNumero(valeur),
    onSuccess: (trouve) => {
      const sien = representant !== null && trouve.representant.id === representant.id;
      if (!trouve.found || sien) {
        setConflit(null);
        return;
      }
      setConflit({
        label: trouve.representant.fullName,
        proprietaire: trouve.ownedByCommercialName,
      });
    },
    onError: () => {
      setConflit(null);
    },
  });

  const enregistrer = useMutation({
    mutationFn: () => {
      if (saisie.departementId === null) throw new Error('Département manquant.');
      const complete: SaisieFiche = { ...saisie, departementId: saisie.departementId };
      if (representant === null) return creerRepresentant(corpsDeCreation(complete));
      return modifierRepresentant(representant.id, corpsDeModification(representant, complete));
    },
    onSuccess: (enregistre) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
      toast.success(
        representant === null
          ? `${enregistre.fullName} créé.`
          : `Fiche de ${enregistre.fullName} mise à jour.`,
      );
      onEnregistre?.(enregistre);
      onOpenChange(false);
    },
    onError: (erreur) => {
      toastApiError(erreur, 'La fiche n’a pas pu être enregistrée.');
    },
  });

  const edition = representant !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(suivant) => {
        if (!suivant && enregistrer.isPending) return;
        onOpenChange(suivant);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{edition ? 'Modifier le représentant' : 'Nouveau représentant'}</DialogTitle>
          <DialogDescription>
            {edition
              ? 'Le numéro sert de clé de rattachement des prospects déjà saisis.'
              : 'Une fiche naît normalement en tournée. Cette saisie couvre l’exception.'}
          </DialogDescription>
        </DialogHeader>

        <CorpsFormulaireRepresentant
          ids={ids}
          saisie={saisie}
          setSaisie={setSaisie}
          representant={representant}
          conflit={conflit}
          setConflit={setConflit}
          verification={verifierNumero.isPending}
          onVerifierNumero={(numero) => {
            verifierNumero.mutate(numero);
          }}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={enregistrer.isPending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={
              !ficheEnvoyable({
                fullName: saisie.fullName,
                phone: saisie.phone,
                departementId: saisie.departementId,
                sansConflit: conflit === null,
                enCours: enregistrer.isPending,
              })
            }
            onClick={() => {
              enregistrer.mutate();
            }}
          >
            {enregistrer.isPending ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckIcon aria-hidden="true" />
            )}
            {edition ? 'Enregistrer' : 'Créer la fiche'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
