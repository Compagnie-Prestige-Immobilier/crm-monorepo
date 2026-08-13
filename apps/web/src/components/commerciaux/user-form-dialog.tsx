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
import { fetchReferenceData } from '@/lib/data/reference';
import { createUser, updateUser } from '@/lib/data/users';
import { withRetired } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { userFormSchema, type UserFormInput } from '@/lib/schemas';
import type { CreateUserInput, UpdateUserInput, UserRow } from '@/lib/types';

/** Valeur du `Select` signifiant « aucun département ». */
const NO_DEPARTEMENT = '__aucun__';

/**
 * Création et modification d'un compte commercial.
 *
 * Un seul composant pour les deux : les champs sont identiques à un près (le
 * mot de passe, exigé à la création et jamais modifiable ici — la
 * réinitialisation passe par un endpoint dédié). Deux formulaires jumeaux
 * finissent toujours par diverger sur une validation.
 */
export function UserFormDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `undefined` = création. */
  user?: UserRow | undefined;
}) {
  const isEdit = user !== undefined;
  const queryClient = useQueryClient();

  const { data: reference } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });

  const form = useForm<UserFormInput>({
    resolver: zodResolver(userFormSchema(isEdit ? 'edit' : 'create')),
    defaultValues: {
      email: '',
      username: '',
      fullName: '',
      phone: '',
      departementId: NO_DEPARTEMENT,
      password: '',
    },
  });

  const { register, handleSubmit, reset, setValue, watch, formState } = form;

  // Le formulaire est remonté à chaque ouverture : rouvrir sur un autre compte
  // ne doit pas laisser traîner les valeurs du précédent.
  useEffect(() => {
    if (!open) return;
    reset({
      email: user?.email ?? '',
      username: user?.username ?? '',
      fullName: user?.fullName ?? '',
      phone: user?.phoneE164 ?? '',
      departementId: user?.departementId ?? NO_DEPARTEMENT,
      password: '',
    });
  }, [open, user, reset]);

  const mutation = useMutation({
    mutationFn: async (values: UserFormInput) => {
      const departementId =
        values.departementId === NO_DEPARTEMENT || values.departementId === ''
          ? undefined
          : values.departementId;
      const phone = values.phone === '' ? undefined : values.phone;

      if (isEdit) {
        const patch: UpdateUserInput = {
          email: values.email,
          username: values.username,
          fullName: values.fullName,
          // `role` est obligatoire dans le contrat (il porte un défaut). On
          // renvoie celui du compte plutôt que la constante « COMMERCIAL » :
          // sinon modifier l'e-mail d'un administrateur le rétrograderait.
          role: user.role,
        };
        // `exactOptionalPropertyTypes` : une clé absente ne modifie rien, une
        // clé à `undefined` serait sérialisée en `null` et effacerait la valeur.
        if (departementId !== undefined) patch.departementId = departementId;
        if (phone !== undefined) patch.phone = phone;
        return updateUser(user.id, patch);
      }

      const body: CreateUserInput = {
        email: values.email,
        username: values.username,
        fullName: values.fullName,
        password: values.password,
        role: 'COMMERCIAL',
      };
      if (departementId !== undefined) body.departementId = departementId;
      if (phone !== undefined) body.phone = phone;
      return createUser(body);
    },
    onSuccess: (saved) => {
      // Racine de la clé : toutes les pages et tous les filtres de la liste
      // sont invalidés, pas seulement la combinaison affichée.
      void queryClient.invalidateQueries({ queryKey: queryKeys.commerciauxRoot });
      // Le nouveau commercial doit apparaître immédiatement dans le combobox de
      // filtre des prospects, sinon on ne peut pas voir ses saisies.
      void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
      toast.success(
        isEdit ? `Compte de ${saved.fullName} mis à jour.` : `Compte de ${saved.fullName} créé.`,
      );
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(
        error,
        isEdit ? 'Modification impossible. Réessayez.' : 'Création impossible. Réessayez.',
      );
    },
  });

  const departementId = watch('departementId');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le commercial' : 'Nouveau commercial'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Le mot de passe n’est pas modifiable ici.'
              : 'Compte de connexion à l’application mobile CPI GO.'}
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            void handleSubmit((values) => {
              mutation.mutate(values);
            })(event);
          }}
        >
          <Field label="Nom complet" required error={formState.errors.fullName?.message}>
            {(props) => <Input {...props} autoComplete="name" {...register('fullName')} />}
          </Field>

          <Field label="Adresse e-mail" required error={formState.errors.email?.message}>
            {(props) => (
              <Input {...props} type="email" autoComplete="email" {...register('email')} />
            )}
          </Field>

          <Field
            label="Identifiant"
            required
            description="Utilisé pour la connexion, avec l’e-mail."
            error={formState.errors.username?.message}
          >
            {(props) => (
              <Input
                {...props}
                autoCapitalize="none"
                spellCheck={false}
                {...register('username')}
              />
            )}
          </Field>

          <Field
            label="Téléphone"
            description="Format libre."
            error={formState.errors.phone?.message}
          >
            {(props) => (
              <Input {...props} type="tel" placeholder="77 123 45 67" {...register('phone')} />
            )}
          </Field>

          <Field label="Département" error={formState.errors.departementId?.message}>
            {(props) => (
              <Select
                value={departementId}
                onValueChange={(value) => {
                  setValue('departementId', value, { shouldDirty: true });
                }}
              >
                <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']}>
                  <SelectValue placeholder="Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPARTEMENT}>Aucun</SelectItem>
                  {(reference?.departements ?? []).map((departement) => (
                    <SelectItem key={departement.id} value={departement.id}>
                      {withRetired(departement.name, departement.isActive)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          {isEdit ? null : (
            <Field
              label="Mot de passe"
              required
              description="12 caractères minimum."
              error={formState.errors.password?.message}
            >
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  autoComplete="new-password"
                  {...register('password')}
                />
              )}
            </Field>
          )}

          <DialogFooter className="sm:col-span-2">
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
              {isEdit ? 'Enregistrer' : 'Créer le compte'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
