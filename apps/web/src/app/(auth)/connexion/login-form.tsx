'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircleIcon, LoaderIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { resetSessionExpiryGuard } from '@/lib/api/session-expiry';
import { homePathForRole } from '@/components/layout/nav-items';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginSchema, type LoginInput } from '@/lib/schemas';
import { ROLE_LABELS, type Role } from '@/lib/types';
import { apiErrorMessage } from '@/lib/utils';

/**
 * Rôle lu dans `{ user: { role } }`, sans faire confiance à la forme.
 *
 * La réponse peut être un 502 d'un proxy ou un corps vide : on ne parse pas un
 * `unknown` en `SessionUser` par assertion. Un rôle illisible retombe sur
 * ADMIN, dont l'écran d'accueil est celui que le layout serveur autorisera ou
 * refusera de toute façon — il n'y a donc pas d'escalade de droits ici.
 */
function roleOf(payload: unknown): Role {
  if (typeof payload !== 'object' || payload === null || !('user' in payload)) return 'ADMIN';
  const { user } = payload as { user?: unknown };
  if (typeof user !== 'object' || user === null || !('role' in user)) return 'ADMIN';
  const { role } = user as { role?: unknown };
  return typeof role === 'string' && role in ROLE_LABELS ? (role as Role) : 'ADMIN';
}

/**
 * `next` : écran d'où l'utilisateur a été éjecté par une session expirée. Déjà
 * validé comme chemin interne par la page serveur — ne jamais y injecter une
 * URL absolue, ce qui ferait de cet écran une redirection ouverte.
 */
export function LoginForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  // L'utilisateur est de retour sur le formulaire : la garde anti-boucle de
  // `redirectToLogin()` doit être relâchée, sinon une seconde expiration dans
  // le même onglet ne redirigerait plus.
  useEffect(() => {
    resetSessionExpiryGuard();
  }, []);

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
      // Le corps part vers le Route Handler, PAS vers le backend. La réponse ne
      // contient aucun jeton : ils sont posés en cookies httpOnly côté serveur.
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        setServerError(apiErrorMessage(payload, 'Connexion impossible pour le moment.'));
        return;
      }

      /**
       * L'écran d'arrivée dépend du RÔLE.
       *
       * Un agent Banque & Finance envoyé sur `/tableau-de-bord` verrait le
       * tableau de bord des prospects, auquel l'API lui répond 403 : sa
       * première impression du panel serait un refus de droits. Il atterrit
       * donc sur ses dossiers. Le rôle est lu dans la réponse du Route
       * Handler — jamais dans un jeton, que ce code n'a pas et ne doit pas
       * avoir.
       */
      const payload: unknown = await response.json().catch(() => null);
      router.replace(next != null && next !== '' ? next : homePathForRole(roleOf(payload)));
      // Sans `refresh()`, le layout serveur du panel resterait celui rendu
      // avant la pose du cookie, et renverrait vers la page de connexion.
      router.refresh();
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
          placeholder="admin@cpi.sn"
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
