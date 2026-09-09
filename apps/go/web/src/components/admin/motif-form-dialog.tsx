import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Bascule, ChoixListe } from '@/components/admin/statut-form-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  COULEURS_MOTIF,
  creerMotif,
  EFFETS_MOTIF,
  LIBELLES_COULEUR,
  LIBELLES_EFFET_MOTIF,
  modifierMotif,
  type EffetMotif,
  type MotifIssue,
} from '@/lib/data/call-outcome-reasons';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

const OPTIONS_EFFET = EFFETS_MOTIF.map((valeur) => ({
  value: valeur,
  label: LIBELLES_EFFET_MOTIF[valeur],
}));

const OPTIONS_COULEUR = COULEURS_MOTIF.map((valeur) => ({
  value: valeur,
  label: LIBELLES_COULEUR[valeur],
}));

interface Brouillon {
  code: string;
  label: string;
  effect: EffetMotif;
  color: string;
  countsAsReached: boolean;
  requiresComment: boolean;
  requiresCallback: boolean;
}

const BROUILLON_VIDE: Brouillon = {
  code: '',
  label: '',
  effect: 'KEEP_OPEN',
  color: 'neutral',
  countsAsReached: false,
  requiresComment: false,
  requiresCallback: false,
};

function brouillonDe(motif: MotifIssue | null): Brouillon {
  if (motif === null) return BROUILLON_VIDE;
  return {
    code: motif.code,
    label: motif.label,
    effect: motif.effect,
    color: motif.color ?? 'neutral',
    countsAsReached: motif.countsAsReached,
    requiresComment: motif.requiresComment,
    requiresCallback: motif.requiresCallback,
  };
}

function ChampsMotif({
  creation,
  brouillon,
  onChange,
}: {
  creation: boolean;
  brouillon: Brouillon;
  onChange: (patch: Partial<Brouillon>) => void;
}) {
  return (
    <>
      {creation ? (
        <Field label="Code" required description="Identifiant stable, jamais réutilisé.">
          {(props) => (
            <Input
              {...props}
              required
              autoCapitalize="none"
              spellCheck={false}
              value={brouillon.code}
              onChange={(event) => {
                onChange({ code: event.target.value });
              }}
            />
          )}
        </Field>
      ) : null}

      <Field label="Libellé" required>
        {(props) => (
          <Input
            {...props}
            required
            value={brouillon.label}
            onChange={(event) => {
              onChange({ label: event.target.value });
            }}
          />
        )}
      </Field>

      {creation ? (
        <ChoixListe
          label="Effet sur le prospect"
          valeur={brouillon.effect}
          options={OPTIONS_EFFET}
          onChange={(valeur) => {
            onChange({ effect: valeur as EffetMotif });
          }}
        />
      ) : null}

      <ChoixListe
        label="Couleur"
        valeur={brouillon.color}
        options={OPTIONS_COULEUR}
        onChange={(color) => {
          onChange({ color });
        }}
      />

      <Bascule
        label="Compte comme un contact joint"
        checked={brouillon.countsAsReached}
        onChange={(countsAsReached) => {
          onChange({ countsAsReached });
        }}
      />
      <Bascule
        label="Exige un commentaire"
        checked={brouillon.requiresComment}
        onChange={(requiresComment) => {
          onChange({ requiresComment });
        }}
      />
      <Bascule
        label="Exige une date de rappel"
        checked={brouillon.requiresCallback}
        onChange={(requiresCallback) => {
          onChange({ requiresCallback });
        }}
      />
    </>
  );
}

export function MotifFormDialog({
  motif,
  open,
  onOpenChange,
}: {
  motif: MotifIssue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [brouillon, setBrouillon] = useState<Brouillon>(() => brouillonDe(motif));

  const poser = (patch: Partial<Brouillon>): void => {
    setBrouillon((courant) => ({ ...courant, ...patch }));
  };

  const enregistrer = useMutation({
    mutationFn: () => {
      const commun = {
        label: brouillon.label.trim(),
        color: brouillon.color,
        countsAsReached: brouillon.countsAsReached,
        requiresComment: brouillon.requiresComment,
        requiresCallback: brouillon.requiresCallback,
      };
      return motif === null
        ? creerMotif({ ...commun, code: brouillon.code.trim(), effect: brouillon.effect })
        : modifierMotif(motif.id, commun);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
      toast.success('Motif enregistré.');
      onOpenChange(false);
    },
    onError: (erreur) => {
      toastApiError(erreur, 'Le motif n’a pas pu être enregistré.');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{motif === null ? 'Nouveau motif' : 'Modifier le motif'}</DialogTitle>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            enregistrer.mutate();
          }}
        >
          <ChampsMotif creation={motif === null} brouillon={brouillon} onChange={poser} />

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
            <Button type="submit" disabled={enregistrer.isPending}>
              {enregistrer.isPending ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
