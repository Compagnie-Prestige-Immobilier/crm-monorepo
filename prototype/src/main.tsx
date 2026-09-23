import './styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, Link, RouterProvider } from 'react-aria-components';
import { Toaster } from 'sonner';
import { Route, Router, Switch, useLocation } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';

import { Catalogue } from './Catalogue';
import { FicheScreen } from './Fiche';
import { CONFIG } from './fields';
import { Radar } from './Radar';

const NAV = [
  { href: '/', label: 'Prospects' },
  { href: '/catalogue', label: 'Catalogue' },
];

function Shell() {
  const [location, navigate] = useLocation();
  return (
    <RouterProvider navigate={navigate} useHref={(href) => `#${href}`}>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-lg">
            <img src="/favicon.svg" alt="" className="size-8 rounded-md" />
            <span className="font-display text-lg font-bold tracking-tight">
              CPI <span className="text-brand">Radar</span>
            </span>
          </Link>
          <nav aria-label="Principale" className="flex gap-1">
            {NAV.map((n) => {
              const current =
                n.href === '/'
                  ? location === '/' || location.startsWith('/fiche')
                  : location.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={current ? 'page' : undefined}
                  className={`focus-ring flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition ${current ? 'bg-brand-soft text-brand' : 'text-muted data-[hovered]:text-ink'}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <span className="ml-auto hidden rounded-full bg-gold-soft px-3 py-1 text-xs font-semibold text-gold-text sm:inline">
            {CONFIG.VERSION}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Switch>
          <Route path="/" component={Radar} />
          <Route path="/catalogue" component={Catalogue} />
          <Route path="/fiche/:id">
            {(params) => <FicheScreen key={params.id} id={params.id} />}
          </Route>
          <Route>
            <p className="text-muted">
              Page introuvable.{' '}
              <Link href="/" className="font-semibold text-brand underline">
                Retour aux prospects
              </Link>
            </p>
          </Route>
        </Switch>
      </main>
    </RouterProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider locale="fr-FR">
      <Router hook={useHashLocation}>
        <Shell />
      </Router>
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{ className: 'font-sans' }}
      />
    </I18nProvider>
  </StrictMode>,
);
