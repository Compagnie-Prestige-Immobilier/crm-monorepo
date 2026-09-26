'use client';

import { LayoutGridIcon, MenuIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { lazy, Suspense, useState } from 'react';

// Absent du bundle de production : seul `make build` pose VITE_BASCULE_ROLES.
const DevRoleSwitcher =
  import.meta.env.VITE_BASCULE_ROLES === '1'
    ? lazy(() =>
        import('@/components/auth/dev-role-switcher').then((m) => ({ default: m.DevRoleSwitcher })),
      )
    : null;
import { coqueOf, hasInbox, HUB_PATH, inboxPathFor, navTitle } from '@/components/layout/nav-items';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { SignalerProbleme } from '@/components/layout/signaler-probleme';
import { GlobalExportButton } from '@/components/exports/global-export-button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { peut, type SessionUser } from '@/lib/types';
import { cn } from '@/lib/utils';

export function Topbar({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const accueil = coqueOf(pathname) === 'accueil';

  const title = navTitle(user, pathname);

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex shrink-0 items-center gap-3 px-4 md:px-6',
        accueil
          ? 'cpi-navbar h-20 border-b border-white/15 text-primary-foreground'
          : 'panel-topbar h-16 border-b border-border bg-background/90 backdrop-blur-sm',
      )}
    >
      {accueil ? (
        <Link
          href={`${HUB_PATH}?retour=${encodeURIComponent(pathname)}`}
          className="hidden items-center gap-2 md:flex"
        >
          <img src="/brand/cpi-header.webp" alt="CPI" className="h-10 w-auto" />
          <span className="cpi-go-mark" aria-label="GO">
            GO
          </span>
        </Link>
      ) : null}
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
            visiteur={user}
            onNavigate={() => {
              setOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      <h1
        className={cn(
          'min-w-0 flex-1 truncate font-display text-[1.25rem] font-[700] tracking-[-0.02em]',
          accueil ? 'text-white' : 'text-foreground',
        )}
      >
        {title}
      </h1>

      {DevRoleSwitcher ? (
        <Suspense fallback={null}>
          <DevRoleSwitcher currentRole={user.role} className="hidden md:block" />
        </Suspense>
      ) : null}

      {/* Sous 768 px, la barre n'a plus la place pour ces actions secondaires :
          « Tous les espaces » reste joignable par le pied de la navigation
          mobile (`sidebar-nav.tsx`), et l'export global attend l'écran
          suivant. */}
      {peut(user, 'exports.globaux') ? (
        <div className="hidden md:block">
          <GlobalExportButton />
        </div>
      ) : null}

      <div className="hidden md:block">
        <Link
          href={`${HUB_PATH}?retour=${encodeURIComponent(pathname)}`}
          className={buttonVariants({
            variant: 'ghost',
            className: 'cpi-nav-action h-11 gap-2 px-3',
          })}
        >
          <LayoutGridIcon className="size-5" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Espaces</span>
        </Link>
      </div>

      {/* La cloche ne se montre qu'aux rôles qui ont une boîte de réception à
          ouvrir : `INBOX_ROLES`. La montrer plus largement menait « Tout voir »
          droit sur un refus de permission. */}
      {peut(user, 'support.signaler') ? (
        <div className="hidden md:block">
          <SignalerProbleme ecran={title} plateforme={peut(user, 'support.plateforme')} />
        </div>
      ) : null}
      {hasInbox(user.role) ? <NotificationBell href={inboxPathFor(user.role)} /> : null}
      <ThemeToggle />
      <UserMenu user={user} />
    </header>
  );
}
