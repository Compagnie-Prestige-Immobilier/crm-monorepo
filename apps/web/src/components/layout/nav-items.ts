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

/** Écran de choix, seul atterrissage après connexion. */
export const HUB_PATH = '/espaces';

export type Coque = 'accueil' | 'chues' | 'grand-public' | 'admin';

export interface CoqueEntry {
  id: Coque;
  label: string;
  /** Racine de la coque ; toute route en dessous en porte la palette. */
  path: string;
  description: string;
  roles: readonly Role[];
}

/**
 * Les quatre entrées de l'application. CHUES et Grand Public visent la même
 * vente et ne partagent NI écran NI route : le processus d'acquisition et le
 * programme d'appels diffèrent, et un prospect de l'un n'est pas du travail
 * pour l'autre.
 */
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
    roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR', 'COMMERCIAL', 'BANQUE_FINANCE'],
  },
  {
    id: 'grand-public',
    label: 'Projet Grand Public',
    path: '/grand-public',
    description: 'Vente hors syndicat, en préparation',
    roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR', 'COMMERCIAL'],
  },
  {
    id: 'admin',
    label: 'Admin',
    path: '/admin',
    description: 'Comptes, référentiels, imports et paramètres',
    roles: ['ADMIN'],
  },
];

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Rôles auxquels l'entrée est présentée. */
  roles: readonly Role[];
}

export interface NavSection {
  coque: Coque;
  /** `null` pour la première section d'une coque, qui n'a pas besoin d'intitulé. */
  title: string | null;
  items: readonly NavItem[];
}

/** Navigation filtrée par coque puis par rôle ; l'autorisation serveur reste la règle. */
const SECTIONS: readonly NavSection[] = [
  {
    coque: 'accueil',
    title: null,
    items: [
      {
        href: '/accueil',
        label: 'Registre des visites',
        icon: ClipboardListIcon,
        description: 'Visites du jour et saisie',
        roles: ['ADMIN', 'DIRECTION', 'ACCUEIL'],
      },
      {
        href: '/accueil/tableau-de-bord',
        label: 'Tableau de bord',
        icon: LayoutDashboardIcon,
        description: 'Affluence et motifs de visite',
        roles: ['ADMIN', 'DIRECTION', 'ACCUEIL'],
      },
    ],
  },
  {
    coque: 'chues',
    title: null,
    items: [
      {
        href: '/chues/tableau-de-bord',
        label: 'Tableau de bord',
        icon: LayoutDashboardIcon,
        description: 'Indicateurs et graphiques',
        roles: ['ADMIN'],
      },
      {
        // Écran d'accueil du SUPERVISEUR : c'est le seul qui montre le travail
        // de chaque téléconseiller ligne à ligne.
        href: '/chues/supervision',
        label: 'Supervision',
        icon: ActivityIcon,
        description: 'Activité et présence des téléconseillers',
        roles: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        href: '/chues/banque',
        label: 'Tableau de bord',
        icon: LayoutDashboardIcon,
        description: 'Encaissements, rejets et délais',
        roles: ['BANQUE_FINANCE'],
      },
      {
        href: '/chues/statistiques',
        label: 'Statistiques',
        icon: ChartColumnIcon,
        description: 'Téléconseil et banques',
        roles: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        href: '/chues/prospects',
        label: 'Prospects',
        icon: UsersIcon,
        description: 'Liste filtrable et export',
        roles: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        href: '/chues/campagnes',
        label: 'Campagnes',
        icon: MegaphoneIcon,
        description: 'Campagnes d’appels prospects et représentants',
        roles: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
      },
    ],
  },
  {
    coque: 'chues',
    title: 'Terrain',
    items: [
      {
        href: '/chues/console',
        label: 'Console d’appel',
        icon: HeadsetIcon,
        description: 'File d’appels et qualification',
        roles: ['ADMIN', 'COMMERCIAL'],
      },
      {
        href: '/chues/rappels',
        label: 'Rappels',
        icon: ClockIcon,
        description: 'Échéances promises et retards',
        roles: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        href: '/chues/representants',
        label: 'Représentants',
        icon: UsersRoundIcon,
        description: 'Fiches et coordonnées',
        roles: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        href: '/chues/suggestions',
        label: 'Numéros suggérés',
        icon: PhoneForwardedIcon,
        description: 'Contacts nommés par les représentants',
        roles: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        href: '/chues/prospects/nouveau',
        label: 'Nouveau prospect',
        icon: PlusCircleIcon,
        description: 'Saisie d’un contact',
        roles: ['ADMIN', 'COMMERCIAL'],
      },
    ],
  },
  {
    coque: 'chues',
    title: 'Banque & Finance',
    items: [
      {
        href: '/chues/dossiers',
        label: 'Dossiers',
        icon: FolderOpenIcon,
        description: 'Dossiers bancaires',
        roles: ['ADMIN', 'BANQUE_FINANCE'],
      },
      {
        href: '/chues/dossiers/nouveau',
        label: 'Nouveau dossier',
        icon: PlusCircleIcon,
        description: 'Ouverture de dossier',
        roles: ['ADMIN', 'BANQUE_FINANCE'],
      },
      {
        href: '/chues/dossiers/export',
        label: 'Export',
        icon: FileSpreadsheetIcon,
        description: 'Classeur Dossiers · Historique · Synthèse',
        roles: ['ADMIN', 'BANQUE_FINANCE'],
      },
      {
        // L'arbitrage des demandes déposées par les banques. Sans entrée de
        // menu, l'écran n'était atteignable qu'en tapant son URL, et la
        // demande d'une banque restait en attente indéfiniment.
        href: '/chues/demandes-clients',
        label: 'Demandes clients',
        icon: UserPlusIcon,
        description: 'Créations demandées par les banques',
        roles: ['ADMIN'],
      },
      {
        /**
         * Le SUIVI de ses propres demandes, pour un agent bancaire.
         *
         * Refuser une demande lui envoie une notification dont la route est
         * `/chues/demandes-clients` : sans cette entrée, le seul chemin vers l'écran
         * était ce lien-là, et rien ne permettait d'y revenir ensuite. L'API
         * restreint la liste à `requestedById = user.id` : il n'y voit que ses
         * demandes, et l'écran ne lui propose aucun geste d'arbitrage.
         */
        href: '/chues/demandes-clients',
        label: 'Mes demandes',
        icon: UserPlusIcon,
        description: 'Créations de client demandées',
        roles: ['BANQUE_FINANCE'],
      },
      {
        href: '/chues/dossiers/etapes',
        label: 'Étapes bancaires',
        icon: ListOrderedIcon,
        description: 'Flux de traitement',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    coque: 'grand-public',
    title: null,
    items: [
      {
        href: '/grand-public/tableau-de-bord',
        label: 'Tableau de bord',
        icon: LayoutDashboardIcon,
        description: 'Indicateurs et graphiques',
        roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR'],
      },
      {
        href: '/grand-public',
        label: 'Prospects',
        icon: UsersIcon,
        description: 'Liste filtrable des prospects',
        roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR', 'COMMERCIAL'],
      },
      {
        href: '/grand-public/statistiques',
        label: 'Statistiques',
        icon: ChartColumnIcon,
        description: 'Activité et conversion',
        roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR'],
      },
      {
        href: '/grand-public/campagnes',
        label: 'Campagnes',
        icon: MegaphoneIcon,
        description: 'Campagnes d’appels prospects',
        roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR'],
      },
    ],
  },
  {
    coque: 'grand-public',
    title: 'Terrain',
    items: [
      {
        href: '/grand-public/console',
        label: 'Console d’appel',
        icon: HeadsetIcon,
        description: 'File d’appels et qualification',
        roles: ['ADMIN', 'COMMERCIAL'],
      },
      {
        href: '/grand-public/rappels',
        label: 'Rappels',
        icon: ClockIcon,
        description: 'Échéances promises et retards',
        roles: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        href: '/grand-public/suggestions',
        label: 'Numéros suggérés',
        icon: PhoneForwardedIcon,
        description: 'Contacts suggérés pendant les appels',
        roles: ['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        href: '/grand-public/nouveau',
        label: 'Nouveau prospect',
        icon: PlusCircleIcon,
        description: 'Saisie d’un prospect',
        roles: ['ADMIN', 'COMMERCIAL'],
      },
    ],
  },
  {
    coque: 'admin',
    title: null,
    items: [
      {
        href: '/admin/commerciaux',
        label: 'Utilisateurs',
        icon: UsersIcon,
        description: 'Comptes, rôles et accès',
        roles: ['ADMIN'],
      },
      {
        href: '/admin/referentiels',
        label: 'Référentiels',
        icon: LibraryIcon,
        description: 'Départements, banques, syndicats',
        roles: ['ADMIN'],
      },
      {
        // Après les référentiels : un classeur ne peut nommer que des banques,
        // syndicats, départements et IEF déjà enregistrés.
        href: '/admin/imports',
        label: 'Imports',
        icon: UploadIcon,
        description: 'Dépôt de classeurs et suivi des travaux',
        roles: ['ADMIN'],
      },
      {
        // La cloche montre ce qu'on REÇOIT ; cet écran sert à ÉMETTRE.
        href: '/admin/notifications',
        label: 'Notifications',
        icon: BellIcon,
        description: 'Annonces et rappels envoyés',
        roles: ['ADMIN'],
      },
      {
        href: '/admin/parametres',
        label: 'Paramètres',
        icon: SettingsIcon,
        description: 'Démonstration et suppression',
        roles: ['ADMIN'],
      },
    ],
  },
];

/** Coque d'une route, comparée sur le SEGMENT : `/administration` n'est pas `/admin`. */
export function coqueOf(pathname: string): Coque | null {
  const match = COQUES.find(
    (coque) => pathname === coque.path || pathname.startsWith(`${coque.path}/`),
  );
  return match?.id ?? null;
}

export function coqueAllowed(role: Role, coque: Coque): boolean {
  return COQUES.find((entry) => entry.id === coque)?.roles.includes(role) === true;
}

/**
 * Les QUATRE tuiles, toujours, avec l'autorisation de chacune.
 *
 * Le hub ne cache pas les projets hors de portée : il les grise. Un compte
 * d'accueil voit ainsi que CHUES existe sans pouvoir l'ouvrir, plutôt que de
 * découvrir six mois plus tard qu'on lui parlait d'un écran invisible.
 */
export function coquesForRole(role: Role): { entry: CoqueEntry; allowed: boolean }[] {
  return COQUES.map((entry) => ({ entry, allowed: entry.roles.includes(role) }));
}

/** Sections de cette coque visibles par ce rôle. Une section vide disparaît. */
export function navSections(role: Role, coque: Coque): NavSection[] {
  return SECTIONS.filter((section) => section.coque === coque)
    .map((section) => ({
      coque: section.coque,
      title: section.title,
      items: section.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);
}

/** À plat, pour les recherches par chemin. */
export function navItems(role: Role, coque: Coque): NavItem[] {
  return navSections(role, coque).flatMap((section) => section.items);
}

/** Premier écran d'une coque pour ce rôle. */
export function coqueHomePath(role: Role, coque: Coque): string {
  const first = navItems(role, coque)[0];
  return first?.href ?? HUB_PATH;
}

/**
 * Écran d'atterrissage après connexion : le hub, pour TOUT LE MONDE.
 *
 * Y compris un compte d'accueil, qui n'a qu'une tuile ouverte : le détour
 * coûte un clic et donne à tous le même point de départ, donc la même
 * explication au téléphone. Un rôle sans aucune coque n'a rien à faire dans le
 * panel et retombe sur la connexion.
 */
export function homePathForRole(role: Role): string {
  return coquesForRole(role).some(({ allowed }) => allowed) ? HUB_PATH : '/connexion';
}

/**
 * Titre de la barre supérieure, dérivé de la route.
 *
 * Correspondance par PRÉFIXE le plus long : `/chues/dossiers/nouveau` doit
 * afficher « Nouveau dossier » et non « Dossiers », alors que
 * `/chues/dossiers/abc-123` doit bien afficher « Dossiers ». Trier par longueur
 * décroissante règle les deux cas d'un coup.
 */
export function navTitle(role: Role, pathname: string): string {
  return matchNavItem(role, pathname)?.label ?? 'CPI GO';
}

/** L'entrée est-elle celle de la page courante ? Même règle que `navTitle`. */
export function isNavItemActive(role: Role, pathname: string, item: NavItem): boolean {
  return matchNavItem(role, pathname)?.href === item.href;
}

function matchNavItem(role: Role, pathname: string): NavItem | undefined {
  const coque = coqueOf(pathname);
  if (coque === null) return undefined;
  return [...navItems(role, coque)]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
