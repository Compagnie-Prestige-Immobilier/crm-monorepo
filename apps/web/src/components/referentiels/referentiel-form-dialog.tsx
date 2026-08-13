'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
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
import { fetchRegions } from '@/lib/data/reference';
import {
  createBanque,
  createDepartement,
  createSyndicat,
  updateBanque,
  updateDepartement,
  updateSyndicat,
} from '@/lib/data/referentiels';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  banqueSchema,
  departementSchema,
  syndicatSchema,
  type BanqueFormInput,
  type DepartementFormInput,
  type SyndicatFormInput,
} from '@/lib/schemas';
import type { Banque, Departement, Syndicat } from '@/lib/types';

/**
 * Création et renommage d'un référentiel.
 *
 * Trois formulaires distincts plutôt qu'un formulaire générique : les champs
 * n'ont rien en commun (une banque a une abréviation, un syndicat un secteur,
 * un département une région et un code administratif unique), et un composant
 * paramétré par un objet de configuration serait plus long que les trois
 * réunis, tout en perdant le typage des corps de requête.
 */

export function BanqueFormDialog({
  open,
  onOpenChange,
  banque,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  banque?: Banque | undefined;
}) {
  const queryClient = useQueryClient();
  const isEdit = banque !== undefined;

  const { register, handleSubmit, reset, formState } = useForm<BanqueFormInput>({
    resolver: zodResolver(banqueSchema),
    defaultValues: { name: '', shortName: '', sortOrder: 100 },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: banque?.name ?? '',
      shortName: banque?.shortName ?? '',
      sortOrder: banque?.sortOrder ?? 100,
    });
  }, [open, banque, reset]);

  const mutation = useMutation({
    mutationFn: (values: BanqueFormInput) =>
      isEdit
        ? updateBanque(banque.id, { ...values, isActive: banque.isActive })
        : createBanque({ ...values, isActive: true }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
      toast.success(isEdit ? `${saved.shortName} enregistrée.` : `${saved.shortName} ajoutée.`);
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'Enregistrement impossible. Réessayez.');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier la banque' : 'Nouvelle banque'}</DialogTitle>
          <DialogDescription>
            Banque de domiciliation proposée à la saisie des prospects.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void handleSubmit((values) => {
              mutation.mutate(values);
            })(event);
          }}
        >
          <Field label="Nom complet" required error={formState.errors.name?.message}>
            {(props) => (
              <Input {...props} placeholder="Société Générale Sénégal" {...register('name')} />
            )}
          </Field>
          <Field
            label="Abréviation"
            required
            description="Affichée dans les listes et les exports."
            error={formState.errors.shortName?.message}
          >
            {(props) => <Input {...props} placeholder="SGS" {...register('shortName')} />}
          </Field>
          <Field
            label="Ordre d’affichage"
            required
            description="Le plus petit nombre apparaît en premier."
            error={formState.errors.sortOrder?.message}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                inputMode="numeric"
                {...register('sortOrder')}
              />
            )}
          </Field>

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
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
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

export function SyndicatFormDialog({
  open,
  onOpenChange,
  syndicat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syndicat?: Syndicat | undefined;
}) {
  const queryClient = useQueryClient();
  const isEdit = syndicat !== undefined;

  const { register, handleSubmit, reset, formState } = useForm<SyndicatFormInput>({
    resolver: zodResolver(syndicatSchema),
    defaultValues: { name: '', sigle: '', secteur: '', sortOrder: 100 },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: syndicat?.name ?? '',
      sigle: syndicat?.sigle ?? '',
      secteur: syndicat?.secteur ?? '',
      sortOrder: syndicat?.sortOrder ?? 100,
    });
  }, [open, syndicat, reset]);

  const mutation = useMutation({
    mutationFn: (values: SyndicatFormInput) => {
      const body = {
        name: values.name,
        sigle: values.sigle,
        sortOrder: values.sortOrder,
        // Champ facultatif : une chaîne vide vaut « non renseigné », et l'API
        // refuserait `secteur: ''` comme une valeur.
        ...(values.secteur === '' ? {} : { secteur: values.secteur }),
      };
      return isEdit
        ? updateSyndicat(syndicat.id, { ...body, isActive: syndicat.isActive })
        : createSyndicat({ ...body, isActive: true });
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
      toast.success(isEdit ? `${saved.sigle} enregistré.` : `${saved.sigle} ajouté.`);
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'Enregistrement impossible. Réessayez.');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le syndicat' : 'Nouveau syndicat'}</DialogTitle>
          <DialogDescription>Le sigle est affiché dans les listes de saisie.</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void handleSubmit((values) => {
              mutation.mutate(values);
            })(event);
          }}
        >
          <Field label="Nom complet" required error={formState.errors.name?.message}>
            {(props) => <Input {...props} {...register('name')} />}
          </Field>
          <Field label="Sigle" required error={formState.errors.sigle?.message}>
            {(props) => <Input {...props} {...register('sigle')} />}
          </Field>
          <Field label="Secteur" error={formState.errors.secteur?.message}>
            {(props) => (
              <Input {...props} placeholder="Santé, éducation…" {...register('secteur')} />
            )}
          </Field>
          <Field label="Ordre d’affichage" required error={formState.errors.sortOrder?.message}>
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                inputMode="numeric"
                {...register('sortOrder')}
              />
            )}
          </Field>

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
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
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

export function DepartementFormDialog({
  open,
  onOpenChange,
  departement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departement?: Departement | undefined;
}) {
  const queryClient = useQueryClient();
  const isEdit = departement !== undefined;

  const { data: regions } = useQuery({
    queryKey: queryKeys.regions,
    queryFn: () => fetchRegions(),
    staleTime: 30 * 60_000,
  });

  const { register, handleSubmit, reset, setValue, watch, formState } =
    useForm<DepartementFormInput>({
      resolver: zodResolver(departementSchema),
      defaultValues: { code: '', name: '', regionId: '' },
    });

  useEffect(() => {
    if (!open) return;
    reset({
      code: departement?.code ?? '',
      name: departement?.name ?? '',
      regionId: departement?.regionId ?? '',
    });
  }, [open, departement, reset]);

  const mutation = useMutation({
    mutationFn: (values: DepartementFormInput) =>
      isEdit
        ? updateDepartement(departement.id, { ...values, isActive: departement.isActive })
        : createDepartement({ ...values, isActive: true }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.referentielsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
      toast.success(isEdit ? `${saved.name} enregistré.` : `${saved.name} ajouté.`);
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'Enregistrement impossible. Réessayez.');
    },
  });

  const regionId = watch('regionId');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le département' : 'Nouveau département'}</DialogTitle>
          <DialogDescription>
            Découpage administratif utilisé pour les statistiques géographiques.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void handleSubmit((values) => {
              mutation.mutate(values);
            })(event);
          }}
        >
          <Field label="Nom" required error={formState.errors.name?.message}>
            {(props) => <Input {...props} {...register('name')} />}
          </Field>
          <Field
            label="Code administratif"
            required
            description="Unique dans toute la base."
            error={formState.errors.code?.message}
          >
            {(props) => <Input {...props} {...register('code')} />}
          </Field>
          <Field label="Région" required error={formState.errors.regionId?.message}>
            {(props) => (
              <Select
                value={regionId}
                onValueChange={(value) => {
                  setValue('regionId', value, { shouldDirty: true });
                }}
              >
                <SelectTrigger id={props.id}>
                  <SelectValue placeholder="Choisir une région" />
                </SelectTrigger>
                <SelectContent>
                  {(regions ?? []).map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

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
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
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
