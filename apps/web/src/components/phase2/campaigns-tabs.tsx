'use client';

import { MegaphoneIcon, UsersRoundIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const TABS: readonly { href: string; label: string; icon: typeof MegaphoneIcon }[] = [
  { href: '/campagnes', label: 'Appels prospects', icon: MegaphoneIcon },
  { href: '/campagnes/representants', label: 'Appels représentants', icon: UsersRoundIcon },
];

export function CampaignsTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Type de campagne">
      <ul className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
        {TABS.map((tab) => {
          const active =
            tab.href === '/campagnes'
              ? pathname === '/campagnes' || /^\/campagnes\/(?!representants)/u.test(pathname)
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-[0.875rem] font-[600]',
                  'transition-colors duration-(--dur-1) ease-(--ease-out-cpi)',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
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
