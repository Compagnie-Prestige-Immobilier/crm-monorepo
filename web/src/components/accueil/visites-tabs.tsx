'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ChartNoAxesCombinedIcon,
  HeartHandshakeIcon,
  ListChecksIcon,
  ListIcon,
  UploadIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { meQueryOptions } from '@/api/auth';
import { type Permission, peut } from '@/lib/types';
import { cn } from '@/lib/utils';

const TABS: readonly {
  href: string;
  label: string;
  icon: typeof ListIcon;
  permission: Permission | null;
}[] = [
  { href: '/accueil', label: 'Liste', icon: ListIcon, permission: null },
  {
    href: '/accueil/tableau-de-bord',
    label: 'Tableau de bord',
    icon: ChartNoAxesCombinedIcon,
    permission: null,
  },
  {
    // Les rendez-vous obtenus au téléphone : le comptoir constate qui vient.
    href: '/accueil/rendez-vous',
    label: 'Rendez-vous',
    icon: HeartHandshakeIcon,
    permission: 'rendez_vous.voir',
  },
  {
    // Gestion des quatre listes qui alimentent la saisie : réservée à qui les
    // tient, pas à qui saisit avec.
    href: '/accueil/listes',
    label: 'Listes',
    icon: ListChecksIcon,
    permission: 'accueil.listes',
  },
  {
    href: '/accueil/import',
    label: 'Import',
    icon: UploadIcon,
    permission: 'accueil.listes',
  },
];

export function VisitesTabs() {
  const pathname = usePathname();
  const { data: user } = useQuery(meQueryOptions);
  const tabs = TABS.filter((tab) => tab.permission === null || peut(user, tab.permission));

  return (
    <nav aria-label="Visites" className="print:hidden">
      <ul className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => {
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
