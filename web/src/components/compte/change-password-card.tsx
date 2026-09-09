import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { KeyRoundIcon, LoaderIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from '@/lib/zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePassword } from '@/lib/data/auth';
import { apiErrorCode, toastApiError } from '@/lib/mutation-feedback';

const MIN_LENGTH = 8;
const MAX_LENGTH = 24;

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Le mot de passe actuel est obligatoire.'),
    newPassword: z
      .string()
      .min(MIN_LENGTH, `Le nouveau mot de passe compte au moins ${String(MIN_LENGTH)} caractères.`)
      .max(MAX_LENGTH, `Le nouveau mot de passe compte au plus ${String(MAX_LENGTH)} caractères.`),
    confirmation: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmation, {
    message: 'Les deux mots de passe diffèrent.',
    path: ['confirmation'],
  });

type FormInput = z.infer<typeof schema>;

function Field({
  id,
  label,
  autoComplete,
  error,
  register,
}: {
  id: keyof FormInput;
  label: string;
  autoComplete: string;
  error: string | undefined;
  register: ReturnType<typeof useForm<FormInput>>['register'];
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? `${id}-error` : undefined}
        {...register(id)}
      />
      {error !== undefined ? (
        <p id={`${id}-error`} role="alert" className="text-[0.75rem] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ChangePasswordCard() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmation: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormInput) => changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      reset({ currentPassword: '', newPassword: '', confirmation: '' });
      toast.success('Mot de passe changé.');
    },
    onError: (error) => {
      if (apiErrorCode(error) === 'INVALID_CREDENTIALS') {
        setError('currentPassword', { message: 'Le mot de passe actuel est incorrect.' });
        return;
      }
      toastApiError(error, 'Le mot de passe n’a pas pu être changé.');
    },
  });

  return (
    <Card className="mx-auto max-w-md">
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
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void handleSubmit((values) => {
              mutation.mutate(values);
            })(event);
          }}
        >
          <Field
            id="currentPassword"
            label="Mot de passe actuel"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            register={register}
          />
          <Field
            id="newPassword"
            label="Nouveau mot de passe"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            register={register}
          />
          <Field
            id="confirmation"
            label="Confirmation"
            autoComplete="new-password"
            error={errors.confirmation?.message}
            register={register}
          />

          <Button type="submit" className="self-start" disabled={isSubmitting}>
            {isSubmitting ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Changer le mot de passe
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
