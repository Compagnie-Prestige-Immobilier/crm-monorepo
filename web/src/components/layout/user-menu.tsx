'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronDownIcon,
  FlaskConicalIcon,
  KeyRoundIcon,
  LogOutIcon,
  UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { initials } from '@/lib/format';
import { ROLE_LABELS, type SessionUser } from '@/lib/types';

export function UserMenu({ user, demoEnabled }: { user: SessionUser; demoEnabled: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<'workspace' | 'logout' | null>(null);

  let workspaceLabel = 'Ouvrir l’espace démo';
  if (user.workspace === 'demo') workspaceLabel = 'Quitter l’espace démo';
  if (pending === 'workspace') workspaceLabel = 'Changement d’espace…';

  async function switchWorkspace(): Promise<void> {
    // L'écran resterait sur la fiche, mais son ouverture appartient à l'espace
    // qu'on vient de quitter : la qualification n'aurait plus où atterrir.
    setPending('workspace');
    try {
      const workspace = user.workspace === 'demo' ? 'public' : 'demo';
      const response = await fetch('/api/auth/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace }),
      });
      if (!response.ok) throw new Error('workspace switch failed');
      router.refresh();
      setPending(null);
    } catch {
      toast.error('Le changement d’espace a échoué. Réessayez.');
      setPending(null);
    }
  }

  async function signOut(): Promise<void> {
    setPending('logout');
    try {
      // L'API efface elle-même le cookie de session : pas de relais Next entre les deux.
      const response = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Origin: window.location.origin },
      });
      if (!response.ok) throw new Error('logout failed');
      // Un téléphone se partage : le compte suivant ne doit rien lire du précédent.
      queryClient.clear();
      queryClient.setQueryData(meQueryOptions.queryKey, null);
      router.replace('/connexion');
    } catch {
      toast.error('La déconnexion a échoué. Réessayez.');
      setPending(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-11 gap-2 px-2"
            aria-label={`Compte de ${user.fullName}`}
          />
        }
      >
        <Avatar className="size-8">
          <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-[10rem] truncate text-left text-[0.875rem] sm:block">
          {user.fullName}
        </span>
        {user.workspace === 'public' ? null : <Badge variant="warning">{user.workspace}</Badge>}
        <ChevronDownIcon className="size-4 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate text-[0.875rem] font-[600] text-foreground">
            {user.fullName}
          </span>
          <span className="block truncate font-[400] text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon aria-hidden="true" />
          {ROLE_LABELS[user.role]}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/compte" />}>
          <KeyRoundIcon aria-hidden="true" />
          Mot de passe
        </DropdownMenuItem>
        {demoEnabled ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={pending !== null}
              closeOnClick={false}
              onClick={() => {
                void switchWorkspace();
              }}
            >
              <FlaskConicalIcon aria-hidden="true" />
              {workspaceLabel}
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending !== null}
          closeOnClick={false}
          onClick={() => {
            void signOut();
          }}
        >
          <LogOutIcon aria-hidden="true" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
