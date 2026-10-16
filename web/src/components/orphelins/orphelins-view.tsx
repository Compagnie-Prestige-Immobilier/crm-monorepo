'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  fetchPortefeuillesOrphelins,
  type PortefeuilleOrphelin,
  reprendrePortefeuille,
} from '@/lib/data/orphelins';
import { fetchUsers } from '@/lib/data/users';
import { formatDate, formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { useRecalage } from '@/lib/use-recalage';
import { EMPTY_USER_FILTERS, type UserFilters } from '@/lib/user-filters';

/** Repreneurs possibles : l'API n'accepte qu'un téléconseiller actif. */
const REPRENEURS: UserFilters = {
  ...EMPTY_USER_FILTERS,
  role: 'COMMERCIAL',
  isActive: true,
  pageSize: 200,
};

export function OrphelinsView() {
  const [cible, setCible] = useState<PortefeuilleOrphelin | null>(null);
  const liste = useQuery({
    queryKey: queryKeys.portefeuillesOrphelins,
    queryFn: () => fetchPortefeuillesOrphelins(),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-h2 font-[700] tracking-[-0.02em]">
          Portefeuilles orphelins
        </h1>
        <p className="text-body text-muted-foreground">
          Comptes désactivés sans repreneur. Leurs fiches n’apparaissent dans aucune console tant
          qu’un téléconseiller ne les a pas reprises.
        </p>
      </div>
      <ListeOrphelins
        pending={liste.isPending}
        erreur={liste.isError}
        lignes={liste.data ?? []}
        onReprendre={setCible}
      />
      <RepriseDialog
        cible={cible}
        onOpenChange={(open) => {
          if (!open) setCible(null);
        }}
      />
    </div>
  );
}

function ListeOrphelins({
  pending,
  erreur,
  lignes,
  onReprendre,
}: {
  pending: boolean;
  erreur: boolean;
  lignes: PortefeuilleOrphelin[];
  onReprendre: (ligne: PortefeuilleOrphelin) => void;
}) {
  if (pending) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (erreur) {
    return <p className="text-body text-destructive">La liste n’a pas pu être chargée.</p>;
  }
  if (lignes.length === 0) {
    return (
      <p className="rounded-md border border-border px-4 py-6 text-body text-muted-foreground">
        Aucun portefeuille en attente : toutes les fiches ont un téléconseiller actif.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Compte</TableHead>
          <TableHead>Depuis le</TableHead>
          <TableHead className="text-right">Prospects</TableHead>
          <TableHead className="text-right">Représentants</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((ligne) => (
          <TableRow key={ligne.id}>
            <TableCell className="font-medium">
              {ligne.fullName}
              {ligne.supprime ? (
                <span className="ml-2 text-[0.75rem] text-muted-foreground">supprimé</span>
              ) : null}
            </TableCell>
            <TableCell>{formatDate(ligne.depuisLe)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(ligne.prospects)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(ligne.representants)}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {ligne.prospects > 0 ? (
                  <Link
                    href={`/teleconseil/prospects?commercialId=${encodeURIComponent(ligne.id)}`}
                    className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                  >
                    Voir les fiches
                  </Link>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onReprendre(ligne);
                  }}
                >
                  Réaffecter
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RepriseDialog({
  cible,
  onOpenChange,
}: {
  cible: PortefeuilleOrphelin | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [repreneur, setRepreneur] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | undefined>(undefined);

  useRecalage([cible?.id], () => {
    setRepreneur(null);
    setErreur(undefined);
  });

  const repreneurs = useQuery({
    queryKey: queryKeys.commerciaux(REPRENEURS),
    queryFn: () => fetchUsers(REPRENEURS),
    staleTime: 300_000,
    enabled: cible !== null,
    select: (page) => page.items,
  });

  const reprise = useMutation({
    mutationFn: ({ id, vers }: { id: string; vers: string }) => reprendrePortefeuille(id, vers),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.portefeuillesOrphelins });
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.representantsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.commerciauxRoot });
      toast.success('Portefeuille réaffecté.');
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'La réaffectation a échoué.');
    },
  });

  const candidats = repreneurs.data ?? [];

  return (
    <ConfirmDialog
      open={cible !== null}
      onOpenChange={onOpenChange}
      pending={reprise.isPending}
      onConfirm={() => {
        if (cible === null) return;
        if (repreneur === null) {
          setErreur('Choisissez le téléconseiller qui reprend le portefeuille.');
          return;
        }
        reprise.mutate({ id: cible.id, vers: repreneur });
      }}
      confirmLabel="Réaffecter"
      title={cible === null ? '' : `Réaffecter le portefeuille de ${cible.fullName}`}
      description={
        cible === null
          ? ''
          : `${formatNumber(cible.prospects)} prospect(s) et ${formatNumber(cible.representants)} représentant(s) passent au téléconseiller choisi.`
      }
    >
      <Field label="Qui reprend le portefeuille" required error={erreur}>
        {(props) => (
          <Select
            items={candidats.map((row) => ({ value: row.id, label: row.fullName }))}
            value={repreneur}
            onValueChange={(value) => {
              setRepreneur(typeof value === 'string' ? value : null);
              setErreur(undefined);
            }}
          >
            <SelectTrigger {...props}>
              <SelectValue placeholder="Choisir un téléconseiller" />
            </SelectTrigger>
            <SelectContent>
              {candidats.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
    </ConfirmDialog>
  );
}
