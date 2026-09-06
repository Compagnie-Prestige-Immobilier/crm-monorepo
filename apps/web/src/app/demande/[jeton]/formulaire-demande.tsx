'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircleIcon, CheckCircle2Icon, LoaderIcon } from 'lucide-react';
import Script from 'next/script';
import { useRef, useState } from 'react';
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

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

/** Le nom du champ caché que le widget Turnstile pose dans le formulaire. */
const TURNSTILE_CHAMP = 'cf-turnstile-response';

export function FormulaireDemande({ jeton, cleSite }: { jeton: string; cleSite: string }) {
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const formulaire = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DemandePubliqueInput>({
    resolver: zodResolver(demandePubliqueSchema),
    defaultValues: VIDE,
  });

  const msg = (champ: keyof DemandePubliqueInput): string | undefined => errors[champ]?.message;

  /**
   * Le widget pose lui-même un champ caché dans le formulaire : il est lu ici
   * plutôt que recopié dans un état, qui serait une seconde source de vérité.
   */
  function jetonAntiRobot(): string {
    const element = formulaire.current;
    if (element === null) return '';
    const valeur = new FormData(element).get(TURNSTILE_CHAMP);
    return typeof valeur === 'string' ? valeur : '';
  }

  async function envoyer(valeurs: DemandePubliqueInput): Promise<void> {
    setErreur(null);
    const turnstileToken = jetonAntiRobot();
    if (cleSite !== '' && turnstileToken === '') {
      setErreur('La vérification anti-robot n’est pas terminée. Patientez, puis renvoyez.');
      return;
    }
    try {
      const reponse = await fetch(`/api/demande/${encodeURIComponent(jeton)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...valeurs, turnstileToken }),
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
      ref={formulaire}
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
        <Field label="Prénom" required error={msg('prenom')}>
          {(props) => <Input {...props} autoComplete="given-name" {...register('prenom')} />}
        </Field>
        <Field label="Nom" required error={msg('nom')}>
          {(props) => <Input {...props} autoComplete="family-name" {...register('nom')} />}
        </Field>
      </div>

      <Field label="Téléphone" required error={msg('phone')}>
        {(props) => (
          <Input {...props} type="tel" inputMode="tel" autoComplete="tel" {...register('phone')} />
        )}
      </Field>

      <Field label="E-mail" error={msg('email')} description="Pour recevoir un accusé de réception.">
        {(props) => <Input {...props} type="email" autoComplete="email" {...register('email')} />}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Profession" error={msg('profession')}>
          {(props) => <Input {...props} {...register('profession')} />}
        </Field>
        <Field label="Employeur" error={msg('employeur')}>
          {(props) => <Input {...props} {...register('employeur')} />}
        </Field>
      </div>

      <Field label="Votre message" error={msg('message')}>
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

      {cleSite === '' ? null : (
        <>
          <Script src={TURNSTILE_SCRIPT} async defer />
          <div className="cf-turnstile" data-sitekey={cleSite} data-language="fr" />
        </>
      )}

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
