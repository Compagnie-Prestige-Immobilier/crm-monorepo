import {
  ActivityIcon,
  ArchiveIcon,
  BellIcon,
  BotIcon,
  HeartHandshakeIcon,
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
  SparklesIcon,
  UploadIcon,
  UserPlusIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from 'lucide-react';

import { type Permission, peut, type Role, type SessionUser } from '@/lib/types';

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
 * Les rôles qui reçoivent des notifications LISIBLES DANS LE PANEL. Le panneau
 * web est le seul client depuis l'abandon de l'application mobile : tous les
 * rôles qui reçoivent des notifications côté serveur les lisent ici.
 */
export const INBOX_ROLES: readonly Role[] = [
  'ADMIN',
  'DIRECTION',
  'SUPERVISEUR',
  'BANQUE_FINANCE',
  'ACCUEIL',
  'COMMERCIAL',
  'CHARGE_CLIENTELE',
];

export const hasInbox = (role: Role): boolean => INBOX_ROLES.includes(role);

/** L'ADMIN lit la sienne dans le composeur, qui porte le même onglet. */
export const inboxPathFor = (role: Role): string =>
  role === 'ADMIN' ? '/admin/notifications?onglet=reception' : INBOX_PATH;

export type Coque = 'accueil' | 'teleconseil' | 'finance' | 'ventes' | 'admin';

/**
 * La permission que garde la route ; une liste de rôles là où aucune
 * permission n'a exactement le même ensemble, et le rôle de base décide.
 */
type Acces = Permission | readonly Role[] | ((visiteur: Visiteur) => boolean);

export type Visiteur = Pick<SessionUser, 'role' | 'permissions'>;

const ouvert = (visiteur: Visiteur, acces: Acces): boolean => {
  if (typeof acces === 'function') return acces(visiteur);
  return typeof acces === 'string' ? peut(visiteur, acces) : acces.includes(visiteur.role);
};

export interface CoqueEntry {
  id: Coque;
  label: string;
  /** Racine de la coque ; toute route en dessous en porte la palette. */
  path: string;
  description: string;
  acces: Acces;
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
    acces: 'accueil.registre',
  },
  {
    id: 'teleconseil',
    label: 'Téléconseil',
    path: '/teleconseil',
    description: 'Prospection, qualification, rappels et campagnes d’appels',
    acces: 'fiches.tenir',
  },
  {
    id: 'finance',
    label: 'Banque & Finance',
    path: '/finance',
    description: 'Dossiers bancaires et demandes de création de client',
    acces: 'banque.lire',
  },
  {
    id: 'ventes',
    label: 'Ventes',
    path: '/ventes',
    description: 'Tableau des ventes, échéances et encaissements par site',
    acces: 'ventes.lire',
  },
  {
    id: 'admin',
    label: 'Admin',
    path: '/admin',
    description: 'Comptes, listes de référence, imports et paramètres',
    acces: ['ADMIN'],
  },
];

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  acces: Acces;
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
        acces: 'accueil.registre',
      },
      {
        href: '/accueil/rendez-vous',
        label: 'Rendez-vous',
        icon: HeartHandshakeIcon,
        description: 'Rendez-vous obtenus au téléphone, à confirmer au comptoir',
        acces: 'rendez_vous.voir',
        hidden: true,
      },
      // Les trois écrans qui suivent sont les ONGLETS du registre
      // (`visites-tabs.tsx`, monté par `accueil/layout.tsx`) : les répéter dans
      // la barre donnait deux chemins pour le même clic.
      {
        href: '/accueil/tableau-de-bord',
        label: 'Tableau de bord',
        icon: LayoutDashboardIcon,
        description: 'Affluence et motifs de visite',
        acces: 'accueil.registre',
        hidden: true,
      },
      {
        // Les quatre listes qui alimentent la saisie du registre. Fermé à
        // l'ACCUEIL : ce sont les entrées qu'il choisit, pas qu'il tient.
        href: '/accueil/listes',
        label: 'Listes',
        icon: ListIcon,
        description: 'Entreprises, directions, destinataires, objets',
        acces: 'accueil.listes',
        hidden: true,
      },
      {
        // Modification de masse par aller-retour Excel : fermé à l'ACCUEIL,
        // qui saisit ligne à ligne et n'a pas à corriger le registre en bloc.
        href: '/accueil/import',
        label: 'Import du registre',
        icon: UploadIcon,
        description: 'Export, correction et réimport en masse',
        acces: 'accueil.listes',
        hidden: true,
      },
      {
        // Destruction définitive d'une visite : la direction seule, et seulement
        // au bout de trente jours. L'accueil archive, il ne détruit pas.
        href: '/accueil/archives',
        label: 'Visites archivées',
        icon: ArchiveIcon,
        description: 'Retirées du registre, à détruire après trente jours',
        acces: 'visites.voir_archivees',
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
        acces: 'analytics.superviser',
      },
      {
        href: '/teleconseil/leads-importes',
        label: 'Leads importés',
        icon: UploadIcon,
        description: 'Fiches très intéressées et qualité des classeurs',
        acces: 'analytics.superviser',
      },
      {
        href: '/teleconseil',
        label: 'Mon travail',
        icon: HouseIcon,
        description: 'Les trois étapes, dans l’ordre',
        acces: ['COMMERCIAL', 'CHARGE_CLIENTELE'],
      },
      {
        href: '/teleconseil',
        label: 'Les trois étapes',
        icon: HouseIcon,
        description: 'Qualifier, ajouter, convertir',
        acces: ENCADREMENT,
        hidden: true,
      },
      {
        href: '/teleconseil/appels-representants',
        label: 'Fiche représentant',
        icon: PhoneCallIcon,
        description: 'Première étape',
        acces: TERRAIN,
      },
      {
        href: '/teleconseil/console',
        label: 'Fiche prospect',
        icon: HeadsetIcon,
        description: 'Dernière étape',
        acces: 'prospects.convertir',
      },
      {
        href: '/teleconseil/rappels',
        label: 'Rappels promis',
        icon: ClockIcon,
        description: 'Ce qu’on a promis de rappeler',
        acces: 'fiches.tenir',
      },
      {
        href: '/teleconseil/supervision',
        label: 'Superviser l’équipe',
        icon: ActivityIcon,
        description: 'Activité et présence des téléconseillers',
        acces: 'analytics.superviser',
      },
      {
        href: '/teleconseil/mes-contacts',
        label: 'Mes contacts',
        icon: ContactRoundIcon,
        description: 'Les personnes que j’ai appelées',
        acces: TERRAIN,
        secondary: true,
      },
      {
        href: '/teleconseil/suggestions',
        label: 'Contacts recommandés',
        icon: PhoneForwardedIcon,
        description: 'Numéros donnés par les représentants',
        acces: TERRAIN,
        secondary: true,
      },
      {
        href: '/teleconseil/representants',
        label: 'Représentants',
        icon: UsersRoundIcon,
        description: 'Les enseignants déjà appelés',
        acces: TERRAIN,
        secondary: true,
      },
      {
        href: '/teleconseil/prospects',
        label: 'Prospects',
        icon: UsersIcon,
        description: 'Les fiches déjà notées',
        // Le téléconseiller et le chargé de clientèle appellent depuis leur
        // console : cette liste suit le travail des autres.
        acces: 'prospects.superviser',
        secondary: true,
      },
      {
        href: '/teleconseil/interesses',
        label: 'Intéressés, hésitants et RDV',
        icon: HeartHandshakeIcon,
        description: 'Fiches fermées à suivre',
        acces: 'prospects.superviser',
      },
      {
        href: '/teleconseil/interesses',
        label: 'Rendez-vous',
        icon: HeartHandshakeIcon,
        description: 'Rendez-vous obtenus et leur suivi',
        acces: (visiteur) =>
          !peut(visiteur, 'prospects.superviser') && peut(visiteur, 'rendez_vous.suivre'),
      },
      {
        href: '/teleconseil/campagnes',
        label: 'Campagnes d’appels',
        icon: MegaphoneIcon,
        description: 'Fiches exportées et distribution',
        acces: 'campagnes.superviser',
      },
      {
        href: '/teleconseil/pole-deploiement',
        label: 'Pôle déploiement',
        icon: UsersRoundIcon,
        description: 'Qualité de la base représentants et rendement départemental',
        acces: 'analytics.superviser',
        hidden: true,
        onglet: '/teleconseil/tableau-de-bord',
      },
      {
        href: '/teleconseil/pole-marketing',
        label: 'Pôle marketing',
        icon: ActivityIcon,
        description: 'Qualité des prospects amenés et conversion par canal',
        acces: 'analytics.superviser',
        hidden: true,
        onglet: '/teleconseil/tableau-de-bord',
      },
      {
        href: '/teleconseil/parametres-chues',
        label: 'Paramètres',
        icon: SlidersHorizontalIcon,
        description: 'Réglages CHUES et Grand Public',
        acces: 'prospects.superviser',
        secondary: true,
      },
      {
        href: '/teleconseil/representants/import',
        label: 'Importer des représentants',
        icon: UploadIcon,
        description: 'Classeur de représentants',
        acces: 'imports.administrer',
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
        acces: 'banque.lire',
      },
      {
        href: '/finance/dossiers',
        label: 'Dossiers bancaires',
        icon: FolderOpenIcon,
        description: 'Dossiers déposés en banque',
        acces: 'banque.dossiers',
      },
      {
        href: '/finance/dossiers/nouveau',
        label: 'À ouvrir (plateforme)',
        icon: PlusCircleIcon,
        description: 'Ouverture de dossier',
        acces: 'banque.dossiers',
      },
      {
        href: '/finance/demandes-clients',
        label: 'Demandes de création de client',
        icon: UserPlusIcon,
        description: 'Créations de client demandées',
        acces: 'banque.dossiers',
      },
      {
        href: '/finance/dossiers/export',
        label: 'Exporter les dossiers',
        icon: FileSpreadsheetIcon,
        description: 'Classeur Dossiers · Historique · Synthèse',
        acces: 'exports.banque',
        secondary: true,
      },
      {
        href: '/finance/dossiers/etapes',
        label: 'Étapes des dossiers',
        icon: ListOrderedIcon,
        description: 'Flux de traitement',
        acces: 'banque.administrer',
        secondary: true,
      },
    ],
  },
  {
    coque: 'ventes',
    title: null,
    items: [
      {
        href: '/ventes/nouvelle',
        label: 'Nouvelle vente',
        icon: PlusCircleIcon,
        description: 'Enregistrer une vente pas à pas',
        acces: 'ventes.lire',
      },
      {
        href: '/ventes',
        label: 'Toutes les ventes',
        icon: FileSpreadsheetIcon,
        description: 'Ventes, échéances et sites',
        acces: 'ventes.lire',
      },
      {
        href: '/ventes/echeances',
        label: 'Échéances',
        icon: ClockIcon,
        description: 'Versements attendus et reçus',
        acces: 'ventes.lire',
      },
      {
        href: '/ventes/sites',
        label: 'Par site',
        icon: LibraryIcon,
        description: 'Lots vendus et restants par site',
        acces: 'ventes.lire',
      },
      {
        href: '/ventes/teleconseillers',
        label: 'Par téléconseiller',
        icon: UsersIcon,
        description: 'Ventes réalisées par chacun',
        acces: 'ventes.lire',
      },
      {
        href: '/ventes/reglages',
        label: 'Sites et canaux',
        icon: SettingsIcon,
        description: 'Prix, lots et canaux proposés à la saisie',
        acces: 'ventes.lire',
        secondary: true,
      },
    ],
  },
  {
    coque: 'admin',
    title: null,
    items: [
      {
        href: '/admin/tableau-de-bord',
        label: 'Tableau de bord',
        icon: LayoutDashboardIcon,
        description: 'Supervision, enrôlement, déploiement et marketing',
        acces: 'parametres.administrer',
      },
      {
        href: '/admin/assistant',
        label: 'Assistant',
        icon: SparklesIcon,
        description: 'Questions sur les appels, les conversions et les prévisions',
        acces: 'assistant.utiliser',
      },
      {
        href: '/admin/enrolement',
        label: 'Plateformes d’enrôlement',
        icon: PlugZapIcon,
        description: 'Inscriptions CHUES et Grand Public',
        acces: 'enrolement.administrer',
      },
      {
        href: '/admin/commerciaux',
        label: 'Utilisateurs et rôles',
        icon: UsersIcon,
        description: 'Comptes, rôles et accès',
        acces: 'comptes.administrer',
      },
    ],
  },
  {
    coque: 'admin',
    title: 'Référentiels & Données',
    items: [
      {
        href: '/admin/referentiels',
        label: 'Listes de référence',
        icon: LibraryIcon,
        description: 'Départements, banques, syndicats',
        acces: 'referentiels.superviser',
      },
      {
        href: '/admin/imports',
        label: 'Importer un fichier Excel',
        icon: UploadIcon,
        description: 'Dépôt de classeurs et suivi des travaux',
        acces: 'imports.administrer',
      },
      {
        href: '/admin/champs-conversion',
        label: 'Champs de la conversion',
        icon: ListChecksIcon,
        description: 'Ordre, visibilité et champs ajoutés',
        acces: 'formulaires.administrer',
        secondary: true,
      },
    ],
  },
  {
    coque: 'admin',
    title: 'Communication',
    items: [
      {
        href: '/admin/notifications',
        label: 'Envoyer une notification',
        icon: BellIcon,
        description: 'Annonces et rappels envoyés',
        acces: 'notifications.administrer',
      },
      {
        href: '/admin/courriels',
        label: 'Courriels',
        icon: MailIcon,
        description: 'Destinataires et textes des envois automatiques',
        acces: 'courriels.administrer',
      },
    ],
  },
  {
    coque: 'admin',
    title: 'Système & Audit',
    items: [
      {
        href: '/admin/journal',
        label: 'Journal des actions',
        icon: ScrollTextIcon,
        description: 'Qui a fait quoi : campagnes, comptes, enrôlement, base',
        acces: 'exploitation.administrer',
      },
      {
        href: '/admin/parametres',
        label: 'Paramètres',
        icon: SettingsIcon,
        description: 'Démonstration et suppression',
        acces: 'parametres.administrer',
      },
      {
        href: '/admin/exploitation',
        label: 'Exploitation',
        icon: ActivityIcon,
        description: 'Trafic, erreurs, tâches planifiées et courriels',
        acces: 'exploitation.administrer',
        secondary: true,
      },
      {
        href: '/admin/kairo',
        label: 'Kairo',
        icon: BotIcon,
        description: 'Tickets GLPI traités, pause, relance et reformulation IA',
        acces: 'exploitation.administrer',
        secondary: true,
      },
      {
        href: '/admin/bases',
        label: 'Bases de démonstration',
        icon: DatabaseIcon,
        description: 'Copies d’exemple pour former, sans toucher aux données réelles',
        acces: 'bases.administrer',
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
export function coquesForRole(visiteur: Visiteur): { entry: CoqueEntry; allowed: boolean }[] {
  return COQUES.map((entry) => ({ entry, allowed: ouvert(visiteur, entry.acces) }));
}

/** Tout ce que ce rôle peut ouvrir dans cette coque, entrées hors barre comprises. */
function everyItem(visiteur: Visiteur, coque: Coque): NavItem[] {
  return SECTIONS.filter((section) => section.coque === coque).flatMap((section) =>
    section.items.filter((item) => ouvert(visiteur, item.acces)),
  );
}

/** Sections de cette coque visibles par ce rôle. Une section vide disparaît. */
export function navSections(visiteur: Visiteur, coque: Coque): NavSection[] {
  return SECTIONS.filter((section) => section.coque === coque)
    .map((section) => ({
      coque: section.coque,
      title: section.title,
      items: section.items.filter((item) => ouvert(visiteur, item.acces) && item.hidden !== true),
    }))
    .filter((section) => section.items.length > 0);
}

/** À plat, pour les recherches par chemin. */
function navItems(visiteur: Visiteur, coque: Coque): NavItem[] {
  return navSections(visiteur, coque).flatMap((section) => section.items);
}

/** Premier écran d'une coque pour ce rôle : le premier de la barre, replis exclus. */
export function coqueHomePath(visiteur: Visiteur, coque: Coque): string {
  const first = navItems(visiteur, coque).find((item) => item.secondary !== true);
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
export function navTitle(visiteur: Visiteur, pathname: string): string {
  if (pathname === INBOX_PATH) return 'Notifications';
  return matchNavItem(visiteur, pathname)?.label ?? 'CPI GO';
}

/**
 * Coque à afficher dans la barre latérale d'un écran hors coque : la première
 * ouverte au rôle. Sans elle, la boîte de réception n'offrirait aucun chemin
 * de retour.
 */
export function fallbackCoque(visiteur: Visiteur): Coque | null {
  return COQUES.find((entry) => ouvert(visiteur, entry.acces))?.id ?? null;
}

/** L'entrée est-elle celle de la page courante ? Même règle que `navTitle`. */
export function isNavItemActive(visiteur: Visiteur, pathname: string, item: NavItem): boolean {
  const courant = matchNavItem(visiteur, pathname);
  return (courant?.onglet ?? courant?.href) === item.href;
}

function matchNavItem(visiteur: Visiteur, pathname: string): NavItem | undefined {
  const coque = coqueOf(pathname);
  if (coque === null) return undefined;
  // Sur la liste COMPLÈTE : un écran hors barre garde son titre et sa
  // surbrillance, c'est tout ce que `hidden` lui retire.
  return everyItem(visiteur, coque)
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
