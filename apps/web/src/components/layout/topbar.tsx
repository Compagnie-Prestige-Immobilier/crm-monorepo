'use client';

import { MenuIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { navTitle } from '@/components/layout/nav-items';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { SessionUser } from '@/lib/types';

export function Topbar({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const title = navTitle(user.role, pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur-sm">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Ouvrir la navigation"
            />
          }
        >
          <MenuIcon className="size-5" aria-hidden="true" />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[17rem] border-r-0 bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Navigation principale</SheetTitle>
          <SidebarNav
            role={user.role}
            onNavigate={() => {
              setOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      <h1 className="min-w-0 flex-1 truncate font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
        {title}
      </h1>

      {/* La cloche n'est montée que pour les rôles dont les notifications
          pointent vers un écran du panel : l'ADMIN (demandes de création de
          client, rappels système) et l'agent BANQUE_FINANCE (réponse à ses
          demandes, dossiers sans mouvement). Celles d'un téléconseiller visent
          l'application mobile, et sa console n'en affiche aucune. */}
      {user.role === 'COMMERCIAL' ? null : <NotificationBell />}
      <ThemeToggle />
      <UserMenu user={user} />
    </header>
  );
}
