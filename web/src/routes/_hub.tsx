import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

import { meQueryOptions } from '@/api/auth';
import { Flux } from '@/components/coque/flux';
import { ThemeToggle } from '@/components/coque/theme-toggle';
import { UserMenu } from '@/components/coque/user-menu';
import { EcranErreurPleinePage } from '@/components/etats-router';

export const Route = createFileRoute('/_hub')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (user === null) throw redirect({ to: '/connexion', search: { next: location.href } });
    return { user };
  },
  component: Hub,
  errorComponent: EcranErreurPleinePage,
});

/** Le hub ne porte aucune coque : sa palette est celle de CPI. */
function Hub() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex min-h-dvh flex-col">
      <Flux />
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4 md:px-6">
        <img src="/brand/cpi-header.png" alt="CPI GO" className="h-8 w-auto" />
        <div className="flex-1" />
        <ThemeToggle />
        <UserMenu user={user} />
      </header>
      <main id="contenu-principal" className="flex-1 px-4 py-8 md:px-6 md:py-12">
        <Outlet />
      </main>
    </div>
  );
}
