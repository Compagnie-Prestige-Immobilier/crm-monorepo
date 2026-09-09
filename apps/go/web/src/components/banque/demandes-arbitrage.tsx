import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { Attente, ChampSelect, ChampTexte } from '@/components/banque/champs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FilterCombobox } from '@/components/ui/filter-combobox';
import { SearchField, useRechercheDifferee } from '@/components/ui/search-field';
import { chercherRepresentants } from '@/lib/data/bank-cases';
import { approuverDemande, refuserDemande, type DemandeClient } from '@/lib/data/client-requests';
import { enOptions, fetchReferentiels, REFERENTIELS_STALE_MS } from '@/lib/data/referentiels';
import { formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

export type Arbitrage = { demande: DemandeClient; action: 'approuver' | 'refuser' };

function useArbitrage(onFini: () => void) {
  const queryClient = useQueryClient();
  return {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clientRequestsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.inboxRoot });
      onFini();
    },
  };
}

function DialogueApprobation({
  demande,
  onFermer,
}: {
  demande: DemandeClient | null;
  onFermer: () => void;
}) {
  const [initialise, setInitialise] = useState<string | null>(null);
  const [representant, setRepresentant] = useState<string | null>(null);
  const [syndicat, setSyndicat] = useState<string | null>(null);
  const [terme, setTerme] = useState('');
  const { brouillon, frapper } = useRechercheDifferee(terme, setTerme);

  if (demande !== null && initialise !== demande.id) {
    setInitialise(demande.id);
    setRepresentant(null);
    setSyndicat(null);
  }

  const referentiels = useQuery({
    queryKey: queryKeys.referentielsRoot,
    queryFn: () => fetchReferentiels(),
    staleTime: REFERENTIELS_STALE_MS,
    enabled: demande !== null,
  });

  const representants = useQuery({
    queryKey: ['representants', 'recherche-banque', terme] as const,
    queryFn: () => chercherRepresentants(terme),
    enabled: demande !== null && terme.trim().length >= 2,
    staleTime: 30_000,
  });

  const suite = useArbitrage(onFermer);
  const approuver = useMutation({
    mutationFn: () => {
      if (demande === null || representant === null || syndicat === null) {
        throw new Error('Champs obligatoires manquants.');
      }
      return approuverDemande(demande.id, { representantId: representant, syndicatId: syndicat });
    },
    onSuccess: (mise) => {
      suite.onSuccess();
      toast.success(`Prospect créé pour ${mise.prenom} ${mise.nom}.`);
    },
    onError: (erreur: unknown) => {
      toastApiError(erreur, 'L’approbation a échoué.');
    },
  });

  return (
    <Dialog
      open={demande !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert && !approuver.isPending) onFermer();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Approuver la création du client ?</DialogTitle>
          <DialogDescription>
            {demande === null
              ? ''
              : `${demande.prenom} ${demande.nom}, ${formatPhone(demande.phoneE164)}. La banque demandeuse devient la provenance de la fiche.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <SearchField
            label="Chercher le représentant de rattachement"
            value={brouillon}
            onChange={frapper}
            placeholder="Nom du représentant"
            className="min-w-0"
          />
          <FilterCombobox
            label="Représentant de rattachement"
            placeholder="Choisir un représentant"
            required
            filtrer={false}
            options={(representants.data ?? []).map((entree) => ({
              value: entree.id,
              label: entree.fullName,
              hint: entree.departementName ?? undefined,
            }))}
            value={representant}
            onChange={setRepresentant}
          />
          <ChampSelect
            label="Syndicat"
            placeholder="Choisir un syndicat"
            obligatoire
            options={enOptions(referentiels.data?.syndicats)}
            valeur={syndicat}
            onChange={setSyndicat}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={approuver.isPending} onClick={onFermer}>
            Annuler
          </Button>
          <Button
            type="button"
            disabled={approuver.isPending || representant === null || syndicat === null}
            onClick={() => {
              approuver.mutate();
            }}
          >
            <Attente enCours={approuver.isPending} libelle="Approuver et créer le prospect" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogueRefus({
  demande,
  onFermer,
}: {
  demande: DemandeClient | null;
  onFermer: () => void;
}) {
  const [motif, setMotif] = useState('');
  const suite = useArbitrage(() => {
    setMotif('');
    onFermer();
  });

  const refuser = useMutation({
    mutationFn: () => {
      if (demande === null) throw new Error('Aucune demande sélectionnée.');
      return refuserDemande(demande.id, motif.trim());
    },
    onSuccess: () => {
      suite.onSuccess();
      toast.success('Demande refusée. Le motif est remonté à la banque.');
    },
    onError: (erreur: unknown) => {
      toastApiError(erreur, 'Le refus a échoué.');
    },
  });

  return (
    <Dialog
      open={demande !== null}
      onOpenChange={(ouvert) => {
        if (!ouvert && !refuser.isPending) onFermer();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Refuser cette demande ?</DialogTitle>
          <DialogDescription>
            Le motif est visible par la banque demandeuse. Aucun prospect n’est créé.
          </DialogDescription>
        </DialogHeader>

        <ChampTexte
          label="Motif du refus"
          obligatoire
          valeur={motif}
          aide="Trois caractères au minimum."
          onChange={setMotif}
        />

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={refuser.isPending} onClick={onFermer}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={refuser.isPending || motif.trim().length < 3}
            onClick={() => {
              refuser.mutate();
            }}
          >
            <Attente enCours={refuser.isPending} libelle="Refuser" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DialoguesArbitrage({
  arbitrage,
  onFermer,
}: {
  arbitrage: Arbitrage | null;
  onFermer: () => void;
}) {
  return (
    <>
      <DialogueApprobation
        demande={arbitrage?.action === 'approuver' ? arbitrage.demande : null}
        onFermer={onFermer}
      />
      <DialogueRefus
        demande={arbitrage?.action === 'refuser' ? arbitrage.demande : null}
        onFermer={onFermer}
      />
    </>
  );
}
