import { Link, useLocation } from '@tanstack/react-router';
import { LayoutGridIcon, MenuIcon } from 'lucide-react';
import { useState } from 'react';

import { IndicateurDirect } from '@/components/coque/flux';
import { NotificationBell } from '@/components/coque/notification-bell';
import { SidebarNav } from '@/components/coque/sidebar-nav';
import { ThemeToggle } from '@/components/coque/theme-toggle';
import { UserMenu } from '@/components/coque/user-menu';
import { BoutonExportGlobal } from '@/components/exports/liens';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { hasInbox, HUB_PATH, inboxPathFor, lien, navTitle } from '@/lib/nav';
import type { SessionUser } from '@/lib/types';

export function Topbar({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

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
        {navTitle(user.role, pathname)}
      </h1>

      <IndicateurDirect className="hidden md:inline-flex" />

      {/* Sous 768 px, « Tous les espaces » reste joignable par le pied de la
          navigation mobile, et l'export global attend l'écran suivant. */}
      <div className="hidden md:block">
        <BoutonExportGlobal role={user.role} />
      </div>

      <div className="hidden md:block">
        <Link
          {...lien(`${HUB_PATH}?retour=${encodeURIComponent(pathname)}`)}
          className={buttonVariants({ variant: 'ghost', className: 'h-11 gap-2 px-3' })}
        >
          <LayoutGridIcon className="size-5" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Espaces</span>
        </Link>
      </div>

      {/* La cloche ne se montre qu'aux rôles qui ont une boîte de réception à ouvrir. */}
      {hasInbox(user.role) ? <NotificationBell href={inboxPathFor(user.role)} /> : null}
      <ThemeToggle />
      <UserMenu user={user} />
    </header>
  );
}
