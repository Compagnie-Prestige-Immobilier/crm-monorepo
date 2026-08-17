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
import { RETIRED_SUFFIX } from '@/lib/types';

export function DeactivateReferentielDialog({
  open,
  onOpenChange,
  label,
  kind,
  usageCount,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  kind: 'banque' | 'syndicat' | 'département';
  usageCount: number;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Désactiver « {label} » ?</DialogTitle>
          <DialogDescription>
            Retirée des listes de saisie. Reste disponible en filtre et en export.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="rounded-md border border-border bg-secondary px-3 py-2.5 text-[0.875rem]">
            <span className="font-display text-[1.5rem] font-[800] tabular-nums">
              {formatNumber(usageCount)}
            </span>{' '}
            {usageCount === 1 ? 'prospect référence' : 'prospects référencent'}{' '}
            {kind === 'département' ? 'ce' : 'cette'} {kind}.
          </p>

          <p className="flex items-start gap-2 rounded-md border border-accent-border/30 bg-accent-surface px-3 py-2.5 text-[0.8125rem]">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden="true" />
            <span>
              <strong>Aucun prospect n’est supprimé.</strong> Les fiches existantes conservent cette
              valeur et l’affichent suivie de «&nbsp;{RETIRED_SUFFIX}&nbsp;».
            </span>
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Annuler
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            Désactiver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
