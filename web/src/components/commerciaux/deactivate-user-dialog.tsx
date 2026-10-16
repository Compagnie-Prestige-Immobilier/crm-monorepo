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

function representantsLabel(n: number): string {
  if (n === 0) return '';
  return `, ainsi que ${formatNumber(n)} ${n === 1 ? 'représentant' : 'représentants'}`;
}

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

  useRecalage([user?.id], () => {
    setRepreneur(null);
  });

  // Sans repreneur, le portefeuille reste au compte parti : l'encadrement est
  // averti et le reprend depuis « Portefeuilles orphelins ».
  const portefeuille = user !== null && user.prospectCount + user.representantCount > 0;

  const candidats = repreneurs.filter((row) => row.id !== user?.id && row.isActive);

  return (
    <ConfirmDialog
      open={user !== null}
      onOpenChange={onOpenChange}
      pending={pending}
      onConfirm={() => {
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
            compte{representantsLabel(user.representantCount)}.
          </p>

          {portefeuille ? (
            <Field
              label="Qui reprend le portefeuille (facultatif)"
              description="Ses prospects et ses représentants lui sont transférés. Sans repreneur, ils attendent dans « Portefeuilles orphelins » et les superviseurs sont avertis."
            >
              {(props) => (
                <Select
                  items={candidats.map((row) => ({ value: row.id, label: row.fullName }))}
                  value={repreneur}
                  onValueChange={(value) => {
                    setRepreneur(typeof value === 'string' ? value : null);
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
