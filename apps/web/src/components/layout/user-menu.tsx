'use client';

import { ChevronDownIcon, LogOutIcon, UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut(): Promise<void> {
    setPending(true);
    try {
      // La déconnexion passe par le Route Handler : lui seul peut effacer un
      // cookie httpOnly. Le client n'a jamais eu le jeton en main.
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('logout failed');
      router.replace('/connexion');
      router.refresh();
    } catch {
      toast.error('La déconnexion a échoué. Réessayez.');
      setPending(false);
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
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
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
