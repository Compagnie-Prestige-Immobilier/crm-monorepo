import {
  ActivityIcon,
  BellIcon,
  ChartColumnIcon,
  FileSpreadsheetIcon,
  HeadsetIcon,
  FolderOpenIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  ListOrderedIcon,
  MegaphoneIcon,
  PlusCircleIcon,
  SettingsIcon,
  UserPlusIcon,
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
 * Navigation du panel : DÉPENDANTE DU RÔLE, et pas seulement en apparence.
 *
 * Un agent BANQUE_FINANCE ne voit ni Prospects, ni Représentants, ni
 * Commerciaux, ni Campagnes, ni Référentiels. Ce n'est pas de la cosmétique :
 * l'API lui répondrait 403 sur chacun de ces écrans, et une entrée de menu qui
 * mène à un refus de droits est un défaut de conception, pas une protection.
 * Son métier tient en quatre gestes : regarder ses chiffres, ouvrir la liste de
 * ses dossiers, en créer un, exporter : et le menu ne montre que ceux-là.
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
        href: '/statistiques',
        label: 'Statistiques',
        icon: ChartColumnIcon,
        description: 'Téléconseil et banques',
        roles: ['ADMIN'],
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
        /*
          « programmes » est retiré : dans ce produit, un PROGRAMME est le PDF
          imprimé qu'un téléconseiller emporte en tournée, et rien d'autre.
          L'employer aussi pour désigner les campagnes elles-mêmes faisait du
          même mot deux choses, dont l'une est un fichier.
        */
        description: 'Campagnes d’appels prospects et représentants',
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
        description: 'Dossiers bancaires',
        roles: ['ADMIN', 'BANQUE_FINANCE'],
      },
      {
        href: '/dossiers/nouveau',
        label: 'Nouveau dossier',
        icon: PlusCircleIcon,
        description: 'Ouverture de dossier',
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
        /**
         * Le SUIVI de ses propres demandes, pour un agent bancaire.
         *
         * Refuser une demande lui envoie une notification dont la route est
         * `/demandes-clients` : sans cette entrée, le seul chemin vers l'écran
         * était ce lien-là, et rien ne permettait d'y revenir ensuite. L'API
         * restreint la liste à `requestedById = user.id` : il n'y voit que ses
         * demandes, et l'écran ne lui propose aucun geste d'arbitrage.
         */
        href: '/demandes-clients',
        label: 'Mes demandes',
        icon: UserPlusIcon,
        description: 'Créations de client demandées',
        roles: ['BANQUE_FINANCE'],
      },
      {
        href: '/dossiers/etapes',
        label: 'Étapes bancaires',
        icon: ListOrderedIcon,
        description: 'Flux de traitement',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        // L'arbitrage des demandes déposées par les banques. Sans entrée de
        // menu, l'écran n'était atteignable qu'en tapant son URL, et la
        // demande d'une banque restait en attente indéfiniment.
        href: '/demandes-clients',
        label: 'Demandes clients',
        icon: UserPlusIcon,
        description: 'Créations demandées par les banques',
        roles: ['ADMIN'],
      },
      {
        // Même défaut, même correction : le composeur existait depuis le début
        // et ne figurait dans aucune section. La cloche montre ce qu'on
        // REÇOIT ; cet écran sert à ÉMETTRE, et les deux se cherchaient.
        href: '/notifications',
        label: 'Notifications',
        icon: BellIcon,
        description: 'Annonces et rappels envoyés',
        roles: ['ADMIN'],
      },
      {
        href: '/representants',
        label: 'Représentants',
        icon: UsersRoundIcon,
        description: 'Fiches et coordonnées',
        roles: ['ADMIN'],
      },
      {
        href: '/commerciaux',
        label: 'Téléconseillers',
        icon: HeadsetIcon,
        description: 'Comptes et activité',
        roles: ['ADMIN'],
      },
      {
        href: '/supervision',
        label: 'Supervision',
        icon: ActivityIcon,
        description: 'Présence et dernière activité',
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
        description: 'Démonstration et suppression',
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
 * qu'une exception : un rôle ajouté demain au contrat ne doit pas faire tomber
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
