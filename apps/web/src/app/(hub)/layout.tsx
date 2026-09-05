import Image from 'next/image';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { LiveStream } from '@/components/live/live-stream';
import { QueryErrorState } from '@/components/query-error-state';
import { demoWorkspaceEnabled } from '@/lib/demo-workspace';
import { readSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Le hub ne porte AUCUNE coque : sa palette est celle de CPI. */
export default async function HubLayout({ children }: { children: ReactNode }) {
  const session = await readSession();

  if (session.status === 'anonymous') redirect('/connexion');

  if (session.status === 'unavailable') {
    return (
      <main id="contenu-principal" className="grid min-h-dvh place-items-center p-6">
        <QueryErrorState
          error={session.error}
          fallback="Session non vérifiée. Réessayez dans un instant."
        />
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <LiveStream />
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4 md:px-6">
        <Image
          src="/brand/cpi-header.png"
          alt="CPI GO"
          width={489}
          height={200}
          priority
          className="h-8 w-auto"
        />
        <div className="flex-1" />
        <ThemeToggle />
        <UserMenu user={session.user} demoEnabled={demoWorkspaceEnabled()} />
      </header>
      <main id="contenu-principal" className="flex-1 px-4 py-8 md:px-6 md:py-12">
        {children}
      </main>
    </div>
  );
}
