import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AlertCircleIcon, LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { apiClient } from '@/api/client';
import { meQueryOptions } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cheminInterne, homePathForRole } from '@/lib/nav';
import { loginSchema, type LoginInput } from '@/lib/schemas';
import { apiErrorMessage } from '@/lib/utils';

export function LoginForm({ next }: { next?: string | undefined }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  async function onSubmit(values: LoginInput): Promise<void> {
    setServerError(null);
    try {
      const { data, error } = await apiClient.POST('/api/v1/auth/login', { body: values });

      if (error) {
        setServerError(apiErrorMessage(error, 'Connexion impossible pour le moment.'));
        return;
      }

      queryClient.setQueryData(meQueryOptions.queryKey, data.user);
      await navigate({ href: cheminInterne(next) ?? homePathForRole(data.user.role) });
    } catch {
      setServerError('Le serveur est injoignable. Vérifiez votre connexion.');
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
      className="flex flex-col gap-5"
    >
      {serverError !== null ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.8125rem] text-destructive"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {serverError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="identifier">E-mail ou identifiant</Label>
        <Input
          id="identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={errors.identifier !== undefined}
          aria-describedby={errors.identifier !== undefined ? 'identifier-error' : undefined}
          {...register('identifier')}
        />
        {errors.identifier !== undefined ? (
          <p id="identifier-error" role="alert" className="text-[0.75rem] text-destructive">
            {errors.identifier.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password !== undefined}
          aria-describedby={errors.password !== undefined ? 'password-error' : undefined}
          {...register('password')}
        />
        {errors.password !== undefined ? (
          <p id="password-error" role="alert" className="text-[0.75rem] text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            Connexion…
          </>
        ) : (
          'Se connecter'
        )}
      </Button>
    </form>
  );
}
