'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderOpenIcon, FolderPlusIcon, InboxIcon, UserPlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { PiecesDeposees } from '@/components/bank/bank-pieces';
import { ClientRequestDialog } from '@/components/bank/client-request-dialog';
import { EmptyState } from '@/components/empty-state';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { bankBasePath } from '@/lib/bank-filters';
import { createBankCase, fetchInscriptionsAOuvrir } from '@/lib/data/bank-cases';
import { fetchBanques } from '@/lib/data/reference';
import { formatDateTime, formatPhone, withRetired } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import type { InscriptionAOuvrir, Projet } from '@/lib/types';
import { cn } from '@/lib/utils';

export function nomClient(inscription: InscriptionAOuvrir): string {
  return `${inscription.prenom} ${inscription.nom}`.trim();
}

/** Ce que la plateforme a validé et que la banque n'a pas encore ouvert. */
export function BankAOuvrirView({ projet }: { projet: Projet }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const surbrillance = useSearchParams().get('ouvrir');
  const [aOuvrir, setAOuvrir] = useState<InscriptionAOuvrir | null>(null);
  const [demande, setDemande] = useState(false);
  const [pieces, setPieces] = useState<InscriptionAOuvrir | null>(null);
  const base = bankBasePath(projet);

  const inscriptions = useQuery({
    queryKey: queryKeys.bankAOuvrir(projet),
    queryFn: () => fetchInscriptionsAOuvrir(projet),
  });

  const ouverture = useMutation({
    mutationFn: (input: { inscriptionId: string; processingBankId?: string }) =>
      createBankCase(input),
    onSuccess: (dossier) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bankAOuvrir(projet) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bankCasesRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bankAnalyticsRoot });
      toast.success(`Dossier ${dossier.reference} ouvert.`);
      setAOuvrir(null);
      router.push(`${base}/dossiers/${dossier.id}`);
    },
    onError: (error) => {
      toastApiError(error, 'Le dossier n’a pas pu être ouvert.');
    },
  });

  if (inscriptions.isPending) return <BankAOuvrirSkeleton />;
  if (inscriptions.isError) {
    return (
      <QueryErrorState
        error={inscriptions.error}
        onRetry={() => {
          void inscriptions.refetch();
        }}
        fallback="Les dossiers complets de la plateforme n’ont pas pu être lus."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.375rem] font-[700] tracking-[-0.02em]">
            Dossiers complets sur la plateforme
          </h1>
          <p className="text-[0.875rem] text-muted-foreground">
            Un dossier bancaire s’ouvre uniquement depuis un dossier validé sur la plateforme. La
            référence est générée à l’ouverture.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDemande(true);
            }}
          >
            <UserPlusIcon aria-hidden="true" />
            Demander la création du client
          </Button>
          <Link
            href={`${base}/dossiers`}
            className="text-[0.875rem] underline-offset-4 hover:underline"
          >
            Tous les dossiers
          </Link>
        </div>
      </div>

      {inscriptions.data.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="Aucun dossier complet en attente"
          description="Dès qu’un dossier est validé sur la plateforme, il apparaît ici et la banque reçoit un courriel."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {inscriptions.data.map((inscription) => (
            <CarteInscription
              key={inscription.id}
              inscription={inscription}
              surbrillance={inscription.id === surbrillance}
              onOuvrir={() => {
                if (inscription.banqueId === null) {
                  setAOuvrir(inscription);
                  return;
                }
                ouverture.mutate({ inscriptionId: inscription.id });
              }}
              pending={ouverture.isPending && ouverture.variables?.inscriptionId === inscription.id}
              onLirePieces={() => {
                setPieces(inscription);
              }}
            />
          ))}
        </ul>
      )}

      <ChoixBanqueDialog
        inscription={aOuvrir}
        pending={ouverture.isPending}
        onClose={() => {
          setAOuvrir(null);
        }}
        onConfirm={(processingBankId) => {
          if (aOuvrir === null) return;
          ouverture.mutate({ inscriptionId: aOuvrir.id, processingBankId });
        }}
      />
      <PiecesDialog
        inscription={pieces}
        onClose={() => {
          setPieces(null);
        }}
      />
      <ClientRequestDialog open={demande} onOpenChange={setDemande} initialTerm="" />
    </div>
  );
}

/** Lire les pièces sans quitter la liste : la décision d'ouvrir se prend ici. */
function PiecesDialog({
  inscription,
  onClose,
}: {
  inscription: InscriptionAOuvrir | null;
  onClose: () => void;
}) {
  if (inscription === null) return null;
  return (
    <Dialog
      open={true}
      onOpenChange={(ouvert) => {
        if (!ouvert) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pièces de {nomClient(inscription)}</DialogTitle>
          <DialogDescription>
            Les justificatifs déposés sur la plateforme, avant d’ouvrir le dossier.
          </DialogDescription>
        </DialogHeader>
        <PiecesDeposees inscriptionId={inscription.id} />
      </DialogContent>
    </Dialog>
  );
}

function CarteInscription({
  inscription,
  surbrillance,
  pending,
  onOuvrir,
  onLirePieces,
}: {
  inscription: InscriptionAOuvrir;
  surbrillance: boolean;
  pending: boolean;
  onOuvrir: () => void;
  onLirePieces: () => void;
}) {
  const sansProspect = inscription.prospectId === null;
  return (
    <li>
      <Card
        className={cn(
          'h-full animate-rise',
          surbrillance && 'ring-2 ring-primary motion-safe:animate-badge-pulse',
        )}
      >
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-[600]">{nomClient(inscription)}</p>
              <p className="text-[0.8125rem] text-muted-foreground">
                {inscription.phoneE164 === null
                  ? 'Sans téléphone'
                  : formatPhone(inscription.phoneE164)}
              </p>
            </div>
            <Badge variant={sansProspect ? 'warning' : 'success'}>
              {sansProspect ? 'Prospect inconnu' : 'Validé'}
            </Badge>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-[0.8125rem]">
            <div>
              <dt className="text-muted-foreground">Validé le</dt>
              <dd className="font-[600]">
                {inscription.decideeLe === null
                  ? 'Date inconnue'
                  : formatDateTime(inscription.decideeLe)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Banque</dt>
              <dd className="truncate font-[600]">{inscription.banqueName ?? 'À choisir'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Téléconseiller</dt>
              <dd className="truncate font-[600]">{inscription.suiviParName ?? 'Non suivi'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Plateforme</dt>
              <dd className="truncate font-[600] tabular-nums">{inscription.identifiantDistant}</dd>
            </div>
          </dl>
          {sansProspect ? (
            <p className="text-[0.8125rem] text-muted-foreground">
              Aucun prospect du CRM ne porte ce téléphone ou ce courriel. Créez ou corrigez le
              prospect, le prochain tirage le rapprochera.
            </p>
          ) : null}
          <div className="mt-auto flex flex-wrap gap-2">
            <Button type="button" disabled={sansProspect || pending} onClick={onOuvrir}>
              <FolderPlusIcon aria-hidden="true" />
              Ouvrir le dossier
            </Button>
            <Button type="button" variant="outline" onClick={onLirePieces}>
              <FolderOpenIcon aria-hidden="true" />
              Lire les pièces
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

function ChoixBanqueDialog({
  inscription,
  pending,
  onClose,
  onConfirm,
}: {
  inscription: InscriptionAOuvrir | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (banqueId: string) => void;
}) {
  const champId = useId();
  const [banqueId, setBanqueId] = useState<string | null>(null);
  const banques = useQuery({
    queryKey: [...queryKeys.reference, 'banques'],
    queryFn: () => fetchBanques(),
    enabled: inscription !== null,
  });

  return (
    <Dialog
      open={inscription !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Banque de traitement</DialogTitle>
          <DialogDescription>
            {inscription === null ? '' : nomClient(inscription)} n’a pas de banque renseignée.
            Choisissez celle qui traitera le dossier.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={champId}>Banque</Label>
          <Select
            value={banqueId ?? ''}
            onValueChange={(valeur) => setBanqueId(valeur === '' ? null : valeur)}
          >
            <SelectTrigger id={champId} className="w-full">
              <SelectValue placeholder="Choisir une banque" />
            </SelectTrigger>
            <SelectContent>
              {(banques.data ?? []).map((banque) => (
                <SelectItem key={banque.id} value={banque.id}>
                  {withRetired(banque.shortName, banque.isActive)}, {banque.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            disabled={banqueId === null || pending}
            onClick={() => {
              if (banqueId !== null) onConfirm(banqueId);
            }}
          >
            Ouvrir le dossier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BankAOuvrirSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-12 w-96" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
