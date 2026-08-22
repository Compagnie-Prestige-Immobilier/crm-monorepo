'use client';

import { LayoutGridIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  COQUES,
  coqueOf,
  HUB_PATH,
  isNavItemActive,
  navSections,
} from '@/components/layout/nav-items';
import { UesMark } from '@/components/layout/ues-mark';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

export function SidebarNav({
  role,
  onNavigate = () => undefined,
  collapsed = false,
  navId,
}: {
  role: Role;
  onNavigate?: (() => void) | undefined;
  collapsed?: boolean | undefined;
  navId?: string | undefined;
}) {
  const pathname = usePathname();
  const coque = coqueOf(pathname);
  const sections = coque === null ? [] : navSections(role, coque);
  const coqueLabel = COQUES.find((entry) => entry.id === coque)?.label ?? 'CPI GO';
  const hubHref = `${HUB_PATH}?retour=${encodeURIComponent(pathname)}`;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'px-5',
        )}
      >
        <Link
          href={hubHref}
          onClick={onNavigate}
          aria-label="Tous les espaces"
          className="flex items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring"
        >
          {coque === 'chues' ? (
            <UesMark compact={collapsed} />
          ) : (
            /*
              Réduite, la barre passe au logo CARRÉ. Le logo en bandeau mesuré
              pour 17 rem se retrouverait à moins de 40 px de large : le texte
              « Compagnie Prestige Immobilier » y devient une bavure grise, et une
              marque illisible vaut moins qu'une marque absente.
            */
            <Image
              src={collapsed ? '/brand/icon-512.png' : '/brand/cpi-header.png'}
              alt="CPI GO"
              width={collapsed ? 512 : 489}
              height={collapsed ? 512 : 200}
              priority
              className={cn('w-auto', collapsed ? 'size-9 rounded-sm' : 'h-8')}
            />
          )}
        </Link>
      </div>

      <nav
        id={navId}
        aria-label="Navigation principale"
        className={cn('flex-1 overflow-y-auto scrollbar-thin', collapsed ? 'p-2' : 'p-3')}
      >
        {sections.map((section, index) => (
          <div key={section.title ?? 'principal'} className={cn(index > 0 && 'mt-5')}>
            {section.title !== null ? (
              <h2
                id={`nav-section-${String(index)}`}
                className={cn(
                  collapsed ? 'sr-only' : 'eyebrow px-3 pb-1.5 text-sidebar-muted-foreground',
                )}
              >
                {section.title}
              </h2>
            ) : null}
            {collapsed && section.title !== null ? (
              <div aria-hidden="true" className="mx-2 mb-2 h-px bg-sidebar-border" />
            ) : null}
            <ul
              className="flex flex-col gap-1"
              {...(section.title !== null
                ? { 'aria-labelledby': `nav-section-${String(index)}` }
                : {})}
            >
              {section.items.map((item) => {
                const isActive = isNavItemActive(role, pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'relative flex min-h-11 items-center rounded-md py-2.5 text-[0.875rem] font-[600]',
                        collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                        'transition-colors duration-150',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring',
                        isActive
                          ? [
                              'bg-sidebar-accent text-sidebar-accent-foreground',
                              'before:absolute before:inset-y-1.5 before:left-0 before:w-[3px]',
                              'before:rounded-full before:bg-accent before:content-[""]',
                            ]
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                      )}
                    >
                      <Icon
                        className={cn('size-4 shrink-0', isActive && 'text-accent-on-dark')}
                        aria-hidden="true"
                      />
                      <span className={cn(collapsed ? 'sr-only' : 'truncate')}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Le retour au hub est un LIEN VISIBLE, pas seulement le logo : personne
          ne devine qu'un logo change de projet. */}
      <div className={cn('border-t border-sidebar-border', collapsed ? 'p-2' : 'px-3 py-3')}>
        <Link
          href={hubHref}
          onClick={onNavigate}
          title={collapsed ? 'Tous les espaces' : undefined}
          className={cn(
            'flex min-h-11 items-center rounded-md text-[0.875rem] font-[600] text-sidebar-foreground',
            collapsed ? 'justify-center px-2' : 'gap-3 px-3',
            'transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring',
          )}
        >
          <LayoutGridIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className={cn(collapsed ? 'sr-only' : 'truncate')}>Tous les espaces</span>
        </Link>
        {collapsed ? null : (
          <p className="eyebrow px-3 pt-2 text-sidebar-muted-foreground">{coqueLabel}</p>
        )}
      </div>
    </div>
  );
}
