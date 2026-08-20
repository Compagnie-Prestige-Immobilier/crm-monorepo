'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { coqueOf } from '@/components/layout/nav-items';

/**
 * Conteneur de coque. Il ne porte qu'un attribut : `globals.css` y accroche la
 * palette du projet. Sortir de `/chues/*` démonte l'attribut avec la route, et
 * la palette CPI revient sans qu'aucun état n'ait été remis à zéro.
 */
export function CoqueShell({ children }: { children: ReactNode }) {
  const coque = coqueOf(usePathname());

  return (
    <div data-coque={coque ?? undefined} className="flex min-h-dvh">
      {children}
    </div>
  );
}
