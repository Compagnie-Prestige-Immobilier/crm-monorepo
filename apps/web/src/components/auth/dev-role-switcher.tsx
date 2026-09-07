'use client';

import { ShieldCheckIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { homePathForRole } from '@/components/layout/nav-items';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROLE_LABELS, type Role } from '@/lib/types';
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

function roleFromPayload(payload: unknown, fallback: Role): Role {
  if (typeof payload !== 'object' || payload === null || !('user' in payload)) return fallback;
  const user = payload.user;
  if (typeof user !== 'object' || user === null || !('role' in user)) return fallback;
  return typeof user.role === 'string' && user.role in ROLE_LABELS ? (user.role as Role) : fallback;
}

export function DevRoleSwitcher({
  currentRole,
  enabled,
  next,
  className,
}: {
  currentRole: Role;
  enabled: boolean;
  next?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>(currentRole);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginAs = useCallback(
    async (targetRole: Role): Promise<void> => {
      setSelectedRole(targetRole);
      setPending(true);
      setError(null);

      try {
        const response = await fetch('/api/auth/dev-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: targetRole }),
        });
        if (!response.ok) throw new Error('dev login failed');

        const payload: unknown = await response.json().catch(() => null);
        const landedRole = roleFromPayload(payload, targetRole);
        router.replace(next != null && next !== '' ? next : homePathForRole(landedRole));
        router.refresh();
      } catch {
        setError('Le compte dev est indisponible. Lancez le seed puis réessayez.');
        setPending(false);
      }
    },
    [next, router],
  );

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
            void loginAs(value as Role);
          }
        }}
        items={DEV_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }))}
      >
        <SelectTrigger aria-label="Choisir un rôle dev" size="sm" disabled={pending}>
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
      {pending ? <p className="mt-2 text-[0.75rem] text-muted-foreground">Connexion…</p> : null}
      {error !== null ? (
        <p role="alert" className="mt-2 text-[0.75rem] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
