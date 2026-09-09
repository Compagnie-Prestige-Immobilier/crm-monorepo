import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  creerStatut,
  EFFETS_STATUT,
  LIBELLES_EFFET_STATUT,
  LIBELLES_PRIORITE,
  LIBELLES_RELATION,
  modifierStatut,
  PRIORITES_STATUT,
  REESSAIS_STATUT,
  type EffetStatut,
  type PrioriteStatut,
  type RelationStatut,
  type StatutQualification,
} from '@/lib/data/statuts-qualification';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

interface Brouillon {
  label: string;
  effect: EffetStatut;
  priorite: PrioriteStatut;
  relationStatus: RelationStatut;
  requiresComment: boolean;
  requiresCallback: boolean;
  reessai: string;
}

const RELATIONS: readonly RelationStatut[] = ['INCONNU', 'CONTACTE', 'AMBASSADEUR', 'REFUS'];

const BROUILLON_VIDE: Brouillon = {
  label: '',
  effect: 'REACHED',
  priorite: 'NORMALE',
  relationStatus: 'INCONNU',
  requiresComment: false,
  requiresCallback: false,
  reessai: '0',
};

function brouillonDe(statut: StatutQualification | null): Brouillon {
  if (statut === null) return BROUILLON_VIDE;
  return {
    label: statut.label,
    effect: statut.effect,
    priorite: statut.priorite,
    relationStatus: statut.relationStatus ?? 'INCONNU',
    requiresComment: statut.requiresComment,
    requiresCallback: statut.requiresCallback,
    reessai: String(statut.retryAfterMinutes),
  };
}

function options<T extends string>(
  valeurs: readonly T[],
  libelles: Record<T, string>,
): { value: string; label: string }[] {
  return valeurs.map((valeur) => ({ value: valeur, label: libelles[valeur] }));
}

export function ChoixListe({
  label,
  valeur,
  options: liste,
  aide,
  onChange,
}: {
  label: string;
  valeur: string;
  options: readonly { value: string; label: string }[];
  aide?: string | undefined;
  onChange: (valeur: string) => void;
}) {
  return (
    <Field label={label} description={aide}>
      {(props) => (
        <Select
          items={[...liste]}
          value={valeur}
          onValueChange={(suivant) => {
            if (typeof suivant === 'string') onChange(suivant);
          }}
        >
          <SelectTrigger id={props.id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {liste.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}

export function Bascule({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (valeur: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-[0.875rem]">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}

export function StatutFormDialog({
  statut,
  open,
  onOpenChange,
}: {
  statut: StatutQualification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [brouillon, setBrouillon] = useState<Brouillon>(() => brouillonDe(statut));

  const enregistrer = useMutation({
    mutationFn: () => {
      const commun = {
        label: brouillon.label.trim(),
        priorite: brouillon.priorite,
        relationStatus: brouillon.relationStatus,
        requiresComment: brouillon.requiresComment,
        requiresCallback: brouillon.requiresCallback,
        retryAfterMinutes: Number(brouillon.reessai),
      };
      return statut === null
        ? creerStatut({ ...commun, effect: brouillon.effect })
        : modifierStatut(statut.id, commun);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
      toast.success('Statut enregistré.');
      onOpenChange(false);
    },
    onError: (erreur) => {
      toastApiError(erreur, 'Le statut n’a pas pu être enregistré.');
    },
  });

  const poser = (patch: Partial<Brouillon>): void => {
    setBrouillon((courant) => ({ ...courant, ...patch }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{statut === null ? 'Nouveau statut' : 'Modifier le statut'}</DialogTitle>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            enregistrer.mutate();
          }}
        >
          <Field label="Libellé" required>
            {(props) => (
              <Input
                {...props}
                required
                value={brouillon.label}
                onChange={(event) => {
                  poser({ label: event.target.value });
                }}
              />
            )}
          </Field>

          {statut === null ? (
            <ChoixListe
              label="Effet"
              valeur={brouillon.effect}
              options={options(EFFETS_STATUT, LIBELLES_EFFET_STATUT)}
              onChange={(valeur) => {
                poser({ effect: valeur as EffetStatut });
              }}
            />
          ) : null}

          <ChoixListe
            label="Priorité de traitement"
            valeur={brouillon.priorite}
            options={options(PRIORITES_STATUT, LIBELLES_PRIORITE)}
            onChange={(valeur) => {
              poser({ priorite: valeur as PrioriteStatut });
            }}
          />

          <ChoixListe
            label="Relation posée sur la fiche"
            valeur={brouillon.relationStatus}
            options={options(RELATIONS, LIBELLES_RELATION)}
            onChange={(valeur) => {
              poser({ relationStatus: valeur as RelationStatut });
            }}
          />

          <ChoixListe
            label="Réessai proposé"
            valeur={brouillon.reessai}
            options={REESSAIS_STATUT}
            onChange={(valeur) => {
              poser({ reessai: valeur });
            }}
          />

          <Bascule
            label="Exige un commentaire"
            checked={brouillon.requiresComment}
            onChange={(valeur) => {
              poser({ requiresComment: valeur });
            }}
          />
          <Bascule
            label="Exige une date de rappel"
            checked={brouillon.requiresCallback}
            onChange={(valeur) => {
              poser({ requiresCallback: valeur });
            }}
          />

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
