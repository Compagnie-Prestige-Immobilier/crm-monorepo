'use client';

import { ChartNoAxesCombinedIcon, ListIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const TABS = [
  { href: '/accueil', label: 'Liste', icon: ListIcon },
  { href: '/accueil/tableau-de-bord', label: 'Tableau de bord', icon: ChartNoAxesCombinedIcon },
] as const;

export function VisitesTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Visites" className="print:hidden">
      <ul className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-[0.875rem] font-[600]',
                  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  active
                    ? 'bg-card text-foreground shadow-elev-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
