import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

import { meQueryOptions } from '@/api/auth';
import { EcranErreurPleinePage } from '@/components/etats-router';
import { DemoBanner } from '@/components/layout/demo-banner';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { LiveStream } from '@/components/live/live-stream';

export const Route = createFileRoute('/_hub')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (user === null) throw redirect({ to: '/connexion', search: { suite: location.href } });
    return { user };
  },
  component: Hub,
  errorComponent: EcranErreurPleinePage,
});

/** Le layout `(hub)` de la v1 : aucune coque, la palette est celle de CPI. */
function Hub() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex min-h-dvh flex-col">
      <LiveStream />
      <DemoBanner user={user} />
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4 md:px-6">
        <img
          src="/brand/cpi-header.webp"
          alt="CPI GO"
          width={312}
          height={128}
          className="h-8 w-auto"
        />
        <div className="flex-1" />
        <ThemeToggle />
        <UserMenu user={user} demoEnabled={false} />
      </header>
      <main id="contenu-principal" className="flex-1 px-4 py-8 md:px-6 md:py-12">
        <Outlet />
      </main>
    </div>
  );
}
