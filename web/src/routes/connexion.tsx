import { createFileRoute, redirect } from '@tanstack/react-router';
import { InfoIcon } from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';

import { meQueryOptions } from '@/api/auth';

// Absent du bundle de production : seul `make build` pose VITE_BASCULE_ROLES.
const DevRoleButtons =
  import.meta.env.VITE_BASCULE_ROLES === '1'
    ? lazy(() =>
        import('@/components/auth/dev-role-switcher').then((m) => ({ default: m.DevRoleButtons })),
      )
    : null;
import { Facade } from '@/components/auth/facade';
import { LoginForm } from '@/components/auth/login-form';
import { homePathForRole } from '@/components/layout/nav-items';
import { SESSION_EXPIRED_PARAM, SESSION_EXPIRED_VALUE } from '@/lib/api/session-expiry';
import { cheminInterne } from '@/lib/nav';

export const Route = createFileRoute('/connexion')({
  validateSearch: (search: Record<string, unknown>): { suite?: string; session?: string } => {
    const suite = cheminInterne(search.suite);
    const session = search[SESSION_EXPIRED_PARAM];
    return {
      ...(suite === undefined ? {} : { suite }),
      ...(session === SESSION_EXPIRED_VALUE ? { session: SESSION_EXPIRED_VALUE } : {}),
    };
  },
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (user !== null) throw redirect({ href: homePathForRole(user.role) });
  },
  component: ConnexionPage,
});

/** La page `(auth)/connexion` de la v1, sans le relais Next : le cookie vient de l'API. */
function ConnexionPage() {
  const { suite, session } = Route.useSearch();
  const expired = session === SESSION_EXPIRED_VALUE;
  useEffect(() => {
    document.title = 'Connexion · CPI GO';
  }, []);

  return (
    <main id="contenu-principal" className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-center overflow-hidden bg-sidebar px-12 py-12 text-sidebar-foreground lg:flex">
        <Facade />
        <img
          src="/brand/cpi-header.webp"
          alt="CPI"
          width={312}
          height={128}
          className="absolute left-12 top-12 h-12 w-auto self-start"
        />
        <div className="max-w-lg">
          <p className="font-display text-[clamp(2.5rem,5vw,3.75rem)] font-[800] leading-[0.95] tracking-[-0.035em] text-sidebar-accent-foreground">
            CPI GO
          </p>
          <p className="mt-5 text-body-xl text-sidebar-foreground">
            Prospects, appels consignés et dossiers bancaires.
          </p>
        </div>
        <p className="absolute inset-x-12 bottom-12 text-caption text-sidebar-foreground">
          Compagnie Prestige Immobilier, Sénégal
        </p>
      </section>

      <section className="flex items-center justify-center bg-background px-6 py-12">
        <div className="animate-rise w-full max-w-[26rem]">
          <img
            src="/brand/cpi-logo.png"
            alt="CPI GO"
            width={417}
            height={170}
            className="mb-10 h-11 w-auto lg:hidden"
          />

          <div className="rail">
            <h1 className="font-display text-h1 font-[800] tracking-[-0.025em]">Connexion</h1>
            <p className="mt-1.5 text-body text-muted-foreground">
              Accédez à vos espaces de travail
            </p>
          </div>

          {expired ? (
            <p
              role="status"
              className="mt-8 flex items-start gap-2 rounded-md border border-accent-border/40 bg-accent-surface px-3.5 py-3 text-small text-warning"
            >
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Session expirée. Reconnectez-vous.
            </p>
          ) : null}

          <div className="mt-8">
            {DevRoleButtons ? (
              <Suspense fallback={null}>
                <DevRoleButtons next={suite ?? null} className="mb-6" />
              </Suspense>
            ) : null}
            <LoginForm next={suite ?? null} />
          </div>
        </div>
      </section>
    </main>
  );
}
