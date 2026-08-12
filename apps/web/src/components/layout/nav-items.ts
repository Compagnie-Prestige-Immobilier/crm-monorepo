import {
  BuildingIcon,
  FileSpreadsheetIcon,
  FolderOpenIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  ListOrderedIcon,
  MegaphoneIcon,
  PlusCircleIcon,
  SettingsIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from 'lucide-react';

import type { Role } from '@/lib/types';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Rôles auxquels l'entrée est présentée. */
  roles: readonly Role[];
}

export interface NavSection {
  /** `null` pour la première section, qui n'a pas besoin d'intitulé. */
  title: string | null;
  items: readonly NavItem[];
}

/**
 * Navigation du panel — DÉPENDANTE DU RÔLE, et pas seulement en apparence.
 *
 * Un agent BANQUE_FINANCE ne voit ni Prospects, ni Représentants, ni
 * Commerciaux, ni Campagnes, ni Référentiels. Ce n'est pas de la cosmétique :
 * l'API lui répondrait 403 sur chacun de ces écrans, et une entrée de menu qui
 * mène à un refus de droits est un défaut de conception, pas une protection.
 * Son métier tient en quatre gestes — regarder ses chiffres, ouvrir la liste de
 * ses dossiers, en créer un, exporter — et le menu ne montre que ceux-là.
 *
 * Le masquage ne remplace évidemment PAS le contrôle : chaque page serveur
 * vérifie le rôle de son côté (voir `lib/session.ts`). Ce fichier décide de ce
 * qui est PROPOSÉ ; la page décide de ce qui est SERVI.
 *
 * L'ordre suit le parcours réel de chaque rôle : on regarde les chiffres, puis
 * on descend vers le détail, puis vers les personnes, et seulement en dernier
 * vers la configuration.
 */
const SECTIONS: readonly NavSection[] = [
  {
    title: null,
    items: [
      {
        href: '/tableau-de-bord',
        label: 'Tableau de bord',
        icon: LayoutDashboardIcon,
        description: 'Indicateurs et graphiques',
        roles: ['ADMIN'],
      },
      {
        href: '/banque',
        label: 'Tableau de bord',
        icon: LayoutDashboardIcon,
        description: 'Encaissements, rejets et délais',
        roles: ['BANQUE_FINANCE'],
      },
      {
        href: '/prospects',
        label: 'Prospects',
        icon: UsersIcon,
        description: 'Liste filtrable et export',
        roles: ['ADMIN'],
      },
      {
        href: '/campagnes',
        label: 'Campagnes',
        icon: MegaphoneIcon,
        description: 'Phase 2 — appels et programmes',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    title: 'Banque & Finance',
    items: [
      {
        href: '/dossiers',
        label: 'Dossiers',
        icon: FolderOpenIcon,
        description: 'Suivi des dossiers bancaires',
        roles: ['ADMIN', 'BANQUE_FINANCE'],
      },
      {
        href: '/dossiers/nouveau',
        label: 'Nouveau dossier',
        icon: PlusCircleIcon,
        description: 'Ouvrir un dossier pour un client',
        roles: ['ADMIN', 'BANQUE_FINANCE'],
      },
      {
        href: '/dossiers/export',
        label: 'Export',
        icon: FileSpreadsheetIcon,
        description: 'Classeur Dossiers · Historique · Synthèse',
        roles: ['ADMIN', 'BANQUE_FINANCE'],
      },
      {
        href: '/dossiers/etapes',
        label: 'Étapes bancaires',
        icon: ListOrderedIcon,
        description: 'Configurer le flux de traitement',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        href: '/representants',
        label: 'Représentants',
        icon: UsersRoundIcon,
        description: 'Fiches saisies sur le terrain',
        roles: ['ADMIN'],
      },
      {
        href: '/commerciaux',
        label: 'Commerciaux',
        icon: BuildingIcon,
        description: 'Comptes et activité',
        roles: ['ADMIN'],
      },
      {
        href: '/referentiels',
        label: 'Référentiels',
        icon: LibraryIcon,
        description: 'Départements, banques, syndicats',
        roles: ['ADMIN'],
      },
      {
        href: '/parametres',
        label: 'Paramètres',
        icon: SettingsIcon,
        description: 'Mode démonstration',
        roles: ['ADMIN'],
      },
    ],
  },
];

/** Sections visibles par ce rôle. Une section devenue vide disparaît. */
export function navSections(role: Role): NavSection[] {
  return SECTIONS.map((section) => ({
    title: section.title,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}

/** À plat, pour les recherches par chemin. */
export function navItems(role: Role): NavItem[] {
  return navSections(role).flatMap((section) => section.items);
}

/**
 * Écran d'atterrissage après connexion.
 *
 * COMMERCIAL n'a pas de panel : il est refusé à la porte (voir
 * `lib/data/auth.ts`). La fonction lui renvoie tout de même la connexion plutôt
 * qu'une exception — un rôle ajouté demain au contrat ne doit pas faire tomber
 * l'écran de login.
 */
export function homePathForRole(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return '/tableau-de-bord';
    case 'BANQUE_FINANCE':
      return '/dossiers';
    default:
      return '/connexion';
  }
}

/**
 * Titre de la barre supérieure, dérivé de la route.
 *
 * Correspondance par PRÉFIXE le plus long : `/dossiers/nouveau` doit afficher
 * « Nouveau dossier » et non « Dossiers », alors que `/dossiers/abc-123` doit
 * bien afficher « Dossiers ». Trier par longueur décroissante règle les deux
 * cas d'un coup.
 */
export function navTitle(role: Role, pathname: string): string {
  const match = [...navItems(role)]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.label ?? 'CPI GO';
}

/** L'entrée est-elle celle de la page courante ? Même règle que `navTitle`. */
export function isNavItemActive(role: Role, pathname: string, item: NavItem): boolean {
  const match = [...navItems(role)]
    .sort((a, b) => b.href.length - a.href.length)
    .find((candidate) => pathname === candidate.href || pathname.startsWith(`${candidate.href}/`));
  return match?.href === item.href;
}
