'use client';

import { LayoutGridIcon, MenuIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { hasInbox, HUB_PATH, inboxPathFor, navTitle } from '@/components/layout/nav-items';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Button, buttonVariants } from '@/components/ui/button';
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

      <Link
        href={`${HUB_PATH}?retour=${encodeURIComponent(pathname)}`}
        className={buttonVariants({ variant: 'ghost', className: 'h-11 gap-2 px-3' })}
      >
        <LayoutGridIcon className="size-5" aria-hidden="true" />
        <span className="hidden sm:block">Espaces</span>
      </Link>

      {/* La cloche ne se montre qu'aux rôles qui ont une boîte de réception à
          ouvrir : `INBOX_ROLES`. La montrer plus largement menait « Tout voir »
          droit sur un refus de permission. */}
      {hasInbox(user.role) ? <NotificationBell href={inboxPathFor(user.role)} /> : null}
      <ThemeToggle />
      <UserMenu user={user} />
    </header>
  );
}
