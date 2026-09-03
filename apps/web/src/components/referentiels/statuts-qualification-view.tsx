'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PlusIcon, PowerIcon, PowerOffIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  STATUT_QUALIFICATION_EFFECTS,
  STATUT_QUALIFICATION_EFFECT_LABELS,
  createStatutQualification,
  estAbouti,
  fetchAllStatutsQualification,
  setStatutQualificationActive,
  updateStatutQualification,
  type StatutQualification,
  type StatutQualificationEffect,
} from '@/lib/data/statuts-qualification';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

interface Draft {
  code: string;
  label: string;
  effect: StatutQualificationEffect;
  requiresCallback: boolean;
  sortOrder: number;
}

const EMPTY: Draft = {
  code: '',
  label: '',
  effect: 'REACHED',
  requiresCallback: false,
  sortOrder: 100,
};

export function StatutsQualificationView() {
  const queryClient = useQueryClient();
  const [edite, setEdite] = useState<StatutQualification | null>(null);
  const [ouvert, setOuvert] = useState(false);

  const statuts = useQuery({
    queryKey: queryKeys.statutsQualificationAdmin,
    queryFn: () => fetchAllStatutsQualification(),
  });

  const invalider = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
  };

  const activation = useMutation({
    mutationFn: (variables: { id: string; isActive: boolean }) =>
      setStatutQualificationActive(variables.id, variables.isActive),
    onSuccess: (statut) => {
      invalider();
      toast.success(statut.isActive ? `${statut.label} réactivé.` : `${statut.label} retiré.`);
    },
    onError: (error) => {
      toastApiError(error, 'Le statut n’a pas pu être modifié.');
    },
  });

  if (statuts.isError) {
    return <QueryErrorState error={statuts.error} onRetry={() => void statuts.refetch()} />;
  }

  const lignes = statuts.data ?? [];
  const abouti = lignes.filter((statut) => estAbouti(statut.effect));
  const nonAbouti = lignes.filter((statut) => !estAbouti(statut.effect));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-[0.9375rem] text-muted-foreground">
          Ce que le téléconseiller choisit après avoir dit si l’appel a abouti. L’effet décide de la
          branche où le statut se propose et de l’issue enregistrée.
        </p>
        <Button
          onClick={() => {
            setEdite(null);
            setOuvert(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          Nouveau statut
        </Button>
      </div>

      {statuts.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Branche
            titre="Appel abouti"
            statuts={abouti}
            onModifier={(statut) => {
              setEdite(statut);
              setOuvert(true);
            }}
            onBasculer={(statut) =>
              activation.mutate({ id: statut.id, isActive: !statut.isActive })
            }
            enCours={activation.isPending}
          />
          <Branche
            titre="Appel non abouti"
            statuts={nonAbouti}
            onModifier={(statut) => {
              setEdite(statut);
              setOuvert(true);
            }}
            onBasculer={(statut) =>
              activation.mutate({ id: statut.id, isActive: !statut.isActive })
            }
            enCours={activation.isPending}
          />
        </>
      )}

      <FormulaireStatut
        statut={edite}
        open={ouvert}
        onOpenChange={setOuvert}
        onSaved={() => {
          invalider();
          setOuvert(false);
        }}
      />
    </div>
  );
}

function Branche({
  titre,
  statuts,
  onModifier,
  onBasculer,
  enCours,
}: {
  titre: string;
  statuts: StatutQualification[];
  onModifier: (statut: StatutQualification) => void;
  onBasculer: (statut: StatutQualification) => void;
  enCours: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow rail text-muted-foreground">{titre}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Libellé</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Effet</TableHead>
            <TableHead>Rang</TableHead>
            <TableHead>État</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statuts.map((statut) => (
            <TableRow key={statut.id}>
              <TableCell className="font-[600]">
                {statut.label}
                {statut.requiresCallback ? (
                  <Badge variant="outline" className="ml-2">
                    date exigée
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="text-muted-foreground">{statut.code}</TableCell>
              <TableCell>{STATUT_QUALIFICATION_EFFECT_LABELS[statut.effect]}</TableCell>
              <TableCell>{statut.sortOrder}</TableCell>
              <TableCell>
                <Badge variant={statut.isActive ? 'default' : 'outline'}>
                  {statut.isActive ? 'Proposé' : 'Retiré'}
                </Badge>
                {statut.isSystem ? (
                  <Badge variant="outline" className="ml-2">
                    système
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onModifier(statut)}
                  aria-label={`Modifier ${statut.label}`}
                >
                  <PencilIcon aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={enCours}
                  onClick={() => onBasculer(statut)}
                  aria-label={
                    statut.isActive ? `Retirer ${statut.label}` : `Réactiver ${statut.label}`
                  }
                >
                  {statut.isActive ? (
                    <PowerOffIcon aria-hidden="true" />
                  ) : (
                    <PowerIcon aria-hidden="true" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function FormulaireStatut({
  statut,
  open,
  onOpenChange,
  onSaved,
}: {
  statut: StatutQualification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const modification = statut !== null;
  // La règle d'un statut système est celle du script : elle se lit, elle ne se
  // reconfigure pas. Le serveur refuse de toute façon.
  const regleFigee = statut?.isSystem === true;

  const { register, handleSubmit, reset, watch, setValue, formState } = useForm<Draft>({
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      statut === null
        ? EMPTY
        : {
            code: statut.code,
            label: statut.label,
            effect: statut.effect,
            requiresCallback: statut.requiresCallback,
            sortOrder: statut.sortOrder,
          },
    );
  }, [open, statut, reset]);

  // oxlint-disable-next-line react/incompatible-library -- faux positif react-hook-form
  const effect = watch('effect');

  const save = useMutation({
    mutationFn: (values: Draft) =>
      modification
        ? updateStatutQualification(statut.id, {
            label: values.label.trim(),
            sortOrder: values.sortOrder,
            ...(regleFigee ? {} : { requiresCallback: values.requiresCallback }),
          })
        : createStatutQualification({
            code: values.code.trim(),
            label: values.label.trim(),
            effect: values.effect,
            requiresCallback: values.requiresCallback,
            sortOrder: values.sortOrder,
          }),
    onSuccess: () => {
      toast.success(modification ? 'Statut modifié.' : 'Statut ajouté.');
      onSaved();
    },
    onError: (error) => {
      toastApiError(error, 'Le statut n’a pas pu être enregistré.');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{modification ? 'Modifier le statut' : 'Nouveau statut'}</DialogTitle>
          <DialogDescription>
            {modification
              ? 'Le code ne se change pas : les appels déjà consignés le désignent.'
              : 'Le code sera figé après enregistrement : les appels consignés le désigneront.'}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) => {
            save.mutate(values);
          })}
        >
          <Field label="Libellé" required error={formState.errors.label?.message}>
            {(props) => (
              <Input
                {...props}
                {...register('label', {
                  required: 'Le libellé est obligatoire.',
                  maxLength: { value: 120, message: 'Libellé trop long.' },
                })}
              />
            )}
          </Field>

          <Field
            label="Code"
            required={!modification}
            description="Lettres, chiffres et soulignés. Immuable."
            error={formState.errors.code?.message}
          >
            {(props) => (
              <Input
                {...props}
                disabled={modification}
                {...register('code', {
                  required: modification ? false : 'Le code est obligatoire.',
                  pattern: {
                    value: /^[A-Za-z][A-Za-z0-9_]*$/u,
                    message: 'Lettres, chiffres et soulignés seulement.',
                  },
                })}
              />
            )}
          </Field>

          <Field label="Effet" description="Il décide de la branche et de l’issue enregistrée.">
            {(props) => (
              <Select
                value={effect}
                onValueChange={(value) => {
                  setValue('effect', value as StatutQualificationEffect);
                  if (value !== 'SCHEDULE_CALLBACK') setValue('requiresCallback', false);
                }}
                disabled={modification}
              >
                <SelectTrigger id={props.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUT_QUALIFICATION_EFFECTS.map((valeur) => (
                    <SelectItem key={valeur} value={valeur}>
                      {STATUT_QUALIFICATION_EFFECT_LABELS[valeur]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          {/* Seul l'effet qui planifie un rappel peut en exiger la date : le
              serveur refuse le reste, autant ne pas le proposer. */}
          <label className="flex items-center gap-2 text-[0.9375rem]">
            <input
              type="checkbox"
              disabled={regleFigee || effect !== 'SCHEDULE_CALLBACK'}
              {...register('requiresCallback')}
            />
            Exige la date du rappel
          </label>

          <Field label="Rang" description="Plus petit, plus haut dans la liste.">
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                max={9999}
                {...register('sortOrder', { valueAsNumber: true })}
              />
            )}
          </Field>

          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
