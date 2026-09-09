import { LayoutGridIcon, LoaderIcon, SaveIcon, ShieldCheckIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function BarreEdition({
  edition,
  modifie,
  enCours,
  estAdmin,
  libelleEntree = 'Organiser les graphiques',
  onEntrer,
  onEnregistrer,
  onQuitter,
  onParDefaut,
}: {
  edition: boolean;
  modifie: boolean;
  enCours: boolean;
  estAdmin: boolean;
  libelleEntree?: string;
  onEntrer: () => void;
  onEnregistrer: () => void;
  onQuitter: () => void;
  onParDefaut: () => void;
}) {
  const [confirmerSortie, setConfirmerSortie] = useState(false);
  const [confirmerDefaut, setConfirmerDefaut] = useState(false);

  if (!edition) {
    return (
      <Button type="button" variant="outline" onClick={onEntrer}>
        <LayoutGridIcon aria-hidden="true" />
        {libelleEntree}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-md bg-secondary px-3 py-2 text-[0.8125rem] font-[600] text-foreground">
        Mode organisation
      </span>

      {estAdmin ? (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setConfirmerDefaut(true);
            }}
          >
            <ShieldCheckIcon aria-hidden="true" />
            Proposer par défaut
          </Button>
          <ConfirmDialog
            open={confirmerDefaut}
            onOpenChange={setConfirmerDefaut}
            title="Fixer la disposition par défaut"
            description="Les comptes qui n’ont rien enregistré verront cette organisation."
            confirmLabel="Proposer par défaut"
            confirmVariant="default"
            onConfirm={() => {
              onParDefaut();
              setConfirmerDefaut(false);
            }}
          />
        </>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          if (modifie) {
            setConfirmerSortie(true);
            return;
          }
          onQuitter();
        }}
      >
        <XIcon aria-hidden="true" />
        Quitter
      </Button>
      <ConfirmDialog
        open={confirmerSortie}
        onOpenChange={setConfirmerSortie}
        title="Quitter sans enregistrer"
        description="Les changements faits dans ce mode seront perdus."
        confirmLabel="Quitter sans enregistrer"
        onConfirm={() => {
          setConfirmerSortie(false);
          onQuitter();
        }}
      />

      <Button type="button" disabled={enCours} onClick={onEnregistrer}>
        {enCours ? (
          <LoaderIcon className="animate-spin" aria-hidden="true" />
        ) : (
          <SaveIcon aria-hidden="true" />
        )}
        Enregistrer
      </Button>
    </div>
  );
}
