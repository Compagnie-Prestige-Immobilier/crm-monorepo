import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2Icon, SendIcon } from 'lucide-react';
import { useId, useState } from 'react';

import { Attente, ChampSelect, ChampTexte } from '@/components/banque/champs';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deposerDemande } from '@/lib/data/client-requests';
import { enOptions, fetchReferentiels, REFERENTIELS_STALE_MS } from '@/lib/data/referentiels';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

/** Le terme cherché est réutilisé tel quel : le redemander serait une double saisie. */
function depuisRecherche(terme: string): { phone: string; nom: string; prenom: string } {
  const propre = terme.trim();
  const chiffres = propre.replace(/\D/gu, '');
  if (chiffres.length >= 6 && chiffres.length >= propre.length / 2) {
    return { phone: propre, nom: '', prenom: '' };
  }
  const mots = propre.split(/\s+/u).filter((mot) => mot !== '');
  return { phone: '', prenom: mots[0] ?? '', nom: mots.slice(1).join(' ') };
}

function ChampLigne({
  label,
  valeur,
  taille,
  gabarit,
  mode,
  aide,
  onChange,
}: {
  label: string;
  valeur: string;
  taille: number;
  gabarit?: string | undefined;
  mode?: 'tel' | undefined;
  aide?: string | undefined;
  onChange: (valeur: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        <ChampObligatoire />
      </Label>
      <Input
        id={id}
        value={valeur}
        maxLength={taille}
        autoComplete="off"
        inputMode={mode}
        placeholder={gabarit}
        aria-describedby={aide === undefined ? undefined : `${id}-aide`}
        onChange={(evenement) => {
          onChange(evenement.target.value);
        }}
      />
      {aide === undefined ? null : (
        <p id={`${id}-aide`} className="text-[0.75rem] text-muted-foreground">
          {aide}
        </p>
      )}
    </div>
  );
}

interface SaisieDemande {
  nom: string;
  prenom: string;
  telephone: string;
  banque: string | null;
  note: string;
}

function demandeComplete(saisie: SaisieDemande): boolean {
  return (
    saisie.nom.trim().length >= 2 &&
    saisie.prenom.trim().length >= 2 &&
    saisie.telephone.trim().length >= 6 &&
    saisie.banque !== null
  );
}

function corpsDemande(saisie: SaisieDemande): Parameters<typeof deposerDemande>[0] {
  if (saisie.banque === null) throw new Error('Aucune banque choisie.');
  return {
    nom: saisie.nom.trim(),
    prenom: saisie.prenom.trim(),
    phone: saisie.telephone.trim(),
    banqueId: saisie.banque,
    ...(saisie.note.trim() === '' ? {} : { note: saisie.note.trim() }),
  };
}

function Confirmation({ prenom, nom }: { prenom: string; nom: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-border bg-secondary p-4"
    >
      <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
      <p className="min-w-0 text-[0.875rem]">
        <span className="font-[600]">
          {prenom.trim()} {nom.trim()} est en attente d’approbation.
        </span>
        <span className="mt-1 block text-muted-foreground">
          Une notification vous parviendra dès que le siège aura tranché.
        </span>
      </p>
    </div>
  );
}

function PiedDemande({
  envoyee,
  envoyable,
  enCours,
  onFermer,
  onEnvoyer,
}: {
  envoyee: boolean;
  envoyable: boolean;
  enCours: boolean;
  onFermer: () => void;
  onEnvoyer: () => void;
}) {
  if (envoyee) {
    return (
      <Button type="button" onClick={onFermer}>
        Fermer
      </Button>
    );
  }
  return (
    <>
      <Button type="button" variant="ghost" disabled={enCours} onClick={onFermer}>
        Annuler
      </Button>
      <Button type="button" disabled={!envoyable || enCours} onClick={onEnvoyer}>
        {enCours ? null : <SendIcon aria-hidden="true" />}
        <Attente enCours={enCours} libelle="Envoyer la demande" />
      </Button>
    </>
  );
}

export function DialogueDemandeClient({
  ouvert,
  onOuvert,
  termeInitial,
}: {
  ouvert: boolean;
  onOuvert: (ouvert: boolean) => void;
  termeInitial: string;
}) {
  const queryClient = useQueryClient();
  const [initialise, setInitialise] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [banque, setBanque] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [envoyee, setEnvoyee] = useState(false);

  if (ouvert && initialise !== termeInitial) {
    const champs = depuisRecherche(termeInitial);
    setInitialise(termeInitial);
    setEnvoyee(false);
    setTelephone(champs.phone);
    setNom(champs.nom);
    setPrenom(champs.prenom);
  }

  const referentiels = useQuery({
    queryKey: queryKeys.referentielsRoot,
    queryFn: () => fetchReferentiels(),
    staleTime: REFERENTIELS_STALE_MS,
    enabled: ouvert,
  });

  const saisie: SaisieDemande = { nom, prenom, telephone, banque, note };

  const envoyer = useMutation({
    mutationFn: () => deposerDemande(corpsDemande(saisie)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clientRequestsRoot });
      setEnvoyee(true);
    },
    onError: (erreur: unknown) => {
      toastApiError(erreur, 'La demande n’a pas pu être envoyée.');
    },
  });

  return (
    <Dialog
      open={ouvert}
      onOpenChange={(suivant) => {
        if (!suivant && envoyer.isPending) return;
        if (!suivant) setInitialise(null);
        onOuvert(suivant);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {envoyee ? 'Demande envoyée' : 'Demander la création du client'}
          </DialogTitle>
          <DialogDescription>
            {envoyee
              ? 'Un administrateur doit l’approuver avant que le dossier puisse être ouvert.'
              : 'Le client sera créé par le siège, puis rattachable à votre dossier.'}
          </DialogDescription>
        </DialogHeader>

        {envoyee ? (
          <Confirmation prenom={prenom} nom={nom} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <ChampLigne label="Prénom" valeur={prenom} taille={120} onChange={setPrenom} />
              <ChampLigne label="Nom" valeur={nom} taille={120} onChange={setNom} />
            </div>
            <ChampLigne
              label="Téléphone"
              valeur={telephone}
              taille={40}
              mode="tel"
              gabarit="77 123 45 67"
              aide="Le numéro sert de clé : il est comparé à la base avant toute création."
              onChange={setTelephone}
            />
            <ChampSelect
              label="Banque demandeuse"
              placeholder="Choisir une banque"
              obligatoire
              aide="Elle devient la provenance du prospect créé."
              options={enOptions(referentiels.data?.banques)}
              valeur={banque}
              onChange={setBanque}
            />
            <ChampTexte label="Contexte pour l’administrateur" valeur={note} onChange={setNote} />
          </div>
        )}

        <DialogFooter>
          <PiedDemande
            envoyee={envoyee}
            envoyable={demandeComplete(saisie)}
            enCours={envoyer.isPending}
            onFermer={() => {
              onOuvert(false);
            }}
            onEnvoyer={() => {
              envoyer.mutate();
            }}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
