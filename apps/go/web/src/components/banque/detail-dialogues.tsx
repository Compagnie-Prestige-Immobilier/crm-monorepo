import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import {
  Attente,
  ChampCommentaire,
  ChampMontantEncaisse,
  ChampMotif,
} from '@/components/banque/champs';
import { ChampObligatoire } from '@/components/banque/pieces';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchMotifs,
  franchirEtape,
  type CorpsTransition,
  type EtapeBanque,
} from '@/lib/data/bank-cases';
import { REFERENTIELS_STALE_MS } from '@/lib/data/referentiels';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';

const MOTIF_AUTRE = 'AUTRE';

function useTransition(dossierId: string, projet: Projet, onFini: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (corps: CorpsTransition) => franchirEtape(dossierId, corps),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bankCase(dossierId, projet) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bankCasesRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bankAnalyticsRoot });
      onFini();
    },
    onError: (erreur: unknown) => {
      toastApiError(erreur, 'L’enregistrement a échoué.');
    },
  });
}

function titreAvancee(encaissement: boolean, cible: EtapeBanque | null): string {
  return encaissement ? 'Déclarer l’encaissement' : `Passer à « ${cible?.label ?? ''} »`;
}

function descriptionAvancee(encaissement: boolean): string {
  return encaissement
    ? 'L’encaissement clôt le dossier. Correction possible ensuite par un administrateur.'
    : 'Étape suivante du flux ouvert.';
}

function corpsAvancee(
  cible: EtapeBanque,
  rev: number,
  encaissement: boolean,
  montant: string | null,
  commentaire: string,
): CorpsTransition {
  return {
    targetStageId: cible.id,
    expectedRev: rev,
    ...(encaissement && montant !== null ? { amountXof: montant } : {}),
    ...(commentaire.trim() === '' ? {} : { comment: commentaire.trim() }),
  };
}

export function DialogueAvancer({
  ouvert,
  onOuvert,
  dossierId,
  projet,
  rev,
  cible,
  encaissement,
}: {
  ouvert: boolean;
  onOuvert: (ouvert: boolean) => void;
  dossierId: string;
  projet: Projet;
  rev: number;
  cible: EtapeBanque | null;
  encaissement: boolean;
}) {
  const [montant, setMontant] = useState<string | null>(null);
  const [commentaire, setCommentaire] = useState('');

  const avancer = useTransition(dossierId, projet, () => {
    toast.success(encaissement ? 'Encaissement enregistré.' : 'Dossier passé à l’étape suivante.');
    setMontant(null);
    setCommentaire('');
    onOuvert(false);
  });

  const montantValide = !encaissement || (montant !== null && /[1-9]/u.test(montant));

  return (
    <Dialog
      open={ouvert}
      onOpenChange={(suivant) => {
        if (!suivant && avancer.isPending) return;
        onOuvert(suivant);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titreAvancee(encaissement, cible)}</DialogTitle>
          <DialogDescription>{descriptionAvancee(encaissement)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {encaissement ? <ChampMontantEncaisse valeur={montant} onChange={setMontant} /> : null}
          <ChampCommentaire valeur={commentaire} onChange={setCommentaire} />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={avancer.isPending}
            onClick={() => {
              onOuvert(false);
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={avancer.isPending || !montantValide || cible === null}
            onClick={() => {
              if (cible === null) return;
              avancer.mutate(corpsAvancee(cible, rev, encaissement, montant, commentaire));
            }}
          >
            <Attente
              enCours={avancer.isPending}
              libelle={encaissement ? 'Confirmer l’encaissement' : 'Confirmer'}
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DialogueRejeter({
  ouvert,
  onOuvert,
  dossierId,
  projet,
  rev,
  etapeRejet,
}: {
  ouvert: boolean;
  onOuvert: (ouvert: boolean) => void;
  dossierId: string;
  projet: Projet;
  rev: number;
  etapeRejet: EtapeBanque | undefined;
}) {
  const precisionId = useId();
  const [motif, setMotif] = useState<string | null>(null);
  const [precision, setPrecision] = useState('');
  const [commentaire, setCommentaire] = useState('');

  const motifs = useQuery({
    queryKey: queryKeys.bankRejectionReasons,
    queryFn: () => fetchMotifs(),
    staleTime: REFERENTIELS_STALE_MS,
    enabled: ouvert,
  });

  const rejeter = useTransition(dossierId, projet, () => {
    toast.success('Dossier rejeté. Montant : 0 FCFA.');
    setMotif(null);
    setPrecision('');
    setCommentaire('');
    onOuvert(false);
  });

  const liste = motifs.data ?? [];
  const precisionRequise = liste.find((entree) => entree.id === motif)?.code === MOTIF_AUTRE;
  const envoyable =
    etapeRejet !== undefined &&
    motif !== null &&
    (!precisionRequise || precision.trim() !== '') &&
    !rejeter.isPending;

  return (
    <Dialog
      open={ouvert}
      onOpenChange={(suivant) => {
        if (!suivant && rejeter.isPending) return;
        onOuvert(suivant);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rejeter ce dossier ?</DialogTitle>
          {/* Le montant est écrit en toutes lettres : le serveur force 0 sur un
              rejet, et l'agent qui voit un montant à l'écran croirait le garder. */}
          <DialogDescription>
            Le rejet clôt le dossier. <strong className="font-[600]">Montant : 0 FCFA</strong>.
            Correction possible ensuite par un administrateur.
          </DialogDescription>
        </DialogHeader>

        {etapeRejet === undefined ? (
          <p role="alert" className="text-[0.875rem] text-destructive">
            Aucune étape de rejet active. Un administrateur doit en activer une.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <ChampMotif motifs={liste} valeur={motif} onChange={setMotif} />

            {precisionRequise ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={precisionId}>
                  Précision
                  <ChampObligatoire />
                </Label>
                <Textarea
                  id={precisionId}
                  value={precision}
                  maxLength={2000}
                  onChange={(evenement) => {
                    setPrecision(evenement.target.value);
                  }}
                />
              </div>
            ) : null}

            <ChampCommentaire valeur={commentaire} onChange={setCommentaire} />
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={rejeter.isPending}
            onClick={() => {
              onOuvert(false);
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!envoyable}
            onClick={() => {
              if (etapeRejet === undefined || motif === null) return;
              rejeter.mutate({
                targetStageId: etapeRejet.id,
                expectedRev: rev,
                rejectionReasonId: motif,
                ...(precision.trim() === '' ? {} : { rejectionDetail: precision.trim() }),
                ...(commentaire.trim() === '' ? {} : { comment: commentaire.trim() }),
              });
            }}
          >
            <Attente enCours={rejeter.isPending} libelle="Rejeter définitivement" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
