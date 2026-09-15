import {
  ActivityIcon,
  ArchiveIcon,
  BellIcon,
  ClipboardListIcon,
  ClockIcon,
  ContactRoundIcon,
  DatabaseIcon,
  FileSpreadsheetIcon,
  FolderOpenIcon,
  HeadsetIcon,
  HouseIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MailIcon,
  MegaphoneIcon,
  PhoneCallIcon,
  PhoneForwardedIcon,
  PlugZapIcon,
  PlusCircleIcon,
  ScrollTextIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  UploadIcon,
  UserPlusIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from 'lucide-react';

import type { Role } from '@/lib/types';

/** Écran de choix, seul atterrissage après connexion. */
export const HUB_PATH = '/espaces';

/**
 * La boîte de réception, HORS COQUE.
 *
 * Elle vit sous `/notifications` et non sous `/admin/*` : la coque Admin
 * n'ouvre aucune entrée de menu aux autres rôles, et la barre latérale y était
 * vide pour eux. `/admin/notifications` reste le composeur de l'ADMIN.
 */
export const INBOX_PATH = '/notifications';

/**
 * Les rôles qui reçoivent des notifications LISIBLES DANS LE PANEL. Le
 * téléconseiller et le chargé de clientèle en sont absents : les leurs visent
 * l'application mobile.
 */
export const INBOX_ROLES: readonly Role[] = [
  'ADMIN',
  'DIRECTION',
  'SUPERVISEUR',
  'BANQUE_FINANCE',
  'ACCUEIL',
];

export const hasInbox = (role: Role): boolean => INBOX_ROLES.includes(role);

/** L'ADMIN lit la sienne dans le composeur, qui porte le même onglet. */
export const inboxPathFor = (role: Role): string =>
  role === 'ADMIN' ? '/admin/notifications?onglet=reception' : INBOX_PATH;

export type Coque = 'accueil' | 'teleconseil' | 'finance' | 'admin';

export interface CoqueEntry {
  id: Coque;
  label: string;
  /** Racine de la coque ; toute route en dessous en porte la palette. */
  path: string;
  description: string;
  roles: readonly Role[];
}

/**
 * Les quatre entrées de l'application unifiée.
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
    id: 'teleconseil',
    label: 'Commercial',
    path: '/teleconseil',
    description: 'Prospection, qualification, rappels et campagnes d’appels',
    roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR', 'COMMERCIAL', 'CHARGE_CLIENTELE', 'CCP'],
  },
  {
    id: 'finance',
    label: 'Banque & Finance',
    path: '/finance',
    description: 'Dossiers bancaires et demandes de création de client',
    roles: ['ADMIN', 'BANQUE_FINANCE', 'SUPERVISEUR', 'DIRECTION'],
  },
  {
    id: 'admin',
    label: 'Admin',
    path: '/admin',
    description: 'Comptes, listes de référence, imports et paramètres',
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
  /**
   * Rangée sous « Plus », repliée. L'écran sert quelques fois par semaine ; le
   * laisser en pleine barre allonge la liste que l'œil doit trier chaque matin
   * pour retrouver les quelques entrées du travail quotidien.
   */
  secondary?: boolean;
  /**
   * Jamais dans la barre. L'écran s'atteint par un onglet, un bouton ou un
   * lien ; il garde son titre et sa surbrillance, que `navTitle` et
   * `isNavItemActive` lisent dans la liste COMPLÈTE.
   */
  hidden?: boolean;
  /** Entrée de la barre à surligner quand cet écran caché s'ouvre par un onglet de pilotage. */
  onglet?: string;
}

export interface NavSection {
  coque: Coque;
  /** `null` pour la première section d'une coque, qui n'a pas besoin d'intitulé. */
  title: string | null;
  items: readonly NavItem[];
}

/**
 * Les rôles qui font eux-mêmes les trois étapes du projet CHUES. Ils lisent les
 * mêmes intitulés dans le même ordre : une seule suite d'entrées les sert tous,
 * et on n'explique qu'un seul parcours au téléphone.
 */
const TERRAIN: readonly Role[] = [
  'ADMIN',
  'COMMERCIAL',
  'CHARGE_CLIENTELE',
  'SUPERVISEUR',
  'DIRECTION',
];
/** Ceux qui, en plus de leurs propres appels, suivent le travail des autres. */
const ENCADREMENT: readonly Role[] = ['ADMIN', 'SUPERVISEUR', 'DIRECTION'];

/**
 * Navigation filtrée par coque puis par rôle ; l'autorisation serveur reste la
 * règle.
 *
 * Une SEULE section par coque, et l'ordre des entrées EST l'ordre de la barre.
 * L'ADMIN et l'agent bancaire gardent leur propre suite d'entrées, écrite
 * d'affilée : ils ne lisent ni les mêmes intitulés ni le même ordre sur les
 * mêmes écrans.
 */
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
      // Les trois écrans qui suivent sont les ONGLETS du registre
      // (`visites-tabs.tsx`, monté par `accueil/layout.tsx`) : les répéter dans
      // la barre donnait deux chemins pour le même clic.
      {
        href: '/accueil/tableau-de-bord',
        label: 'Tableau de bord',
        icon: LayoutDashboardIcon,
        description: 'Affluence et motifs de visite',
        roles: ['ADMIN', 'DIRECTION', 'ACCUEIL'],
        hidden: true,
      },
      {
        // Les quatre listes qui alimentent la saisie du registre. Fermé à
        // l'ACCUEIL : ce sont les entrées qu'il choisit, pas qu'il tient.
        href: '/accueil/listes',
        label: 'Listes',
        icon: ListIcon,
        description: 'Entreprises, directions, destinataires, objets',
        roles: ['ADMIN', 'DIRECTION'],
        hidden: true,
      },
      {
        // Modification de masse par aller-retour Excel : fermé à l'ACCUEIL,
        // qui saisit ligne à ligne et n'a pas à corriger le registre en bloc.
        href: '/accueil/import',
        label: 'Import du registre',
        icon: UploadIcon,
        description: 'Export, correction et réimport en masse',
        roles: ['ADMIN', 'DIRECTION'],
        hidden: true,
      },
      {
        // Destruction définitive d'une visite : la direction seule, et seulement
        // au bout de trente jours. L'accueil archive, il ne détruit pas.
        href: '/accueil/archives',
        label: 'Visites archivées',
        icon: ArchiveIcon,
        description: 'Retirées du registre, à détruire après trente jours',
        roles: ['DIRECTION'],
        secondary: true,
      },
    ],
  },
  {
    coque: 'teleconseil',
    title: null,
    items: [
      {
        href: '/teleconseil/tableau-de-bord',
        label: 'Tableau de bord',
        icon: LayoutDashboardIcon,
        description: 'Appels, adhésions et encaissements',
        roles: ENCADREMENT,
      },
      {
        href: '/teleconseil/leads-importes',
        label: 'Leads importés',
        icon: UploadIcon,
        description: 'Fiches très intéressées et qualité des classeurs',
        roles: ENCADREMENT,
      },
      {
        href: '/teleconseil',
        label: 'Mon travail',
        icon: HouseIcon,
        description: 'Les trois étapes, dans l’ordre',
        roles: ['COMMERCIAL', 'CHARGE_CLIENTELE'],
      },
      {
        href: '/teleconseil',
        label: 'Les trois étapes',
        icon: HouseIcon,
        description: 'Qualifier, ajouter, convertir',
        roles: ENCADREMENT,
        hidden: true,
      },
      {
        href: '/teleconseil/appels-representants',
        label: 'Appels représentants',
        icon: PhoneCallIcon,
        description: 'Première étape',
        roles: TERRAIN,
      },
      {
        href: '/teleconseil/console',
        label: 'Fiches',
        icon: HeadsetIcon,
        description: 'Dernière étape',
        roles: ['ADMIN', 'SUPERVISEUR', 'COMMERCIAL', 'CHARGE_CLIENTELE'],
      },
      {
        href: '/teleconseil/plateforme',
        label: 'Fiches plateforme',
        icon: HeadsetIcon,
        description: 'Les inscrits des plateformes d’enrôlement',
        roles: ['CCP'],
      },
      {
        href: '/teleconseil/rappels',
        label: 'Rappels promis',
        icon: ClockIcon,
        description: 'Ce qu’on a promis de rappeler',
        roles: [...TERRAIN, 'CCP'],
      },
      {
        href: '/teleconseil/supervision',
        label: 'Tableau de bord',
        icon: ActivityIcon,
        description: 'Activité et présence des téléconseillers',
        roles: ENCADREMENT,
        hidden: true,
        onglet: '/teleconseil/tableau-de-bord',
      },
      {
        href: '/teleconseil/mes-contacts',
        label: 'Mes contacts',
        icon: ContactRoundIcon,
        description: 'Les personnes que j’ai appelées',
        roles: TERRAIN,
        secondary: true,
      },
      {
        href: '/teleconseil/suggestions',
        label: 'Contacts recommandés',
        icon: PhoneForwardedIcon,
        description: 'Numéros donnés par les représentants',
        roles: TERRAIN,
        secondary: true,
      },
      {
        href: '/teleconseil/representants',
        label: 'Représentants',
        icon: UsersRoundIcon,
        description: 'Les enseignants déjà appelés',
        roles: TERRAIN,
        secondary: true,
      },
      {
        href: '/teleconseil/prospects',
        label: 'Prospects',
        icon: UsersIcon,
        description: 'Les fiches déjà notées',
        roles: TERRAIN,
        secondary: true,
      },
      {
        href: '/teleconseil/campagnes',
        label: 'Campagnes d’appels',
        icon: MegaphoneIcon,
        description: 'Fiches exportées et distribution',
        roles: ENCADREMENT,
      },
      {
        href: '/teleconseil/parametres-chues',
        label: 'Paramètres téléconseil',
        icon: SlidersHorizontalIcon,
        description: 'Réglages CHUES et Grand Public',
        roles: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
        secondary: true,
      },
      {
        href: '/teleconseil/representants/import',
        label: 'Importer des représentants',
        icon: UploadIcon,
        description: 'Classeur de représentants',
        roles: ['ADMIN'],
        hidden: true,
      },
    ],
  },
  {
    coque: 'finance',
    title: null,
    items: [
      {
        href: '/finance',
        label: 'Vue d’ensemble',
        icon: LayoutDashboardIcon,
        description: 'Encaissements, rejets et délais',
        roles: ['ADMIN', 'BANQUE_FINANCE', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        href: '/finance/dossiers',
        label: 'Dossiers bancaires',
        icon: FolderOpenIcon,
        description: 'Dossiers déposés en banque',
        roles: ['ADMIN', 'BANQUE_FINANCE'],
      },
      {
        href: '/finance/dossiers/nouveau',
        label: 'À ouvrir (plateforme)',
        icon: PlusCircleIcon,
        description: 'Ouverture de dossier',
        roles: ['ADMIN', 'BANQUE_FINANCE'],
      },
      {
        href: '/finance/demandes-clients',
        label: 'Demandes de création de client',
        icon: UserPlusIcon,
        description: 'Créations de client demandées',
        roles: ['ADMIN', 'BANQUE_FINANCE'],
      },
      {
        href: '/finance/dossiers/export',
        label: 'Exporter les dossiers',
        icon: FileSpreadsheetIcon,
        description: 'Classeur Dossiers · Historique · Synthèse',
        roles: ['ADMIN', 'BANQUE_FINANCE'],
        secondary: true,
      },
      {
        href: '/finance/dossiers/etapes',
        label: 'Étapes des dossiers',
        icon: ListOrderedIcon,
        description: 'Flux de traitement',
        roles: ['ADMIN'],
        secondary: true,
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
        label: 'Listes de référence',
        icon: LibraryIcon,
        description: 'Départements, banques, syndicats',
        roles: ['ADMIN', 'SUPERVISEUR', 'DIRECTION'],
      },
      {
        // Après les listes de référence : un classeur ne peut nommer que des
        // banques, syndicats, départements et IEF déjà enregistrés.
        href: '/admin/imports',
        label: 'Importer un fichier Excel',
        icon: UploadIcon,
        description: 'Dépôt de classeurs et suivi des travaux',
        roles: ['ADMIN'],
      },
      {
        // La cloche montre ce qu'on REÇOIT ; cet écran sert à ÉMETTRE.
        href: '/admin/notifications',
        label: 'Envoyer une notification',
        icon: BellIcon,
        description: 'Annonces et rappels envoyés',
        roles: ['ADMIN'],
      },
      {
        href: '/admin/courriels',
        label: 'Courriels',
        icon: MailIcon,
        description: 'Destinataires et textes des envois automatiques',
        roles: ['ADMIN'],
      },
      {
        // Le suivi de l'enrôlement, tenu par la cellule pilotage et
        // performance. Elle est le seul usage du rôle ADMIN, et rien de ce que
        // rendent les plateformes n'est lisible ailleurs dans l'application.
        href: '/admin/enrolement',
        label: 'Plateformes d’enrôlement',
        icon: PlugZapIcon,
        description: 'Inscriptions CHUES et Grand Public',
        roles: ['ADMIN'],
      },
      {
        href: '/admin/journal',
        label: 'Journal des actions',
        icon: ScrollTextIcon,
        description: 'Qui a fait quoi : campagnes, comptes, enrôlement, base',
        roles: ['ADMIN'],
      },
      {
        href: '/admin/parametres',
        label: 'Paramètres',
        icon: SettingsIcon,
        description: 'Démonstration et suppression',
        roles: ['ADMIN'],
      },
      {
        // Sous « Plus » : on règle le formulaire une fois, on ne le rouvre pas
        // chaque jour, et la barre tient à six entrées.
        href: '/admin/champs-conversion',
        label: 'Champs de la conversion',
        icon: ListChecksIcon,
        description: 'Ordre, visibilité et champs ajoutés',
        roles: ['ADMIN'],
        secondary: true,
      },
      {
        href: '/admin/exploitation',
        label: 'Exploitation',
        icon: ActivityIcon,
        description: 'Trafic, erreurs, tâches planifiées et courriels',
        roles: ['ADMIN'],
        secondary: true,
      },
      {
        href: '/admin/bases',
        label: 'Bases de démonstration',
        icon: DatabaseIcon,
        description: 'Copies d’exemple pour former, sans toucher aux données réelles',
        roles: ['ADMIN'],
        secondary: true,
      },
    ],
  },
];

/** Coque d'une route, comparée sur le SEGMENT : `/administration` n'est pas `/admin`. */
export function coqueOf(pathname: string): Coque | null {
  const match = COQUES.find(
    (coque) => pathname === coque.path || pathname.startsWith(`${coque.path}/`),
  );
  if (match) return match.id;
  if (
    pathname.startsWith('/chues/banque') ||
    pathname.startsWith('/chues/dossiers') ||
    pathname.startsWith('/chues/demandes-clients') ||
    pathname.startsWith('/grand-public/banque') ||
    pathname.startsWith('/grand-public/dossiers')
  ) {
    return 'finance';
  }
  if (pathname.startsWith('/chues') || pathname.startsWith('/grand-public')) {
    return 'teleconseil';
  }
  return null;
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

/** Tout ce que ce rôle peut ouvrir dans cette coque, entrées hors barre comprises. */
function everyItem(role: Role, coque: Coque): NavItem[] {
  return SECTIONS.filter((section) => section.coque === coque).flatMap((section) =>
    section.items.filter((item) => item.roles.includes(role)),
  );
}

/** Sections de cette coque visibles par ce rôle. Une section vide disparaît. */
export function navSections(role: Role, coque: Coque): NavSection[] {
  return SECTIONS.filter((section) => section.coque === coque)
    .map((section) => ({
      coque: section.coque,
      title: section.title,
      items: section.items.filter((item) => item.roles.includes(role) && item.hidden !== true),
    }))
    .filter((section) => section.items.length > 0);
}

/** À plat, pour les recherches par chemin. */
function navItems(role: Role, coque: Coque): NavItem[] {
  return navSections(role, coque).flatMap((section) => section.items);
}

/** Premier écran d'une coque pour ce rôle : le premier de la barre, replis exclus. */
export function coqueHomePath(role: Role, coque: Coque): string {
  const first = navItems(role, coque).find((item) => item.secondary !== true);
  return first?.href ?? HUB_PATH;
}

/**
 * Écran d'atterrissage après connexion : premier écran selon le rôle.
 *
 * - Accueil : registre des visites (`/accueil`) ;
 * - téléconseiller et chargé de clientèle : Mon travail (`/teleconseil`) ;
 * - direction : leads importés (`/teleconseil/leads-importes`) ;
 * - superviseur, admin : tableau de bord Téléconseil (`/teleconseil/tableau-de-bord`) ;
 * - Banque & Finance : vue d’ensemble (`/finance`).
 */
export function homePathForRole(role: Role): string {
  switch (role) {
    case 'ACCUEIL':
      return '/accueil';
    case 'COMMERCIAL':
    case 'CHARGE_CLIENTELE':
      return '/teleconseil';
    case 'CCP':
      return '/teleconseil/plateforme';
    case 'DIRECTION':
      return '/teleconseil/leads-importes';
    case 'SUPERVISEUR':
    case 'ADMIN':
      return '/teleconseil/tableau-de-bord';
    case 'BANQUE_FINANCE':
      return '/finance';
    default:
      return '/connexion';
  }
}

/**
 * Titre de la barre supérieure, dérivé de la route.
 *
 * Correspondance par PRÉFIXE le plus long : `/chues/dossiers/nouveau` doit
 * afficher « Ouvrir un dossier » et non « Dossiers bancaires », alors que
 * `/chues/dossiers/abc-123` doit bien afficher « Dossiers bancaires ». Trier
 * par longueur décroissante règle les deux cas d'un coup.
 */
export function navTitle(role: Role, pathname: string): string {
  if (pathname === INBOX_PATH) return 'Notifications';
  return matchNavItem(role, pathname)?.label ?? 'CPI GO';
}

/**
 * Coque à afficher dans la barre latérale d'un écran hors coque : la première
 * ouverte au rôle. Sans elle, la boîte de réception n'offrirait aucun chemin
 * de retour.
 */
export function fallbackCoque(role: Role): Coque | null {
  return COQUES.find((entry) => entry.roles.includes(role))?.id ?? null;
}

/** L'entrée est-elle celle de la page courante ? Même règle que `navTitle`. */
export function isNavItemActive(role: Role, pathname: string, item: NavItem): boolean {
  const courant = matchNavItem(role, pathname);
  return (courant?.onglet ?? courant?.href) === item.href;
}

function matchNavItem(role: Role, pathname: string): NavItem | undefined {
  const coque = coqueOf(pathname);
  if (coque === null) return undefined;
  // Sur la liste COMPLÈTE : un écran hors barre garde son titre et sa
  // surbrillance, c'est tout ce que `hidden` lui retire.
  return everyItem(role, coque)
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
