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

/**
 * « Demander la création du client », depuis l'impasse de la recherche.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Ce dialogue remplace un cul-de-sac, et c'est tout son objet.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'écran d'ouverture de dossier affichait « Aucun client ne correspond. » et
 * s'arrêtait là. Le rôle BANQUE_FINANCE n'a aucune route de création de
 * prospect, et rien ne remontait au siège : le dossier ne se faisait pas, ou se
 * faisait sur un homonyme, ce qui se découvre à l'encaissement.
 *
 * PRÉ-REMPLI depuis la recherche saisie : l'agent vient de taper le nom ou le
 * numéro, le lui redemander serait une double saisie et une occasion de
 * divergence entre ce qu'il a cherché et ce qu'il demande.
 *
 * Le téléphone part en SAISIE LIBRE. Le serveur le normalise en E.164 et
 * refuse la demande si le client existe déjà sous une autre présentation du
 * même numéro : c'est le seul endroit où cette comparaison peut être juste.
 */
export function ClientRequestDialog({
  open,
  onOpenChange,
  initialTerm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ce que l'agent avait tapé dans la recherche : un nom, ou un téléphone. */
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

  /**
   * Répartition de la recherche entre les champs, à chaque ouverture.
   *
   * Un terme majoritairement chiffré est un TÉLÉPHONE, sinon c'est un nom : la
   * recherche accepte les deux, et poser « 77 123 45 67 » dans le champ « Nom »
   * obligerait l'agent à tout recouper. La règle est délibérément grossière -
   * elle ne fait que pré-remplir, et tout reste modifiable.
   */
  useEffect(() => {
    if (!open) return;
    setSent(false);
    const term = initialTerm.trim();
    const digits = term.replace(/\D/gu, '');
    const looksLikePhone = digits.length >= 6 && digits.length >= term.length / 2;

    if (looksLikePhone) {
      setPhone(term);
      setNom('');
      setPrenom('');
      return;
    }

    setPhone('');
    const parts = term.split(/\s+/u).filter((part) => part !== '');
    // Premier mot en prénom, le reste en nom : c'est l'ordre de saisie courant
    // dans le produit (« Aminata Diallo »).
    setPrenom(parts[0] ?? '');
    setNom(parts.slice(1).join(' '));
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
      // Pas de fermeture automatique : l'agent doit LIRE que sa demande attend
      // une approbation, sinon il recommencerait la même dans la minute.
      setSent(true);
    },
    onError: (error) => {
      toastApiError(error, 'La demande n’a pas pu être envoyée.');
    },
  });

  const canSubmit =
    nom.trim().length >= 2 &&
    prenom.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    banque !== null &&
    !create.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && create.isPending) return;
        onOpenChange(next);
      }}
    >
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
          <div
            role="status"
            className="flex items-start gap-3 rounded-md border border-border bg-secondary p-4"
          >
            <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
            <div className="min-w-0 text-[0.875rem]">
              <p className="font-[600]">
                {prenom.trim()} {nom.trim()} est en attente d’approbation.
              </p>
              <p className="mt-1 text-muted-foreground">
                Vous recevrez une notification dès que le siège aura tranché. Inutile de renvoyer la
                demande : elle est déjà enregistrée.
              </p>
            </div>
          </div>
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
              <Select value={banque ?? ''} onValueChange={setBanque}>
                <SelectTrigger id={banqueId} className="w-full">
                  <SelectValue placeholder="Choisir une banque" />
                </SelectTrigger>
                <SelectContent>
                  {(banques.data ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {withRetired(item.shortName, item.isActive)}, {item.name}
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
          {sent ? (
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Fermer
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={create.isPending}
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Annuler
              </Button>
              <Button
                type="button"
                disabled={!canSubmit}
                onClick={() => {
                  create.mutate();
                }}
              >
                {create.isPending ? (
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
