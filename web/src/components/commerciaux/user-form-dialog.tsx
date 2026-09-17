'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import { fetchRoles, type RoleCompte } from '@/lib/data/roles';
import { createUser, updateUser } from '@/lib/data/users';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { userFormSchema, type UserFormInput } from '@/lib/schemas';
import { ROLE_LABELS, type Role, type UserRow } from '@/lib/types';

const ROLE_HINTS: Record<Role, string> = {
  ADMIN: 'Accès complet, y compris les comptes et les référentiels.',
  COMMERCIAL: 'Saisit les prospects et passe les appels depuis sa console.',
  BANQUE_FINANCE: 'Accède aux dossiers bancaires, pas aux prospects.',
  SUPERVISEUR: 'Passe lui-même les trois appels et suit le travail de son équipe.',
  DIRECTION: 'Passe les trois appels, suit toute l’activité et tient le registre des visites.',
  ACCUEIL: 'Tient le registre des visites, et rien d’autre.',
  CHARGE_CLIENTELE: 'Passe les trois appels, relit et revoit toute demande convertie.',
  CCP: 'Appelle toutes les fiches venues des plateformes d’enrôlement, jamais celles des campagnes.',
};

const TEXTES = {
  creation: {
    titre: 'Nouvel utilisateur',
    description: 'Le rôle décide de ce que le compte pourra consulter.',
    bouton: 'Créer le compte',
    succes: (nom: string) => `Compte de ${nom} créé.`,
    echec: 'Création impossible. Réessayez.',
  },
  edition: {
    titre: 'Modifier le compte',
    description: 'Le mot de passe n’est pas modifiable ici.',
    bouton: 'Enregistrer',
    succes: (nom: string) => `Compte de ${nom} mis à jour.`,
    echec: 'Modification impossible. Réessayez.',
  },
};

function aideDuRole(role: RoleCompte | undefined): string {
  if (role === undefined) return 'Décide de ce que le compte pourra consulter.';
  if (role.systeme) return ROLE_HINTS[role.roleDeBase];
  return `Rôle de base : ${ROLE_LABELS[role.roleDeBase]}.`;
}

function valeursDuCompte(user: UserRow | undefined): UserFormInput {
  if (user === undefined) {
    return { email: '', username: '', fullName: '', phone: '', password: '', roleId: '' };
  }
  const { email, username, fullName, roleId } = user;
  return { email, username, fullName, roleId, phone: user.phoneE164 ?? '', password: '' };
}

// La chaîne VIDE sur un PATCH efface le téléphone ; à la création, un vide s'omet.
function enregistrerCompte(values: UserFormInput, user: UserRow | undefined): Promise<UserRow> {
  const { email, username, fullName, roleId, phone, password } = values;
  if (user !== undefined) return updateUser(user.id, { email, username, fullName, roleId, phone });
  return createUser({
    email,
    username,
    fullName,
    roleId,
    password,
    ...(phone === '' ? {} : { phone }),
  });
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserRow | undefined;
  currentUserId: string;
}) {
  const textes = user === undefined ? TEXTES.creation : TEXTES.edition;
  const queryClient = useQueryClient();
  const [aConfirmer, setAConfirmer] = useState<UserFormInput | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<UserFormInput>({
    resolver: zodResolver(userFormSchema(user === undefined ? 'create' : 'edit')),
    defaultValues: valeursDuCompte(undefined),
  });
  const erreurs = formState.errors;

  useEffect(() => {
    if (open) reset(valeursDuCompte(user));
  }, [open, user, reset]);

  const mutation = useMutation({
    mutationFn: (values: UserFormInput) => enregistrerCompte(values, user),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.commerciauxRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reference });
      toast.success(textes.succes(saved.fullName));
      setAConfirmer(null);
      onOpenChange(false);
    },
    onError: (error) => {
      setAConfirmer(null);
      toastApiError(error, textes.echec);
    },
  });

  const soumettre = (values: UserFormInput): void => {
    const sonPropreRole = user?.id === currentUserId && values.roleId !== user.roleId;
    if (sonPropreRole) setAConfirmer(values);
    else mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{textes.titre}</DialogTitle>
          <DialogDescription>{textes.description}</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            void handleSubmit(soumettre)(event);
          }}
        >
          <Field label="Nom complet" required error={erreurs.fullName?.message}>
            {(props) => <Input {...props} autoComplete="name" {...register('fullName')} />}
          </Field>
          <Field label="Adresse e-mail" required error={erreurs.email?.message}>
            {(props) => (
              <Input {...props} type="email" autoComplete="email" {...register('email')} />
            )}
          </Field>
          <Field
            label="Identifiant"
            required
            description="Utilisé pour la connexion, avec l’e-mail."
            error={erreurs.username?.message}
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
          <Field label="Téléphone" description="Format libre." error={erreurs.phone?.message}>
            {(props) => (
              <Input {...props} type="tel" placeholder="77 123 45 67" {...register('phone')} />
            )}
          </Field>
          <ChampRole
            // oxlint-disable-next-line react/incompatible-library -- faux positif react-hook-form
            roleId={watch('roleId')}
            erreur={erreurs.roleId?.message}
            onChange={(roleId) => {
              setValue('roleId', roleId, { shouldDirty: true, shouldValidate: true });
            }}
          />
          {user === undefined ? <ChampMotDePasse form={{ register, formState }} /> : null}

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
              {textes.bouton}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <ConfirmDialog
        open={aConfirmer !== null}
        onOpenChange={(ouvert) => {
          if (!ouvert) setAConfirmer(null);
        }}
        title="Changer votre propre rôle ?"
        description="Vos accès changent dès la prochaine action."
        confirmLabel="Changer mon rôle"
        confirmVariant="default"
        pending={mutation.isPending}
        onConfirm={() => {
          if (aConfirmer !== null) mutation.mutate(aConfirmer);
        }}
      />
    </Dialog>
  );
}

function ChampMotDePasse({
  form,
}: {
  form: Pick<UseFormReturn<UserFormInput>, 'register' | 'formState'>;
}) {
  return (
    <Field
      label="Mot de passe"
      required
      description="12 caractères minimum."
      error={form.formState.errors.password?.message}
    >
      {(props) => (
        <Input
          {...props}
          type="password"
          autoComplete="new-password"
          {...form.register('password')}
        />
      )}
    </Field>
  );
}

/** Rôles système d'abord, puis personnalisés : l'ordre que renvoie le serveur. */
function ChampRole({
  roleId,
  erreur,
  onChange,
}: {
  roleId: string;
  erreur: string | undefined;
  onChange: (roleId: string) => void;
}) {
  const { data } = useQuery({ queryKey: queryKeys.roles, queryFn: () => fetchRoles() });
  const roles = data?.roles ?? [];
  const items = roles.map((role) => ({ value: role.id, label: role.libelle }));

  return (
    <Field
      label="Rôle"
      required
      description={aideDuRole(roles.find((role) => role.id === roleId))}
      error={erreur}
    >
      {(props) => (
        <Select
          items={items}
          value={roleId}
          onValueChange={(value) => {
            if (value !== null) onChange(value);
          }}
        >
          <SelectTrigger id={props.id} aria-describedby={props['aria-describedby']}>
            <SelectValue placeholder="Choisir un rôle" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}
