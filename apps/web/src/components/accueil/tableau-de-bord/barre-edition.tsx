'use client';

import { LayoutGridIcon, LoaderIcon, SaveIcon, ShieldCheckIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function BarreEdition({
  editing,
  dirty,
  pending,
  isAdmin,
  entryLabel = 'Organiser les graphiques',
  entryVariant = 'outline',
  onEnter,
  onSave,
  onCancel,
  onSetDefault,
}: {
  editing: boolean;
  dirty: boolean;
  pending: boolean;
  isAdmin: boolean;
  /** Ce que dit la porte d'entrée du mode organisation, et son poids visuel. */
  entryLabel?: string;
  entryVariant?: 'outline' | 'ghost';
  onEnter: () => void;
  onSave: () => void;
  onCancel: () => void;
  onSetDefault: () => void;
}) {
  const [confirmAnnuler, setConfirmAnnuler] = useState(false);
  const [confirmDefaut, setConfirmDefaut] = useState(false);

  if (!editing) {
    return (
      <Button type="button" variant={entryVariant} onClick={onEnter}>
        <LayoutGridIcon aria-hidden="true" />
        {entryLabel}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-md bg-secondary px-3 py-2 text-[0.8125rem] font-[600] text-foreground">
        Mode organisation
      </span>
      {isAdmin ? (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setConfirmDefaut(true);
            }}
          >
            <ShieldCheckIcon aria-hidden="true" />
            Proposer par défaut
          </Button>
          <ConfirmDialog
            open={confirmDefaut}
            onOpenChange={setConfirmDefaut}
            title="Fixer la disposition par défaut"
            description="Les comptes qui n’ont rien enregistré verront cette organisation."
            confirmLabel="Proposer par défaut"
            onConfirm={() => {
              onSetDefault();
              setConfirmDefaut(false);
            }}
          />
        </>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          if (dirty) {
            setConfirmAnnuler(true);
          } else {
            onCancel();
          }
        }}
      >
        <XIcon aria-hidden="true" />
        Quitter
      </Button>
      <ConfirmDialog
        open={confirmAnnuler}
        onOpenChange={setConfirmAnnuler}
        title="Quitter sans enregistrer"
        description="Les changements faits dans ce mode seront perdus."
        confirmLabel="Quitter sans enregistrer"
        onConfirm={() => {
          setConfirmAnnuler(false);
          onCancel();
        }}
      />

      <Button type="button" disabled={pending} onClick={onSave}>
        {pending ? (
          <LoaderIcon className="animate-spin" aria-hidden="true" />
        ) : (
          <SaveIcon aria-hidden="true" />
        )}
        Enregistrer
      </Button>
    </div>
  );
}
