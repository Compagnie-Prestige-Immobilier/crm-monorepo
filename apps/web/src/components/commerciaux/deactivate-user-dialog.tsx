'use client';

import { InfoIcon, LoaderIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatNumber } from '@/lib/format';
import type { UserRow } from '@/lib/types';

export function DeactivateUserDialog({
  user,
  onOpenChange,
  pending,
  onConfirm,
}: {
  user: UserRow | null;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open && pending) return;
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {user === null ? null : (
          <>
            <DialogHeader>
              <DialogTitle>Désactiver le compte de {user.fullName} ?</DialogTitle>
              <DialogDescription>
                Sa connexion à l’application mobile est fermée immédiatement. Aucune saisie n’est
                supprimée.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <p className="rounded-md border border-border bg-secondary px-3 py-2.5 text-[0.875rem]">
                <span className="font-display text-[1.5rem] font-[800] tabular-nums">
                  {formatNumber(user.prospectCount)}
                </span>{' '}
                {user.prospectCount === 1 ? 'prospect est rattaché' : 'prospects sont rattachés'} à
                ce compte.
              </p>

              <p className="flex items-start gap-2 rounded-md border border-accent-border/30 bg-accent-surface px-3 py-2.5 text-[0.8125rem]">
                <InfoIcon className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden="true" />
                <span>
                  <strong>Rien n’est supprimé.</strong> Ses prospects, ses représentants et son
                  historique restent en place, et le compte peut être réactivé à tout moment. En
                  revanche, une tournée en cours s’arrête net&nbsp;: les appels qui lui restaient à
                  passer disparaissent de son téléphone.
                </span>
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Annuler
              </Button>
              <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
                {pending ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
                Désactiver le compte
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
