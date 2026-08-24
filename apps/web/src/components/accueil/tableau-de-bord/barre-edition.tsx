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
  onEnter,
  onSave,
  onCancel,
  onSetDefault,
}: {
  editing: boolean;
  dirty: boolean;
  pending: boolean;
  isAdmin: boolean;
  onEnter: () => void;
  onSave: () => void;
  onCancel: () => void;
  onSetDefault: () => void;
}) {
  const [confirmAnnuler, setConfirmAnnuler] = useState(false);
  const [confirmDefaut, setConfirmDefaut] = useState(false);

  if (!editing) {
    return (
      <Button type="button" variant="outline" onClick={onEnter}>
        <LayoutGridIcon aria-hidden="true" />
        Organiser
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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
            Faire de cette disposition la disposition par défaut
          </Button>
          <ConfirmDialog
            open={confirmDefaut}
            onOpenChange={setConfirmDefaut}
            title="Fixer la disposition par défaut"
            description="Les comptes qui n’ont pas composé la leur verront celle-ci."
            confirmLabel="Fixer par défaut"
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
        Annuler
      </Button>
      <ConfirmDialog
        open={confirmAnnuler}
        onOpenChange={setConfirmAnnuler}
        title="Annuler les changements"
        description="Les modifications faites depuis l’ouverture du mode Organiser seront perdues."
        confirmLabel="Annuler les changements"
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
