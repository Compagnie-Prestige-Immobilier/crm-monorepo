import {
  ActivityIcon,
  BellIcon,
  ChartColumnIcon,
  ClipboardListIcon,
  ClockIcon,
  FileSpreadsheetIcon,
  FolderOpenIcon,
  HeadsetIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  ListOrderedIcon,
  MegaphoneIcon,
  PhoneForwardedIcon,
  PlusCircleIcon,
  SettingsIcon,
  UploadIcon,
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

/** Navigation filtrée par rôle ; l'autorisation serveur reste la règle. */
const SECTIONS: readonly NavSection[] = [
  {
    title: null,
    items: [
      {
        // En tête parce que c'est l'écran où la Directrice passe sa journée, et
        // le seul du panneau pour un compte d'accueil.
        href: '/accueil',
        label: 'Registre des visites',
        icon: ClipboardListIcon,
        description: 'Visites du jour et saisie',
        roles: ['ADMIN', 'DIRECTION', 'ACCUEIL'],
      },
      {
        // Écran d'accueil du SUPERVISEUR : c'est le seul qui montre le travail
        // de chaque téléconseiller ligne à ligne.
        href: '/supervision',
        label: 'Supervision',
        icon: ActivityIcon,
        description: 'Activité et présence des téléconseillers',
        roles: ['SUPERVISEUR', 'DIRECTION'],
      },
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
        roles: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        href: '/prospects',
        label: 'Prospects',
        icon: UsersIcon,
        description: 'Liste filtrable et export',
        roles: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        href: '/campagnes',
        label: 'Campagnes',
        icon: MegaphoneIcon,
        description: 'Campagnes d’appels prospects et représentants',
        roles: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
      },
    ],
  },
  {
    title: 'Terrain',
    items: [
      {
        href: '/console',
        label: 'Console d’appel',
        icon: HeadsetIcon,
        description: 'File d’appels et qualification',
        roles: ['ADMIN', 'COMMERCIAL'],
      },
      {
        href: '/rappels',
        label: 'Rappels',
        icon: ClockIcon,
        description: 'Échéances promises et retards',
        roles: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        href: '/representants',
        label: 'Représentants',
        icon: UsersRoundIcon,
        description: 'Fiches et coordonnées',
        roles: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        href: '/suggestions',
        label: 'Numéros suggérés',
        icon: PhoneForwardedIcon,
        description: 'Contacts nommés par les représentants',
        roles: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        href: '/prospects/nouveau',
        label: 'Nouveau prospect',
        icon: PlusCircleIcon,
        description: 'Saisie d’un contact',
        roles: ['ADMIN', 'COMMERCIAL'],
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
        href: '/commerciaux',
        label: 'Utilisateurs',
        icon: UsersIcon,
        description: 'Comptes, rôles et accès',
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
        // Après les référentiels : un classeur ne peut nommer que des banques,
        // syndicats, départements et IEF déjà enregistrés.
        href: '/imports',
        label: 'Imports',
        icon: UploadIcon,
        description: 'Dépôt de classeurs et suivi des travaux',
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
 * Un rôle sans écran d'accueil retombe sur la connexion, que `/connexion`
 * renvoie aussitôt ici : la valeur par défaut n'existe que pour un rôle ajouté
 * demain au contrat, jamais pour un rôle admis dans le panel.
 */
export function homePathForRole(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return '/tableau-de-bord';
    case 'BANQUE_FINANCE':
      return '/dossiers';
    case 'COMMERCIAL':
      return '/console';
    case 'SUPERVISEUR':
      return '/supervision';
    // Le registre, pas le tableau de bord général : la direction commerciale a
    // le sien, et l'accueil n'atteint que celui-là.
    case 'DIRECTION':
    case 'ACCUEIL':
      return '/accueil';
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
