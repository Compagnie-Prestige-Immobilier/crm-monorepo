'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArchiveIcon,
  CalendarCheckIcon,
  CalendarDaysIcon,
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
  // Les rendez-vous d'abord : c'est le métier du chargé de clientèle, le comptoir ne voit que le sien.
  {
    href: '/accueil/agenda',
    label: 'Agenda',
    icon: CalendarDaysIcon,
    permission: 'rendez_vous.closer',
  },
  {
    href: '/accueil/rendez-vous',
    label: 'Rendez-vous',
    icon: CalendarCheckIcon,
    permission: 'rendez_vous.voir',
  },
  {
    href: '/accueil/interesses',
    label: 'Intéressés et hésitants',
    icon: HeartHandshakeIcon,
    permission: 'rendez_vous.closer',
  },
  { href: '/accueil', label: 'Registre', icon: ListIcon, permission: null },
  {
    href: '/accueil/tableau-de-bord',
    label: 'Tableau de bord',
    icon: ChartNoAxesCombinedIcon,
    permission: null,
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
  {
    href: '/accueil/archives',
    label: 'Archives',
    icon: ArchiveIcon,
    permission: 'visites.voir_archivees',
  },
];

export function VisitesTabs() {
  const pathname = usePathname();
  const { data: user } = useQuery(meQueryOptions);
  const tabs = TABS.filter((tab) => tab.permission === null || peut(user, tab.permission));
  return (
    // Sur écran large, une colonne au bord droit : la bande du haut mangeait la hauteur de l'agenda.
    <nav
      aria-label="Visites"
      className="print:hidden md:fixed md:top-1/2 md:right-3 md:z-30 md:w-56 md:-translate-y-1/2"
    >
      <ul className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1 md:flex md:flex-col md:items-stretch md:shadow-elev-sm">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-[0.875rem] font-[600] md:w-full',
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
