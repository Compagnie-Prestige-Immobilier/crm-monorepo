'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError } from '@crm/api-client/query';
import { useMutation } from '@tanstack/react-query';
import { KeyRoundIcon, LoaderIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { changeMyPassword } from '@/lib/data/auth';
import { toastApiError } from '@/lib/mutation-feedback';
import {
  changePasswordSchema,
  NEW_PASSWORD_MAX_LENGTH,
  NEW_PASSWORD_MIN_LENGTH,
  type ChangePasswordFormInput,
} from '@/lib/schemas';

export function ChangePasswordCard() {
  const { register, handleSubmit, reset, setError, formState } = useForm<ChangePasswordFormInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmation: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordFormInput) =>
      changeMyPassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      reset({ currentPassword: '', newPassword: '', confirmation: '' });
      toast.success('Mot de passe changé.');
    },
    onError: (error) => {
      const code = error instanceof ApiError ? (error.body as { code?: string }).code : undefined;
      if (code === 'INVALID_CURRENT_PASSWORD') {
        setError('currentPassword', { message: 'Le mot de passe actuel est incorrect.' });
        return;
      }
      toastApiError(error, 'Le mot de passe n’a pas pu être changé.');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRoundIcon className="size-4" aria-hidden="true" />
          Mot de passe
        </CardTitle>
        <CardDescription>Vous restez connecté après le changement.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="flex max-w-sm flex-col gap-4"
          onSubmit={(event) => {
            void handleSubmit((values) => {
              mutation.mutate(values);
            })(event);
          }}
        >
          <Field
            label="Mot de passe actuel"
            required
            error={formState.errors.currentPassword?.message}
          >
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="current-password"
                {...register('currentPassword')}
              />
            )}
          </Field>

          <Field
            label="Nouveau mot de passe"
            required
            description={`Entre ${String(NEW_PASSWORD_MIN_LENGTH)} et ${String(NEW_PASSWORD_MAX_LENGTH)} caractères.`}
            error={formState.errors.newPassword?.message}
          >
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="new-password"
                {...register('newPassword')}
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

          <Button type="submit" className="self-start" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Changer le mot de passe
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
