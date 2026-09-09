import { createFileRoute } from '@tanstack/react-router';

import { Facade } from '@/components/facade';
import { LoginForm } from '@/components/login-form';
import { cheminInterne } from '@/lib/nav';

export const Route = createFileRoute('/connexion')({
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const next = cheminInterne(search.next);
    return next === undefined ? {} : { next };
  },
  component: ConnexionPage,
});

function ConnexionPage() {
  const { next } = Route.useSearch();

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-center overflow-hidden bg-sidebar px-12 py-12 text-sidebar-foreground lg:flex">
        <Facade />

        <img
          src="/brand/cpi-header.png"
          alt="CPI"
          width={489}
          height={200}
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

          <h1 className="font-display text-h1 font-[800] tracking-[-0.025em]">Connexion</h1>
          <p className="mt-1.5 text-body text-muted-foreground">Accédez à vos espaces de travail</p>

          <div className="mt-8">
            <LoginForm next={next} />
          </div>
        </div>
      </section>
    </main>
  );
}
