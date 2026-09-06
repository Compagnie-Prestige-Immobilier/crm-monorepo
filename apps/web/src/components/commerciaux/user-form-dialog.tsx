'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { createUser, updateUser } from '@/lib/data/users';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { userFormSchema, type UserFormInput } from '@/lib/schemas';
import {
  ROLE_LABELS,
  type CreateUserInput,
  type Role,
  type UpdateUserInput,
  type UserRow,
} from '@/lib/types';
import { ROLES } from '@/lib/user-filters';

const ROLE_HINTS: Record<Role, string> = {
  ADMIN: 'Accès complet, y compris les comptes et les référentiels.',
  COMMERCIAL: 'Saisit les prospects depuis l’application mobile.',
  BANQUE_FINANCE: 'Accède aux dossiers bancaires, pas aux prospects.',
  SUPERVISEUR: 'Passe lui-même les trois appels et suit le travail de son équipe.',
  DIRECTION: 'Passe les trois appels, lit tout le téléconseil et tient le registre des visites.',
  ACCUEIL: 'Tient le registre des visites, et rien d’autre.',
  CHARGE_CLIENTELE: 'Passe les trois appels, relit et revoit toute demande convertie.',
};

export function UserFormDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserRow | undefined;
}) {
  const isEdit = user !== undefined;
  const queryClient = useQueryClient();

  const form = useForm<UserFormInput>({
    resolver: zodResolver(userFormSchema(isEdit ? 'edit' : 'create')),
    defaultValues: {
      email: '',
      username: '',
      fullName: '',
      phone: '',
      password: '',
    },
  });

  const { register, handleSubmit, reset, setValue, watch, formState } = form;

  useEffect(() => {
    if (!open) return;
    reset({
      email: user?.email ?? '',
      username: user?.username ?? '',
      fullName: user?.fullName ?? '',
      phone: user?.phoneE164 ?? '',
      password: '',
      ...(user ? { role: user.role } : {}),
    });
  }, [open, user, reset]);

  const mutation = useMutation({
    mutationFn: async (values: UserFormInput) => {
      const phone = values.phone;

      if (isEdit) {
        const patch: UpdateUserInput = {
          email: values.email,
          username: values.username,
          fullName: values.fullName,
          role: values.role,
        };
        // La chaine VIDE et non `undefined` : sur un PATCH, un champ absent veut
        // dire « ne change rien », et le telephone ne s'effacerait jamais.
        patch.phone = phone;
        return updateUser(user.id, patch);
      }

      const body: CreateUserInput = {
        email: values.email,
        username: values.username,
        fullName: values.fullName,
        password: values.password,
        role: values.role,
      };
      // A la creation, en revanche, un vide n'a rien a effacer : on l'omet.
      if (phone !== '') body.phone = phone;
      return createUser(body);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.commerciauxRoot });
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

  // oxlint-disable-next-line react/incompatible-library -- faux positif react-hook-form
  const role = watch('role') as UserFormInput['role'] | undefined;

  const roleItems = ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le compte' : 'Nouvel utilisateur'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Le mot de passe n’est pas modifiable ici.'
              : 'Le rôle décide de ce que le compte pourra consulter.'}
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

          {/*
            Sans ce champ, la création posait « COMMERCIAL » en dur : aucun
            compte bancaire ne pouvait naître depuis le panel, alors que tout
            l'espace « Dossiers » leur est destiné.
          */}
          <Field
            label="Rôle"
            required
            description={
              role === undefined ? 'Décide de ce que le compte pourra consulter.' : ROLE_HINTS[role]
            }
            error={formState.errors.role?.message}
          >
            {(props) => (
              <Select
                items={roleItems}
                value={role ?? ''}
                onValueChange={(value) => {
                  if (value === null) return;
                  setValue('role', value as UserFormInput['role'], {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
              >
                <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']}>
                  <SelectValue placeholder="Choisir un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {roleItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
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
