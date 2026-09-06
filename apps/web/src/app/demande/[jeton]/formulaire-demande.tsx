'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircleIcon, CheckCircle2Icon, LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { demandePubliqueSchema, type DemandePubliqueInput } from '@/lib/schemas';
import { apiErrorMessage } from '@/lib/utils';

const VIDE: DemandePubliqueInput = {
  prenom: '',
  nom: '',
  phone: '',
  email: '',
  profession: '',
  employeur: '',
  message: '',
  site: '',
};

export function FormulaireDemande({ jeton }: { jeton: string }) {
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DemandePubliqueInput>({
    resolver: zodResolver(demandePubliqueSchema),
    defaultValues: VIDE,
  });

  async function envoyer(valeurs: DemandePubliqueInput): Promise<void> {
    setErreur(null);
    try {
      const reponse = await fetch(`/api/demande/${encodeURIComponent(jeton)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valeurs),
      });
      if (!reponse.ok) {
        const charge: unknown = await reponse.json().catch(() => null);
        setErreur(apiErrorMessage(charge, 'Votre demande n’a pas pu être envoyée.'));
        return;
      }
      setEnvoye(true);
    } catch {
      setErreur('Le serveur est injoignable. Vérifiez votre connexion.');
    }
  }

  if (envoye) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <CheckCircle2Icon className="size-8 text-success" aria-hidden="true" />
        <h2 className="font-display text-h2 font-[700]">Votre demande est enregistrée</h2>
        <p className="text-body text-muted-foreground">
          Un conseiller CPI vous rappelle sur le numéro que vous avez laissé. Si vous avez indiqué
          une adresse e-mail, un accusé de réception vient de vous être envoyé.
        </p>
      </div>
    );
  }

  return (
    <form
      noValidate
      method="post"
      onSubmit={(evenement) => {
        void handleSubmit(envoyer)(evenement);
      }}
      className="flex flex-col gap-5"
    >
      {erreur !== null ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.8125rem] text-destructive"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {erreur}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Prénom" required error={errors.prenom?.message}>
          {(props) => <Input {...props} autoComplete="given-name" {...register('prenom')} />}
        </Field>
        <Field label="Nom" required error={errors.nom?.message}>
          {(props) => <Input {...props} autoComplete="family-name" {...register('nom')} />}
        </Field>
      </div>

      <Field label="Téléphone" required error={errors.phone?.message}>
        {(props) => (
          <Input {...props} type="tel" inputMode="tel" autoComplete="tel" {...register('phone')} />
        )}
      </Field>

      <Field
        label="E-mail"
        error={errors.email?.message}
        description="Pour recevoir un accusé de réception."
      >
        {(props) => <Input {...props} type="email" autoComplete="email" {...register('email')} />}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Profession" error={errors.profession?.message}>
          {(props) => <Input {...props} {...register('profession')} />}
        </Field>
        <Field label="Employeur" error={errors.employeur?.message}>
          {(props) => <Input {...props} {...register('employeur')} />}
        </Field>
      </div>

      <Field label="Votre message" error={errors.message?.message}>
        {(props) => <Textarea {...props} rows={4} {...register('message')} />}
      </Field>

      {/* Piège à robots : hors de l'écran et hors du parcours au clavier, un
          automate le remplit et son envoi est ignoré. */}
      <input
        {...register('site')}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="sr-only"
      />

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting ? (
          <>
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            Envoi…
          </>
        ) : (
          'Envoyer ma demande'
        )}
      </Button>
    </form>
  );
}
