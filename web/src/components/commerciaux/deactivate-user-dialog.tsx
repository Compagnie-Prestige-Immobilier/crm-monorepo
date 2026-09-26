'use client';

import { useState } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/forms/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatNumber } from '@/lib/format';
import type { UserRow } from '@/lib/types';
import { useRecalage } from '@/lib/use-recalage';

export function DeactivateUserDialog({
  user,
  repreneurs,
  onOpenChange,
  pending,
  onConfirm,
}: {
  user: UserRow | null;
  /** Commerciaux actifs, hors le compte désactivé. */
  repreneurs: UserRow[];
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onConfirm: (handoverToId?: string) => void;
}) {
  const [repreneur, setRepreneur] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | undefined>(undefined);

  useRecalage([user?.id], () => {
    setRepreneur(null);
    setErreur(undefined);
  });

  // Le portefeuille GÈLE sans repreneur : `createdById` reste sur le compte
  // parti, et plus aucun téléconseiller actif ne peut lire ni corriger ces fiches.
  const reprisRequise = user !== null && user.prospectCount > 0;

  const candidats = repreneurs.filter((row) => row.id !== user?.id && row.isActive);

  return (
    <ConfirmDialog
      open={user !== null}
      onOpenChange={onOpenChange}
      pending={pending}
      onConfirm={() => {
        if (reprisRequise && repreneur === null) {
          setErreur('Désignez le téléconseiller qui reprend le portefeuille.');
          return;
        }
        setErreur(undefined);
        onConfirm(repreneur ?? undefined);
      }}
      confirmLabel="Désactiver le compte"
      title={user === null ? '' : `Désactiver le compte de ${user.fullName} ?`}
      description="Sa connexion est fermée tout de suite. Le compte se réactive à tout moment."
    >
      {user === null ? null : (
        <div className="flex flex-col gap-3">
          <p className="rounded-md border border-border bg-secondary px-3 py-2.5 text-[0.875rem]">
            <span className="font-display text-[1.5rem] font-[800] tabular-nums">
              {formatNumber(user.prospectCount)}
            </span>{' '}
            {user.prospectCount === 1 ? 'prospect est rattaché' : 'prospects sont rattachés'} à ce
            compte.
          </p>

          {reprisRequise ? (
            <Field
              label="Qui reprend le portefeuille"
              required
              description="Ses prospects, ses représentants et ses appels à passer lui sont transférés."
              error={erreur}
            >
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
          ) : null}
        </div>
      )}
    </ConfirmDialog>
  );
}
