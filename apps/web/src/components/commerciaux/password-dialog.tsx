'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
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
import { resetUserPassword } from '@/lib/data/users';
import { toastApiError } from '@/lib/mutation-feedback';
import { resetPasswordSchema, type ResetPasswordFormInput } from '@/lib/schemas';
import type { UserRow } from '@/lib/types';

/**
 * Réinitialisation administrateur du mot de passe.
 *
 * L'ancien mot de passe n'est PAS demandé : c'est le point de cette
 * fonctionnalité — un commercial qui a perdu le sien ne peut rien fournir. La
 * contrepartie est que l'opération est journalisée côté API et révoque les
 * sessions du compte : le téléphone du commercial redemandera une connexion.
 */
export function PasswordDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserRow | null;
}) {
  const { register, handleSubmit, reset, formState } = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmation: '' },
  });

  useEffect(() => {
    if (open) reset({ password: '', confirmation: '' });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: ResetPasswordFormInput) => {
      if (user === null) throw new Error('Aucun compte sélectionné.');
      return resetUserPassword(user.id, values.password);
    },
    onSuccess: () => {
      toast.success(
        `Mot de passe réinitialisé. ${user?.fullName ?? 'Le commercial'} est déconnecté.`,
      );
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'Réinitialisation impossible. Réessayez.');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription>
            {user === null
              ? null
              : `Compte de ${user.fullName} (${user.email}). Les sessions ouvertes seront fermées.`}
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
          <Field
            label="Nouveau mot de passe"
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

          <Field label="Confirmation" required error={formState.errors.confirmation?.message}>
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="new-password"
                {...register('confirmation')}
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
              Réinitialiser
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
