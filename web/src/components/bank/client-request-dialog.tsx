'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2Icon, LoaderIcon, SendIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createClientRequest } from '@/lib/data/client-requests';
import { fetchBanques } from '@/lib/data/reference';
import { withRetired } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

function canSubmitClientRequest(fields: {
  nom: string;
  prenom: string;
  phone: string;
  banque: string | null;
  pending: boolean;
}): boolean {
  return (
    fields.nom.trim().length >= 2 &&
    fields.prenom.trim().length >= 2 &&
    fields.phone.trim().length >= 6 &&
    fields.banque !== null &&
    !fields.pending
  );
}

function splitInitialTerm(term: string): { phone: string; nom: string; prenom: string } {
  const trimmed = term.trim();
  const digits = trimmed.replace(/\D/gu, '');
  const looksLikePhone = digits.length >= 6 && digits.length >= trimmed.length / 2;

  if (looksLikePhone) {
    return { phone: trimmed, nom: '', prenom: '' };
  }

  const parts = trimmed.split(/\s+/u).filter((part) => part !== '');
  return { phone: '', prenom: parts[0] ?? '', nom: parts.slice(1).join(' ') };
}

function ClientRequestSuccess({ prenom, nom }: { prenom: string; nom: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-border bg-secondary p-4"
    >
      <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
      <div className="min-w-0 text-[0.875rem]">
        <p className="font-[600]">
          {prenom} {nom} est en attente d’approbation.
        </p>
        <p className="mt-1 text-muted-foreground">
          Vous recevrez une notification dès que le siège aura tranché.
        </p>
      </div>
    </div>
  );
}

function ClientRequestFooter({
  sent,
  canSubmit,
  isPending,
  onClose,
  onSubmit,
}: {
  sent: boolean;
  canSubmit: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (sent) {
    return (
      <Button type="button" onClick={onClose}>
        Fermer
      </Button>
    );
  }

  return (
    <>
      <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
        Annuler
      </Button>
      <Button type="button" disabled={!canSubmit} onClick={onSubmit}>
        {isPending ? (
          <>
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            Envoi…
          </>
        ) : (
          <>
            <SendIcon aria-hidden="true" />
            Envoyer la demande
          </>
        )}
      </Button>
    </>
  );
}

export function ClientRequestDialog({
  open,
  onOpenChange,
  initialTerm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTerm: string;
}) {
  const nomId = useId();
  const prenomId = useId();
  const phoneId = useId();
  const banqueId = useId();
  const noteId = useId();

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [phone, setPhone] = useState('');
  const [banque, setBanque] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const banques = useQuery({
    queryKey: queryKeys.banques,
    queryFn: () => fetchBanques(),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    // oxlint-disable-next-line react/set-state-in-effect -- formulaire recalé à l'ouverture
    setSent(false);
    const fields = splitInitialTerm(initialTerm);
    setPhone(fields.phone);
    setNom(fields.nom);
    setPrenom(fields.prenom);
  }, [open, initialTerm]);

  const create = useMutation({
    mutationFn: () => {
      if (banque === null) throw new Error('Aucune banque choisie.');
      const body: Parameters<typeof createClientRequest>[0] = {
        nom: nom.trim(),
        prenom: prenom.trim(),
        phone: phone.trim(),
        banqueId: banque,
      };
      const trimmedNote = note.trim();
      if (trimmedNote !== '') body.note = trimmedNote;
      return createClientRequest(body);
    },
    onSuccess: () => {
      setSent(true);
    },
    onError: (error) => {
      toastApiError(error, 'La demande n’a pas pu être envoyée.');
    },
  });

  const canSubmit = canSubmitClientRequest({
    nom,
    prenom,
    phone,
    banque,
    pending: create.isPending,
  });

  function handleOpenChange(next: boolean): void {
    if (!next && create.isPending) return;
    onOpenChange(next);
  }

  function close(): void {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{sent ? 'Demande envoyée' : 'Demander la création du client'}</DialogTitle>
          <DialogDescription>
            {sent
              ? 'Un administrateur doit l’approuver avant que le dossier puisse être ouvert.'
              : 'Le client sera créé par le siège, puis rattachable à votre dossier.'}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <ClientRequestSuccess prenom={prenom.trim()} nom={nom.trim()} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={prenomId}>
                  Prénom
                  <span className="text-destructive" aria-label="obligatoire">
                    *
                  </span>
                </Label>
                <Input
                  id={prenomId}
                  value={prenom}
                  maxLength={120}
                  autoComplete="off"
                  onChange={(event) => {
                    setPrenom(event.target.value);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={nomId}>
                  Nom
                  <span className="text-destructive" aria-label="obligatoire">
                    *
                  </span>
                </Label>
                <Input
                  id={nomId}
                  value={nom}
                  maxLength={120}
                  autoComplete="off"
                  onChange={(event) => {
                    setNom(event.target.value);
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={phoneId}>
                Téléphone
                <span className="text-destructive" aria-label="obligatoire">
                  *
                </span>
              </Label>
              <Input
                id={phoneId}
                value={phone}
                maxLength={40}
                inputMode="tel"
                autoComplete="off"
                placeholder="77 123 45 67"
                aria-describedby={`${phoneId}-aide`}
                onChange={(event) => {
                  setPhone(event.target.value);
                }}
              />
              <p id={`${phoneId}-aide`} className="text-[0.75rem] text-muted-foreground">
                Le numéro sert de clé : il est comparé à la base avant toute création.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={banqueId}>
                Banque demandeuse
                <span className="text-destructive" aria-label="obligatoire">
                  *
                </span>
              </Label>
              {/* `items` : `Select.Value` de Base UI affiche la VALEUR choisie,
                  pas le texte de l'item — ici, l'identifiant de la banque. */}
              <Select
                items={(banques.data ?? []).map((item) => ({
                  value: item.id,
                  label: `${withRetired(item.shortName ?? '', item.isActive ?? false)}, ${item.name}`,
                }))}
                value={banque ?? ''}
                onValueChange={(value) => {
                  if (value === null) return;
                  setBanque(value);
                }}
              >
                <SelectTrigger id={banqueId} className="w-full">
                  <SelectValue placeholder="Choisir une banque" />
                </SelectTrigger>
                <SelectContent>
                  {(banques.data ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {withRetired(item.shortName ?? '', item.isActive ?? false)}, {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[0.75rem] text-muted-foreground">
                Elle devient la provenance du prospect créé.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={noteId}>Contexte pour l’administrateur</Label>
              <Textarea
                id={noteId}
                value={note}
                rows={3}
                maxLength={2000}
                placeholder="Référence du dossier, agence, urgence…"
                onChange={(event) => {
                  setNote(event.target.value);
                }}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <ClientRequestFooter
            sent={sent}
            canSubmit={canSubmit}
            isPending={create.isPending}
            onClose={close}
            onSubmit={() => {
              create.mutate();
            }}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
