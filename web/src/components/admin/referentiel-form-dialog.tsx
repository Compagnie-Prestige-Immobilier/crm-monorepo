import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import type { ChampReferentiel, ListeReferentiel } from '@/components/admin/referentiels-listes';
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
  creerEntreeReferentiel,
  fetchReferentiel,
  libelle,
  modifierEntreeReferentiel,
  type ReferentielEntree,
  type ReferentielItem,
} from '@/lib/data/referentiels';
import { champsRefuses, toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

type Brouillon = Record<string, string | boolean>;

function brouillonDe(liste: ListeReferentiel, item: ReferentielItem | null): Brouillon {
  const brouillon: Brouillon = {};
  for (const champ of liste.champs) {
    const valeur = item === null ? null : item[champ.nom];
    if (champ.type === 'booleen') {
      brouillon[champ.nom] = valeur === true;
      continue;
    }
    brouillon[champ.nom] = valeur === null || valeur === undefined ? '' : String(valeur);
  }
  return brouillon;
}

/** `undefined` : le champ reste absent du corps, et le serveur n'y touche pas. */
function valeurEcrite(
  champ: ChampReferentiel,
  brut: string | boolean | undefined,
): string | number | boolean | undefined {
  if (typeof brut === 'boolean') return brut;
  const valeur = (brut ?? '').trim();
  if (champ.type === 'nombre') return valeur === '' ? undefined : Number(valeur);
  if (valeur === '' && champ.obligatoire !== true) return undefined;
  return valeur;
}

function corpsDe(liste: ListeReferentiel, brouillon: Brouillon): ReferentielEntree {
  const corps: Record<string, string | number | boolean> = {};
  for (const champ of liste.champs) {
    const valeur = valeurEcrite(champ, brouillon[champ.nom]);
    if (valeur !== undefined) corps[champ.nom] = valeur;
  }
  return corps as ReferentielEntree;
}

function ChoixReferentiel({
  champ,
  valeur,
  onChange,
  props,
}: {
  champ: ChampReferentiel;
  valeur: string;
  onChange: (valeur: string) => void;
  props: { id: string; 'aria-describedby': string | undefined };
}) {
  const source = champ.source ?? '';
  const liste = useQuery({
    queryKey: [...queryKeys.referentielsRoot, source],
    queryFn: () => fetchReferentiel(source, true),
    enabled: source !== '',
  });
  const items = (liste.data ?? []).map((item) => ({ value: item.id, label: libelle(item) }));

  return (
    <Select
      items={items}
      value={valeur === '' ? null : valeur}
      onValueChange={(suivant) => {
        if (typeof suivant === 'string') onChange(suivant);
      }}
    >
      <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']}>
        <SelectValue placeholder="Choisir" />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ReferentielFormDialog({
  liste,
  item,
  open,
  onOpenChange,
}: {
  liste: ListeReferentiel;
  item: ReferentielItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [brouillon, setBrouillon] = useState<Brouillon>(() => brouillonDe(liste, item));
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const enregistrer = useMutation({
    mutationFn: (corps: ReferentielEntree) =>
      item === null
        ? creerEntreeReferentiel(liste.kind, corps)
        : modifierEntreeReferentiel(liste.kind, item.id, corps),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
      toast.success(item === null ? 'Entrée créée.' : 'Entrée modifiée.');
      onOpenChange(false);
    },
    onError: (erreur) => {
      setErreurs(champsRefuses(erreur));
      toastApiError(erreur, 'L’entrée n’a pas pu être enregistrée.');
    },
  });

  const poser = (nom: string, valeur: string | boolean): void => {
    setBrouillon((courant) => ({ ...courant, [nom]: valeur }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item === null ? liste.nouveau : liste.modifier}</DialogTitle>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setErreurs({});
            enregistrer.mutate(corpsDe(liste, brouillon));
          }}
        >
          {liste.champs.map((champ) => {
            const valeur = brouillon[champ.nom];
            if (champ.type === 'booleen') {
              return (
                <label key={champ.nom} className="flex items-center gap-3 text-[0.875rem]">
                  <Switch
                    checked={valeur === true}
                    onCheckedChange={(coche) => {
                      poser(champ.nom, coche);
                    }}
                  />
                  {champ.libelle}
                </label>
              );
            }

            const texte = typeof valeur === 'string' ? valeur : '';
            return (
              <Field
                key={champ.nom}
                label={champ.libelle}
                required={champ.obligatoire === true}
                error={erreurs[champ.nom]}
              >
                {(props) => {
                  if (champ.type === 'referentiel') {
                    return (
                      <ChoixReferentiel
                        champ={champ}
                        valeur={texte}
                        props={props}
                        onChange={(suivant) => {
                          poser(champ.nom, suivant);
                        }}
                      />
                    );
                  }
                  if (champ.type === 'liste') {
                    const options = champ.options ?? [];
                    return (
                      <Select
                        items={[...options]}
                        value={texte === '' ? null : texte}
                        onValueChange={(suivant) => {
                          if (typeof suivant === 'string') poser(champ.nom, suivant);
                        }}
                      >
                        <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']}>
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }
                  return (
                    <Input
                      {...props}
                      type={champ.type === 'nombre' ? 'number' : 'text'}
                      min={champ.type === 'nombre' ? 0 : undefined}
                      required={champ.obligatoire === true}
                      value={texte}
                      onChange={(event) => {
                        poser(champ.nom, event.target.value);
                      }}
                    />
                  );
                }}
              </Field>
            );
          })}

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
