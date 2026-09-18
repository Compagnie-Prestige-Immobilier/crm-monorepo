import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheckIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { meQueryOptions } from '@/api/auth';
import { homePathForRole } from '@/components/layout/nav-items';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROLE_LABELS, type Role, type SessionUser } from '@/lib/types';
import { cn } from '@/lib/utils';

const DEV_ROLES = [
  'ADMIN',
  'COMMERCIAL',
  'BANQUE_FINANCE',
  'SUPERVISEUR',
  'DIRECTION',
  'ACCUEIL',
  'CHARGE_CLIENTELE',
] as const satisfies readonly Role[];

/** Les comptes que `make db` sème : l'administrateur et les fixtures. */
const FIXTURE_IDENTIFIERS: Record<Exclude<Role, 'ADMIN'>, string> = {
  COMMERCIAL: 'fixture.awa@cpi.sn',
  BANQUE_FINANCE: 'fixture.banque@cpi.sn',
  SUPERVISEUR: 'fixture.superviseur@cpi.sn',
  DIRECTION: 'fixture.direction@cpi.sn',
  ACCUEIL: 'fixture.accueil@cpi.sn',
  CHARGE_CLIENTELE: 'fixture.clientele@cpi.sn',
};

function accountForRole(role: Role): { identifier: string; password: string } {
  if (role === 'ADMIN') {
    return {
      identifier: import.meta.env.VITE_SEED_ADMIN_EMAIL ?? 'admin@cpi.sn',
      password: import.meta.env.VITE_SEED_ADMIN_PASSWORD ?? 'admin-local-2026',
    };
  }
  return {
    identifier: FIXTURE_IDENTIFIERS[role],
    password: import.meta.env.VITE_SEED_FIXTURE_PASSWORD ?? 'ChangeMoi123456',
  };
}

/** Le poste de développement : Vite, ou le binaire construit et ouvert sur la machine. */
export function accesDeveloppeur(): boolean {
  return import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function useDevLogin(next: string | null | undefined) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loginAs = useCallback(
    async (targetRole: Role): Promise<void> => {
      setPending(targetRole);
      setError(null);
      try {
        await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' });
        const response = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(accountForRole(targetRole)),
        });
        if (!response.ok) throw new Error('dev login failed');
        const payload = (await response.json()) as { user: SessionUser };
        queryClient.setQueryData(meQueryOptions.queryKey, payload.user);
        await queryClient.invalidateQueries();
        router.replace(next != null && next !== '' ? next : homePathForRole(payload.user.role));
      } catch {
        setError('Le compte dev est indisponible. Lancez `make db` puis réessayez.');
        setPending(null);
      }
    },
    [next, queryClient, router],
  );

  return { loginAs, pending, error };
}

/** Sur la page de connexion : un bouton par rôle, une connexion en un clic. */
export function DevRoleButtons({ next, className }: { next?: string | null; className?: string }) {
  const { loginAs, pending, error } = useDevLogin(next);
  if (!accesDeveloppeur()) return null;

  return (
    <div
      className={cn(
        'rounded-md border border-accent-border/50 bg-accent-surface/50 p-3',
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-[0.75rem] font-[600] text-warning">
        <ShieldCheckIcon className="size-4" aria-hidden="true" />
        Accès développeur : se connecter comme
      </div>
      <div className="flex flex-wrap gap-2">
        {DEV_ROLES.map((role) => (
          <Button
            key={role}
            type="button"
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() => {
              void loginAs(role);
            }}
          >
            {pending === role ? 'Connexion…' : ROLE_LABELS[role]}
          </Button>
        ))}
      </div>
      {error !== null ? (
        <p role="alert" className="mt-2 text-[0.75rem] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Dans la barre supérieure : la liste des rôles pour changer de compte sans quitter l'écran. */
export function DevRoleSwitcher({
  currentRole,
  enabled = accesDeveloppeur(),
  next,
  className,
}: {
  currentRole: Role;
  enabled?: boolean;
  next?: string | null;
  className?: string;
}) {
  const { loginAs, pending, error } = useDevLogin(next);
  const [selectedRole, setSelectedRole] = useState<Role>(currentRole);

  if (!enabled) return null;

  return (
    <div
      className={cn(
        'rounded-md border border-accent-border/50 bg-accent-surface/50 p-3',
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-[0.75rem] font-[600] text-warning">
        <ShieldCheckIcon className="size-4" aria-hidden="true" />
        Accès développeur
      </div>
      <Select
        value={selectedRole}
        onValueChange={(value) => {
          if (typeof value === 'string' && DEV_ROLES.includes(value as Role)) {
            setSelectedRole(value as Role);
            void loginAs(value as Role);
          }
        }}
        items={DEV_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }))}
      >
        <SelectTrigger aria-label="Choisir un rôle dev" size="sm" disabled={pending !== null}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEV_ROLES.map((value) => (
            <SelectItem key={value} value={value}>
              {ROLE_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending !== null ? (
        <p className="mt-2 text-[0.75rem] text-muted-foreground">Connexion…</p>
      ) : null}
      {error !== null ? (
        <p role="alert" className="mt-2 text-[0.75rem] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
