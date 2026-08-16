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
import { ROLE_LABELS, type CreateUserInput, type UpdateUserInput, type UserRow } from '@/lib/types';
import { ROLES } from '@/lib/user-filters';

/** Valeur du `Select` signifiant « aucun département ». */
const NO_DEPARTEMENT = '__aucun__';

/**
 * Création et modification d'un compte, QUEL QUE SOIT SON RÔLE.
 *
 * Ce dialogue ne savait créer que des téléconseillers : le rôle était posé en
 * dur à `COMMERCIAL`. Aucun accès « Banque & Finance » ne pouvait donc naître
 * depuis le panel, alors que tout l'espace « Dossiers » leur est destiné — il
 * fallait un UPDATE en base pour créer le premier.
 *
 * Un seul composant pour les deux : les champs sont identiques à un près (le
 * mot de passe, exigé à la création et jamais modifiable ici : la
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
      // Pas de valeur : le champ part VIDE et la validation exige un choix.
      // Voir `userBaseSchema.role`.
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
      // En MODIFICATION, le rôle actuel du compte ; en CRÉATION, rien. Un
      // repli sur « COMMERCIAL » ferait ressembler un champ non renseigné à un
      // champ décidé.
      ...(user ? { role: user.role } : {}),
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
          // Le rôle CHOISI dans le formulaire, initialisé sur celui du compte.
          // Il valait `user.role` en dur : modifier l'e-mail d'un administrateur
          // ne le rétrogradait donc pas, mais changer le rôle était impossible.
          role: values.role,
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
        role: values.role,
      };
      if (departementId !== undefined) body.departementId = departementId;
      if (phone !== undefined) body.phone = phone;
      return createUser(body);
    },
    onSuccess: (saved) => {
      // Racine de la clé : toutes les pages et tous les filtres de la liste
      // sont invalidés, pas seulement la combinaison affichée.
      void queryClient.invalidateQueries({ queryKey: queryKeys.commerciauxRoot });
      // Un nouveau téléconseiller doit apparaître immédiatement dans le combobox
      // de filtre des prospects, sinon on ne peut pas voir ses saisies.
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
  /*
   * `| undefined` EST LA VÉRITÉ D'EXÉCUTION, que le type de `watch` ne dit pas.
   *
   * `UserFormInput['role']` est une énumération NON optionnelle : le schéma
   * l'exige, et c'est le but. Mais à la CRÉATION, `defaultValues` ne pose aucune
   * valeur — c'est ce qui force un choix — donc le champ vaut réellement
   * `undefined` tant que personne n'a ouvert la liste. Sans cette annotation,
   * TypeScript croit la valeur toujours présente, et `no-unnecessary-condition`
   * fait supprimer les gardes qui servent vraiment.
   */
  const role = watch('role') as UserFormInput['role'] | undefined;

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
            LE RÔLE, PLACÉ AVANT LE DÉPARTEMENT parce qu'il commande la suite :
            c'est lui qui décide de ce que le compte verra en se connectant, et
            le département n'a de sens que pour un téléconseiller.

            Sans ce champ, la création posait « COMMERCIAL » en dur : aucun
            compte bancaire ne pouvait naître depuis le panel, alors que tout
            l'espace « Dossiers » leur est destiné.
          */}
          <Field
            label="Rôle"
            required
            description={
              role === 'BANQUE_FINANCE'
                ? 'Accède aux dossiers bancaires, pas aux prospects.'
                : role === 'ADMIN'
                  ? 'Accès complet, y compris les comptes et les référentiels.'
                  : role === 'COMMERCIAL'
                    ? 'Saisit les prospects depuis l’application mobile.'
                    : 'Décide de ce que le compte pourra consulter.'
            }
            error={formState.errors.role?.message}
          >
            {(props) => (
              <Select
                value={role ?? ''}
                onValueChange={(value) => {
                  setValue('role', value as UserFormInput['role'], {
                    shouldDirty: true,
                    // Sans revalidation, le message « Choisissez le rôle du
                    // compte » resterait affiché sous un champ désormais rempli.
                    shouldValidate: true,
                  });
                }}
              >
                <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']}>
                  <SelectValue placeholder="Choisir un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {ROLE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
