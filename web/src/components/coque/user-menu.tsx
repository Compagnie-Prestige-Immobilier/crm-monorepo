import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronDownIcon, KeyRoundIcon, LogOutIcon, UserIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { meQueryOptions } from '@/api/auth';
import { apiClient } from '@/api/client';
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
import { ROLE_LABELS, type SessionUser } from '@/lib/types';
import { initials } from '@/lib/utils';

export function UserMenu({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function seDeconnecter(): Promise<void> {
    setPending(true);
    const { error } = await apiClient.POST('/api/v1/auth/logout');
    if (error) {
      toast.error('La déconnexion a échoué. Réessayez.');
      setPending(false);
      return;
    }
    queryClient.setQueryData(meQueryOptions.queryKey, null);
    await navigate({ to: '/connexion' });
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
        <DropdownMenuItem render={<Link to="/compte" />}>
          <KeyRoundIcon aria-hidden="true" />
          Mot de passe
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          closeOnClick={false}
          onClick={() => {
            void seDeconnecter();
          }}
        >
          <LogOutIcon aria-hidden="true" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
