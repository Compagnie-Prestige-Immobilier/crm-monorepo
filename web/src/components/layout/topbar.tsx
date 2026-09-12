'use client';

import { LayoutGridIcon, MenuIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { DevRoleSwitcher } from '@/components/auth/dev-role-switcher';
import {
  COQUES,
  coqueOf,
  hasInbox,
  HUB_PATH,
  inboxPathFor,
  navTitle,
} from '@/components/layout/nav-items';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { GlobalExportButton } from '@/components/exports/global-export-button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { SessionUser } from '@/lib/types';

export function Topbar({ user, demoEnabled }: { user: SessionUser; demoEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Le retour du navigateur ne passe par aucun lien : le tiroir se ferme sur le changement de route.
  const [cheminDuTiroir, setCheminDuTiroir] = useState(pathname);
  if (pathname !== cheminDuTiroir) {
    setCheminDuTiroir(pathname);
    setOpen(false);
  }

  const title = navTitle(user.role, pathname);
  const coque = COQUES.find((entry) => entry.id === coqueOf(pathname));

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

      <div className="min-w-0 flex-1">
        {coque === undefined ? null : (
          <p className="eyebrow truncate text-muted-foreground">{coque.label}</p>
        )}
        <h1 className="truncate font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
          {title}
        </h1>
      </div>

      <DevRoleSwitcher currentRole={user.role} className="hidden md:block" />

      {/* Sous 768 px, la barre n'a plus la place pour ces actions secondaires :
          « Tous les espaces » reste joignable par le pied de la navigation
          mobile (`sidebar-nav.tsx`), et l'export global attend l'écran
          suivant. */}
      {['ADMIN', 'SUPERVISEUR', 'DIRECTION'].includes(user.role) ? (
        <div className="hidden md:block">
          <GlobalExportButton />
        </div>
      ) : null}

      <div className="hidden md:block">
        <Link
          href={`${HUB_PATH}?retour=${encodeURIComponent(pathname)}`}
          className={buttonVariants({ variant: 'ghost', className: 'h-11 gap-2 px-3' })}
        >
          <LayoutGridIcon className="size-5" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Espaces</span>
        </Link>
      </div>

      {/* La cloche ne se montre qu'aux rôles qui ont une boîte de réception à
          ouvrir : `INBOX_ROLES`. La montrer plus largement menait « Tout voir »
          droit sur un refus de permission. */}
      {hasInbox(user.role) ? <NotificationBell href={inboxPathFor(user.role)} /> : null}
      <ThemeToggle />
      <UserMenu user={user} demoEnabled={demoEnabled} />
    </header>
  );
}
