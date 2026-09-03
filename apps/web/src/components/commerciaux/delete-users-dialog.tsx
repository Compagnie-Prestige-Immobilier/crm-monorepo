'use client';

import { InfoIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Field } from '@/components/forms/field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatNumber } from '@/lib/format';
import type { UserRow } from '@/lib/types';

export function DeleteUsersDialog({
  users,
  repreneurs,
  onOpenChange,
  pending,
  onConfirm,
}: {
  /** Comptes visés. Vide : la boîte est fermée. */
  users: UserRow[];
  repreneurs: UserRow[];
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onConfirm: (handoverToId?: string) => void;
}) {
  const [repreneur, setRepreneur] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | undefined>(undefined);

  const cles = users.map((row) => row.id).join(',');

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- saisie remise à zéro par sélection
    setRepreneur(null);
    setErreur(undefined);
  }, [cles]);

  const prospects = users.reduce((total, row) => total + row.prospectCount, 0);
  const reprisRequise = prospects > 0;

  // Un repreneur pris dans la sélection serait supprimé juste après, et le
  // portefeuille transféré gèlerait avec lui.
  const candidats = repreneurs.filter(
    (row) =>
      row.isActive && row.role === 'COMMERCIAL' && !users.some((cible) => cible.id === row.id),
  );
  const choisi = candidats.find((row) => row.id === repreneur) ?? null;

  const unique = users.length === 1 ? (users[0] ?? null) : null;

  let titre = '';
  if (unique !== null) titre = `Supprimer le compte de ${unique.fullName} ?`;
  else if (users.length > 1) titre = `Supprimer ${formatNumber(users.length)} comptes ?`;

  const rattachement = `${prospects === 1 ? 'prospect est rattaché' : 'prospects sont rattachés'} ${
    unique === null ? 'à ces comptes' : 'à ce compte'
  }.`;

  const avertissement = reprisRequise
    ? `Prospects, représentants et appels à passer sont transférés ${
        choisi === null ? 'au repreneur' : `à ${choisi.fullName}`
      } avant la suppression. Un compte supprimé ne peut plus être réactivé.`
    : 'Aucune fiche n’est rattachée. L’historique déjà écrit reste en place, mais le compte ne peut plus être réactivé.';

  return (
    <ConfirmDialog
      open={users.length > 0}
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
      confirmLabel={unique === null ? 'Supprimer les comptes' : 'Supprimer le compte'}
      title={titre}
      description="La connexion est fermée et le compte disparaît de la liste. Les fiches saisies restent en base."
    >
      {users.length === 0 ? null : (
        <div className="flex flex-col gap-3">
          <p className="rounded-md border border-border bg-secondary px-3 py-2.5 text-[0.875rem]">
            <span className="font-display text-[1.5rem] font-[800] tabular-nums">
              {formatNumber(prospects)}
            </span>{' '}
            {rattachement}
          </p>

          {unique === null ? (
            <ul className="max-h-40 overflow-y-auto rounded-md border border-border px-3 py-2 text-[0.8125rem]">
              {users.map((row) => (
                <li key={row.id} className="truncate">
                  {row.fullName} <span className="text-muted-foreground">@{row.username}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {reprisRequise ? (
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
          ) : null}

          <p className="flex items-start gap-2 rounded-md border border-accent-border/30 bg-accent-surface px-3 py-2.5 text-[0.8125rem]">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden="true" />
            <span>{avertissement}</span>
          </p>
        </div>
      )}
    </ConfirmDialog>
  );
}
