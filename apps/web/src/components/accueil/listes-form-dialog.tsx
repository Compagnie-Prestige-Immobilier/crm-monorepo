'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import {
  createVisiteReferentiel,
  updateVisiteReferentiel,
  type VisiteReferentielEntry,
  type VisiteReferentielKind,
} from '@/lib/data/visites-referentiels';

const codeField = z
  .string()
  .trim()
  .min(2, 'Le code est obligatoire.')
  .max(48, 'Code trop long.')
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9_]+$/u.test(value), 'Majuscules, chiffres et tirets bas seulement.');

const labelField = z
  .string()
  .trim()
  .min(2, 'Le libellé est obligatoire.')
  .max(120, 'Libellé trop long.');

const createSchema = z.object({ code: codeField, label: labelField });
const editSchema = z.object({ code: z.string(), label: labelField });

interface FormInput {
  code: string;
  label: string;
}

export function ListeFormDialog({
  kind,
  createTitle,
  open,
  onOpenChange,
  entry,
}: {
  kind: VisiteReferentielKind;
  /** Titre déjà accordé : « Nouvelle entreprise », « Nouvel objet »… */
  createTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: VisiteReferentielEntry | undefined;
}) {
  const queryClient = useQueryClient();
  const isEdit = entry !== undefined;

  const { register, handleSubmit, reset, formState } = useForm<FormInput>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: { code: '', label: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({ code: entry?.code ?? '', label: entry?.label ?? '' });
  }, [open, entry, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormInput) =>
      isEdit
        ? updateVisiteReferentiel(kind, entry.id, { label: values.label })
        : createVisiteReferentiel(kind, {
            code: values.code,
            label: values.label.trim(),
            sortOrder: 100,
          }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.visiteReferentielsRoot });
      toast.success(isEdit ? `${saved.label} enregistré.` : `${saved.label} ajouté.`);
      onOpenChange(false);
    },
    onError: (error) => {
      toastApiError(error, 'Enregistrement impossible. Réessayez.');
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && mutation.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Renommer « ${entry.label} »` : createTitle}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Le code reste inchangé : les visites déjà enregistrées le désignent.'
              : 'Le code est définitif, utile pour l’export.'}
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
          {isEdit ? null : (
            <Field
              label="Code"
              required
              description="Majuscules, chiffres et tirets bas. Définitif."
              error={formState.errors.code?.message}
            >
              {(props) => (
                <Input
                  {...props}
                  placeholder="SANTARGILE"
                  autoComplete="off"
                  spellCheck={false}
                  {...register('code')}
                />
              )}
            </Field>
          )}

          <Field label="Libellé" required error={formState.errors.label?.message}>
            {(props) => <Input {...props} {...register('label')} />}
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
