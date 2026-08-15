'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, LoaderIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  approveClientRequest,
  rejectClientRequest,
  type ClientRequest,
} from '@/lib/data/client-requests';
import { fetchReferenceData } from '@/lib/data/reference';
import { formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { ENROLLMENT_METHODS, ENROLLMENT_METHOD_LABELS, type EnrollmentMethod } from '@/lib/types';

/**
 * Les deux décisions possibles sur une demande, dans un composant unique.
 *
 * Un seul composant parce que les deux dialogues sont mutuellement exclusifs et
 * portent le MÊME objet : les séparer obligerait l'écran appelant à tenir deux
 * états ouverts/fermés et à garantir lui-même qu'ils ne le soient jamais
 * ensemble.
 *
 * L'approbation demande trois champs que l'API exige et que la banque ne
 * connaît pas : représentant de rattachement, syndicat et méthode d'enrôlement.
 * Ce n'est pas de la bureaucratie ajoutée : le prospect naît en
 * `METHOD_OBTAINED` (la condition exacte du filtre de recherche bancaire, pour
 * que le dossier puisse s'y rattacher tout de suite), et une contrainte CHECK
 * lie ce statut à la méthode. Les demander ici évite de créer une fiche qui
 * échouerait à l'insertion, ou pire, qui serait invisible du formulaire de
 * dossier après avoir été approuvée.
 */
export function ClientRequestReviewDialogs({
  pending,
  onClose,
}: {
  pending: { request: ClientRequest; action: 'approve' | 'reject' } | null;
  onClose: () => void;
}) {
  return (
    <>
      <ApproveDialog
        request={pending?.action === 'approve' ? pending.request : null}
        onClose={onClose}
      />
      <RejectDialog
        request={pending?.action === 'reject' ? pending.request : null}
        onClose={onClose}
      />
    </>
  );
}

function ApproveDialog({
  request,
  onClose,
}: {
  request: ClientRequest | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const representantId = useId();
  const syndicatId = useId();
  const methodId = useId();

  const [representant, setRepresentant] = useState<string | null>(null);
  const [syndicat, setSyndicat] = useState<string | null>(null);
  const [method, setMethod] = useState<EnrollmentMethod | null>(null);

  // Remise à zéro à chaque nouvelle demande : garder le choix précédent ferait
  // rattacher la fiche suivante au représentant de la précédente, en un clic
  // et sans que rien ne l'annonce.
  useEffect(() => {
    setRepresentant(null);
    setSyndicat(null);
    setMethod(null);
  }, [request?.id]);

  const { data: reference } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
    enabled: request !== null,
  });

  const approve = useMutation({
    mutationFn: () => {
      if (request === null) throw new Error('Aucune demande sélectionnée.');
      if (representant === null || syndicat === null || method === null) {
        throw new Error('Champs obligatoires manquants.');
      }
      return approveClientRequest(request.id, {
        representantId: representant,
        syndicatId: syndicat,
        enrollmentMethod: method,
      });
    },
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clientRequestsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
      toast.success(`Prospect créé pour ${updated.prenom} ${updated.nom}.`);
      onClose();
    },
    onError: (error) => {
      toastApiError(error, 'La demande n’a pas pu être approuvée.');
    },
  });

  const canSubmit =
    representant !== null && syndicat !== null && method !== null && !approve.isPending;

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && approve.isPending) return;
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Approuver la demande</DialogTitle>
          <DialogDescription>
            {request === null
              ? ''
              : `${request.prenom} ${request.nom}, ${formatPhone(request.phoneE164)}, demandé par ${request.banqueName}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <FilterCombobox
            label="Représentant de rattachement"
            placeholder="Choisir un représentant"
            value={representant}
            options={reference?.representants ?? []}
            onChange={setRepresentant}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={syndicatId}>
              Syndicat
              <span className="text-destructive" aria-label="obligatoire">
                *
              </span>
            </Label>
            <Select value={syndicat ?? ''} onValueChange={setSyndicat}>
              <SelectTrigger id={syndicatId} className="w-full">
                <SelectValue placeholder="Choisir un syndicat" />
              </SelectTrigger>
              <SelectContent>
                {(reference?.syndicats ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.sigle}, {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={methodId}>
              Méthode d’enrôlement
              <span className="text-destructive" aria-label="obligatoire">
                *
              </span>
            </Label>
            <Select
              value={method ?? ''}
              onValueChange={(value) => {
                setMethod(value as EnrollmentMethod);
              }}
            >
              <SelectTrigger id={methodId} className="w-full">
                <SelectValue placeholder="Choisir une méthode" />
              </SelectTrigger>
              <SelectContent>
                {ENROLLMENT_METHODS.map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>
                    {ENROLLMENT_METHOD_LABELS[candidate]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[0.75rem] text-muted-foreground">
              Le prospect naît en « méthode obtenue » : c’est ce qui permet à la banque de lui
              rattacher son dossier immédiatement.
            </p>
          </div>

          <p className="text-[0.75rem] text-muted-foreground" id={representantId}>
            La banque demandeuse devient la provenance de la fiche.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={approve.isPending} onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              approve.mutate();
            }}
          >
            {approve.isPending ? (
              <>
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                Création…
              </>
            ) : (
              <>
                <CheckIcon aria-hidden="true" />
                Créer le prospect
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  request,
  onClose,
}: {
  request: ClientRequest | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const reasonId = useId();
  const [reason, setReason] = useState('');

  useEffect(() => {
    setReason('');
  }, [request?.id]);

  const reject = useMutation({
    mutationFn: () => {
      if (request === null) throw new Error('Aucune demande sélectionnée.');
      return rejectClientRequest(request.id, reason.trim());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clientRequestsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.inbox });
      toast.success('Demande refusée. Le motif est remonté au demandeur.');
      onClose();
    },
    onError: (error) => {
      toastApiError(error, 'Le refus n’a pas pu être enregistré.');
    },
  });

  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= 3 && trimmed.length <= 2000 && !reject.isPending;

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && reject.isPending) return;
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Refuser la demande</DialogTitle>
          <DialogDescription>
            {/* Le motif est obligatoire, et l'écran dit POURQUOI : il part au
                demandeur. Un refus muet le renverrait à son impasse de départ,
                sans savoir s'il doit corriger le numéro ou renoncer. */}
            Le motif est transmis à l’agent qui a déposé la demande.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={reasonId}>
            Motif du refus
            <span className="text-destructive" aria-label="obligatoire">
              *
            </span>
          </Label>
          <Textarea
            id={reasonId}
            value={reason}
            rows={4}
            maxLength={2000}
            placeholder="Client déjà en base sous un autre numéro, à rechercher sous…"
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
          <p className="text-[0.75rem] text-muted-foreground">Trois caractères au minimum.</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={reject.isPending} onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit}
            onClick={() => {
              reject.mutate();
            }}
          >
            {reject.isPending ? (
              <>
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                Enregistrement…
              </>
            ) : (
              'Refuser la demande'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
