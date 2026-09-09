import type { LinkProps } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';

import { NAV_ACCUEIL, NAV_ADMIN } from '@/lib/nav-espaces';
import { NAV_GRAND_PUBLIC } from '@/lib/nav-grand-public';
import { NAV_CHUES } from '@/lib/nav-chues';
import { INBOX_ROLES } from '@/lib/roles';
import type { Role } from '@/lib/types';

/** Écran de choix, seul atterrissage après connexion. */
export const HUB_PATH = '/espaces';

/** La boîte de réception, hors coque. `/admin/notifications` reste le composeur. */
const INBOX_PATH = '/notifications';

export const hasInbox = (role: Role): boolean => INBOX_ROLES.includes(role);

export const inboxPathFor = (role: Role): string =>
  role === 'ADMIN' ? '/admin/notifications?onglet=reception' : INBOX_PATH;

export type Coque = 'accueil' | 'chues' | 'grand-public' | 'admin';

export interface CoqueEntry {
  id: Coque;
  label: string;
  path: string;
  description: string;
  roles: readonly Role[];
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  roles: readonly Role[];
  /** Rangé sous « Plus » : l'écran sert quelques fois par semaine. */
  secondary?: boolean;
  /** Jamais dans la barre ; garde son titre et sa surbrillance. */
  hidden?: boolean;
  /** Entrée à surligner quand cet écran caché s'ouvre par un onglet de pilotage. */
  onglet?: string;
}

export const COQUES: readonly CoqueEntry[] = [
  {
    id: 'accueil',
    label: 'Accueil',
    path: '/accueil',
    description: 'Registre des visites du comptoir',
    roles: ['ADMIN', 'DIRECTION', 'ACCUEIL'],
  },
  {
    id: 'chues',
    label: 'Projet CHUES',
    path: '/chues',
    description: 'Enrôlement des enseignants syndiqués',
    roles: [
      'ADMIN',
      'DIRECTION',
      'SUPERVISEUR',
      'COMMERCIAL',
      'CHARGE_CLIENTELE',
      'BANQUE_FINANCE',
    ],
  },
  {
    id: 'grand-public',
    label: 'Projet Grand Public',
    path: '/grand-public',
    description: 'Prospection, appels et conversion hors CHUES',
    roles: [
      'ADMIN',
      'DIRECTION',
      'SUPERVISEUR',
      'COMMERCIAL',
      'CHARGE_CLIENTELE',
      'BANQUE_FINANCE',
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    path: '/admin',
    description: 'Comptes, listes de référence, imports et paramètres',
    roles: ['ADMIN'],
  },
];

const ITEMS: Readonly<Record<Coque, readonly NavItem[]>> = {
  accueil: NAV_ACCUEIL,
  chues: NAV_CHUES,
  'grand-public': NAV_GRAND_PUBLIC,
  admin: NAV_ADMIN,
};

/** Coque d'une route, comparée sur le segment : `/administration` n'est pas `/admin`. */
export function coqueOf(pathname: string): Coque | null {
  const match = COQUES.find(
    (coque) => pathname === coque.path || pathname.startsWith(`${coque.path}/`),
  );
  return match?.id ?? null;
}

/** Les quatre tuiles, toujours, avec l'autorisation de chacune. */
export function coquesForRole(role: Role): { entry: CoqueEntry; allowed: boolean }[] {
  return COQUES.map((entry) => ({ entry, allowed: entry.roles.includes(role) }));
}

function everyItem(role: Role, coque: Coque): readonly NavItem[] {
  return ITEMS[coque].filter((item) => item.roles.includes(role));
}

/** Ce que ce rôle lit dans la barre de cette coque, dans l'ordre. */
export function navItems(role: Role, coque: Coque): readonly NavItem[] {
  return everyItem(role, coque).filter((item) => item.hidden !== true);
}

/** Premier écran d'une coque pour ce rôle : le premier de la barre, replis exclus. */
export function coqueHomePath(role: Role, coque: Coque): string {
  return navItems(role, coque).find((item) => item.secondary !== true)?.href ?? HUB_PATH;
}

/** Écran d'atterrissage après connexion : le hub, pour tout le monde. */
export function homePathForRole(role: Role): string {
  return coquesForRole(role).some(({ allowed }) => allowed) ? HUB_PATH : '/connexion';
}

function matchNavItem(role: Role, pathname: string): NavItem | undefined {
  const coque = coqueOf(pathname);
  if (coque === null) return undefined;
  return [...everyItem(role, coque)]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

/** Titre de la barre supérieure : correspondance par préfixe le plus long. */
export function navTitle(role: Role, pathname: string): string {
  if (pathname === INBOX_PATH) return 'Notifications';
  return matchNavItem(role, pathname)?.label ?? 'CPI GO';
}

/** Coque de la barre latérale sur un écran hors coque : la première ouverte au rôle. */
export function fallbackCoque(role: Role): Coque | null {
  return COQUES.find((entry) => entry.roles.includes(role))?.id ?? null;
}

export function isNavItemActive(role: Role, pathname: string, item: NavItem): boolean {
  const courant = matchNavItem(role, pathname);
  return (courant?.onglet ?? courant?.href) === item.href;
}

/** `next` reste une adresse interne : `//ailleurs.example` serait une redirection ouverte. */
export function cheminInterne(valeur: unknown): string | undefined {
  if (typeof valeur !== 'string') return undefined;
  if (!valeur.startsWith('/') || valeur.startsWith('//')) return undefined;
  return valeur;
}

/**
 * Les entrées de navigation portent des adresses écrites (`/chues/console`) que
 * l'arbre paramétré `/$projet` ne sait pas typer : seul point de conversion.
 */
export function lien(href: string): LinkProps {
  const [chemin, requete] = href.split('?');
  const search =
    requete === undefined ? undefined : Object.fromEntries(new URLSearchParams(requete));
  return { to: chemin, search } as LinkProps;
}
