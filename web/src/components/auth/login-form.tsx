'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircleIcon, LoaderIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useForm, type FieldErrors, type UseFormRegister } from 'react-hook-form';

import { meQueryOptions } from '@/api/auth';
import { resetSessionExpiryGuard } from '@/lib/api/session-expiry';
import { homePathForRole } from '@/components/layout/nav-items';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { loginSchema, type LoginInput } from '@/lib/schemas';
import { ROLE_LABELS, type Role, type SessionUser } from '@/lib/types';
import { apiErrorMessage } from '@/lib/utils';

function roleOf(payload: unknown): Role {
  if (typeof payload !== 'object' || payload === null || !('user' in payload)) return 'ADMIN';
  const { user } = payload as { user?: unknown };
  if (typeof user !== 'object' || user === null || !('role' in user)) return 'ADMIN';
  const { role } = user as { role?: unknown };
  return typeof role === 'string' && role in ROLE_LABELS ? (role as Role) : 'ADMIN';
}

const COOKIE_BASE = 'cpi_base';
const BASE_PUBLIQUE = 'public';
const DEMO_ROLES = [
  'ADMIN',
  'SUPERVISEUR',
  'COMMERCIAL',
  'BANQUE_FINANCE',
  'DIRECTION',
  'ACCUEIL',
  'CHARGE_CLIENTELE',
] as const satisfies readonly Role[];

function baseCourante(): string {
  const valeur = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${COOKIE_BASE}=`))
    ?.slice(COOKIE_BASE.length + 1);
  return valeur === undefined || valeur === '' ? BASE_PUBLIQUE : valeur;
}

/** Le serveur lit ce cookie sur chaque requête et ne sert que les bases qu'il connaît. */
function choisirBase(nom: string): void {
  document.cookie = `${COOKIE_BASE}=${nom}; path=/; max-age=31536000; SameSite=Lax`;
}

function CredentialsFields({
  register,
  errors,
}: {
  register: UseFormRegister<LoginInput>;
  errors: FieldErrors<LoginInput>;
}) {
  return (
    <>
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
    </>
  );
}

function DemoProfileField({ role, onChange }: { role: Role; onChange: (role: Role) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="demo-role">Profil démo</Label>
      <Select
        value={role}
        onValueChange={(value) => {
          if (typeof value === 'string' && DEMO_ROLES.includes(value as Role))
            onChange(value as Role);
        }}
        items={DEMO_ROLES.map((demoRole) => ({ value: demoRole, label: ROLE_LABELS[demoRole] }))}
      >
        <SelectTrigger id="demo-role" aria-label="Profil démo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEMO_ROLES.map((demoRole) => (
            <SelectItem key={demoRole} value={demoRole}>
              {ROLE_LABELS[demoRole]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function LoginForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [bases, setBases] = useState<string[] | null>(null);
  const [base, setBase] = useState(baseCourante);
  const [demoRole, setDemoRole] = useState<Role>('ADMIN');

  useEffect(() => {
    resetSessionExpiryGuard();
    async function chargerBases(): Promise<void> {
      const response = await fetch('/api/v1/auth/bases', { credentials: 'same-origin' });
      if (!response.ok) return;
      const payload = (await response.json()) as { bases: string[] };
      setBases(payload.bases);
    }
    // Une base autre que la publique se voit d'emblée : on sait où l'on se connecte.
    if (baseCourante() !== BASE_PUBLIQUE) void chargerBases();
    function surTouche(event: KeyboardEvent): void {
      if (
        !(event.ctrlKey || event.metaKey) ||
        !event.shiftKey ||
        !['D', 'N'].includes(event.key.toUpperCase())
      )
        return;
      event.preventDefault();
      void chargerBases();
    }
    window.addEventListener('keydown', surTouche);
    return () => {
      window.removeEventListener('keydown', surTouche);
    };
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
      // L'API pose elle-même le cookie de session : pas de relais Next entre les deux.
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        setServerError(apiErrorMessage(payload, 'Connexion impossible pour le moment.'));
        return;
      }

      const payload: unknown = await response.json().catch(() => null);
      queryClient.setQueryData(
        meQueryOptions.queryKey,
        ((payload as { user?: unknown } | null)?.user ?? null) as SessionUser | null,
      );
      router.replace(next != null && next !== '' ? next : homePathForRole(roleOf(payload)));
    } catch {
      setServerError('Le serveur est injoignable. Vérifiez votre connexion.');
    }
  }

  async function onDemoSubmit(): Promise<void> {
    setServerError(null);
    try {
      const response = await fetch('/api/v1/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ role: demoRole }),
      });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        setServerError(apiErrorMessage(payload, 'La base de démonstration est indisponible.'));
        return;
      }

      const payload: unknown = await response.json().catch(() => null);
      queryClient.setQueryData(
        meQueryOptions.queryKey,
        ((payload as { user?: unknown } | null)?.user ?? null) as SessionUser | null,
      );
      router.replace(next != null && next !== '' ? next : homePathForRole(demoRole));
    } catch {
      setServerError('Le serveur est injoignable. Vérifiez votre connexion.');
    }
  }

  return (
    <form
      noValidate
      // Avant hydratation, un envoi natif partirait en GET avec le mot de passe dans l'URL.
      method="post"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        if (base !== BASE_PUBLIQUE) {
          event.preventDefault();
          void onDemoSubmit();
          return;
        }
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

      {base === BASE_PUBLIQUE ? (
        <CredentialsFields register={register} errors={errors} />
      ) : (
        <DemoProfileField role={demoRole} onChange={setDemoRole} />
      )}

      {bases === null ? null : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="base">Base</Label>
          <Select
            value={base}
            onValueChange={(valeur) => {
              if (valeur === null) return;
              choisirBase(valeur);
              setBase(valeur);
            }}
          >
            <SelectTrigger id="base" aria-label="Base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bases.map((nom) => (
                <SelectItem key={nom} value={nom}>
                  {nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
