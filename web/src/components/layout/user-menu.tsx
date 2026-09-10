'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDownIcon,
  FlaskConicalIcon,
  HeadsetIcon,
  KeyRoundIcon,
  LogOutIcon,
  PhoneCallIcon,
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
import { fetchOuvertureCourante, type OuvertureFiche } from '@/lib/data/ouvertures';
import { initials } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { peutTenirUneFiche, ROLE_LABELS, type SessionUser } from '@/lib/types';
import { useVerrouFiches } from '@/lib/use-verrou-fiches';
import { ficheTenue } from '@/lib/use-verrou-navigation';

/**
 * EB-08 : la fiche tenue se libère par une qualification, ou par un superviseur.
 * Se déconnecter la laisserait verrouillée sur le serveur, hors de vue.
 */
const SOUS_VERROU =
  'Vous avez une fiche en main. Qualifiez-la, ou demandez à un superviseur de la libérer.';

/** L'écran où la fiche se reprend : les deux consoles rouvrent seules ce que le serveur tient. */
const ecranDe = (ouverture: OuvertureFiche) =>
  ouverture.representantId === null
    ? { href: '/chues/console', Icone: HeadsetIcon }
    : { href: '/chues/appels-representants', Icone: PhoneCallIcon };

export function UserMenu({ user, demoEnabled }: { user: SessionUser; demoEnabled: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<'workspace' | 'logout' | null>(null);

  // EB-08 : `ficheTenue()` ne connaît le verrou que si une console est à
  // l'écran. Après un rechargement sur une page tierce, seul le serveur sait
  // encore que la fiche est en main.
  const ouverture = useQuery({
    queryKey: queryKeys.ouvertureCourante,
    queryFn: () => fetchOuvertureCourante(),
    enabled: peutTenirUneFiche(user.role),
    refetchOnWindowFocus: true,
  });
  const tenue = ouverture.data ?? null;
  const verrouActif = useVerrouFiches();
  const sousVerrou = (): boolean => verrouActif && (ficheTenue() || tenue !== null);
  let workspaceLabel = 'Ouvrir l’espace démo';
  if (user.workspace === 'demo') workspaceLabel = 'Quitter l’espace démo';
  if (pending === 'workspace') workspaceLabel = 'Changement d’espace…';

  async function switchWorkspace(): Promise<void> {
    // L'écran resterait sur la fiche, mais son ouverture appartient à l'espace
    // qu'on vient de quitter : la qualification n'aurait plus où atterrir.
    if (sousVerrou()) {
      toast.error(SOUS_VERROU);
      return;
    }
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
    if (sousVerrou()) {
      toast.error(SOUS_VERROU);
      return;
    }
    setPending('logout');
    try {
      // L'API efface elle-même le cookie de session : pas de relais Next entre les deux.
      const response = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Origin: window.location.origin },
      });
      if (!response.ok) throw new Error('logout failed');
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
        {tenue === null ? null : <FicheEnMain ouverture={tenue} />}
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

/** Le retour vers la fiche tenue : la refuser sans dire où elle est ferait chercher. */
function FicheEnMain({ ouverture }: { ouverture: OuvertureFiche }) {
  const { href, Icone } = ecranDe(ouverture);
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem render={<Link href={href} />}>
        <Icone aria-hidden="true" />
        <span className="truncate">Reprendre la fiche de {ouverture.ficheNom}</span>
      </DropdownMenuItem>
    </>
  );
}
