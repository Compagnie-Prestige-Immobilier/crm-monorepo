'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { homePathForRole, isNavItemActive, navSections } from '@/components/layout/nav-items';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

const PANEL_LABELS: Record<Role, string> = {
  ADMIN: 'Panneau d’administration',
  BANQUE_FINANCE: 'Espace Banque & Finance',
  COMMERCIAL: 'Espace téléconseiller',
  SUPERVISEUR: 'Espace supervision',
};

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
  const sections = navSections(role);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'px-5',
        )}
      >
        <Link
          href={homePathForRole(role)}
          onClick={onNavigate}
          className="flex items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring"
        >
          {/*
            Réduite, la barre passe au logo CARRÉ. Le logo en bandeau mesuré
            pour 17 rem se retrouverait à moins de 40 px de large : le texte
            « Compagnie Prestige Immobilier » y devient une bavure grise, et une
            marque illisible vaut moins qu'une marque absente.
          */}
          <Image
            src={collapsed ? '/brand/icon-512.png' : '/brand/cpi-header.png'}
            alt="CPI GO, retour à l’accueil"
            width={collapsed ? 512 : 489}
            height={collapsed ? 512 : 200}
            priority
            className={cn('w-auto', collapsed ? 'size-9 rounded-sm' : 'h-8')}
          />
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

      {collapsed ? null : (
        <div className="border-t border-sidebar-border px-5 py-4">
          <p className="eyebrow text-sidebar-muted-foreground">CPI GO</p>
          {/* Token explicite, plus d'`opacity`. Une opacité posée sur une couleur
              déjà atténuée ne se mesure dans aucun tableau de tokens : c'est
              précisément le défaut qui a délavé le panel. 7,07:1 en clair. */}
          <p className="text-caption text-sidebar-muted-foreground">{PANEL_LABELS[role]}</p>
        </div>
      )}
    </div>
  );
}
