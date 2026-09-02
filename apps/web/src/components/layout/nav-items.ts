import {
  ActivityIcon,
  BellIcon,
  ChartColumnIcon,
  ClipboardListIcon,
  ClockIcon,
  ContactRoundIcon,
  FileSpreadsheetIcon,
  FolderOpenIcon,
  HeadsetIcon,
  HouseIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  ListIcon,
  ListOrderedIcon,
  MegaphoneIcon,
  PhoneCallIcon,
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
 * téléconseiller en est absent : les siennes visent l'application mobile.
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
    description: 'Prospection, appels et conversion hors CHUES',
    roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR', 'COMMERCIAL', 'BANQUE_FINANCE'],
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
}

export interface NavSection {
  coque: Coque;
  /** `null` pour la première section d'une coque, qui n'a pas besoin d'intitulé. */
  title: string | null;
  items: readonly NavItem[];
}

/**
 * Les trois rôles qui font eux-mêmes les trois étapes du projet CHUES. Ils
 * lisent les mêmes intitulés dans le même ordre : une seule suite d'entrées les
 * sert tous les trois, et on n'explique qu'un seul parcours au téléphone.
 */
const TERRAIN: readonly Role[] = ['COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'];

/** Ceux qui, en plus de leurs propres appels, suivent le travail des autres. */
const ENCADREMENT: readonly Role[] = ['SUPERVISEUR', 'DIRECTION'];

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
    ],
  },
  {
    coque: 'chues',
    title: null,
    items: [
      // L'encadrement ouvre sur les chiffres ; le téléconseiller sur ses
      // trois étapes.
      {
        href: '/chues/statistiques',
        label: 'Tableau de bord',
        icon: LayoutDashboardIcon,
        description: 'Appels, adhésions et encaissements',
        roles: ENCADREMENT,
      },
      {
        href: '/chues',
        label: 'Mon travail',
        icon: HouseIcon,
        description: 'Les trois étapes, dans l’ordre',
        roles: ['COMMERCIAL'],
      },
      {
        href: '/chues',
        label: 'Les trois étapes',
        icon: HouseIcon,
        description: 'Qualifier, ajouter, convertir',
        roles: ENCADREMENT,
        hidden: true,
      },
      {
        href: '/chues/appels-representants',
        label: 'Qualifier un représentant',
        icon: PhoneCallIcon,
        description: 'Première étape',
        roles: TERRAIN,
      },
      {
        href: '/chues/prospects/nouveau',
        label: 'Ajouter un prospect',
        icon: PlusCircleIcon,
        description: 'Deuxième étape',
        roles: TERRAIN,
      },
      {
        href: '/chues/console',
        label: 'Convertir un prospect',
        icon: HeadsetIcon,
        description: 'Dernière étape',
        roles: TERRAIN,
      },
      {
        href: '/chues/rappels',
        label: 'Rappels promis',
        icon: ClockIcon,
        description: 'Ce qu’on a promis de rappeler',
        roles: TERRAIN,
      },
      {
        // Le seul écran qui montre le travail de chaque téléconseiller ligne à
        // ligne : c'est là que l'encadrement passe le reste de sa journée.
        href: '/chues/supervision',
        label: 'Mon équipe',
        icon: ActivityIcon,
        description: 'Activité et présence des téléconseillers',
        roles: ENCADREMENT,
      },
      {
        href: '/chues/mes-contacts',
        label: 'Mes contacts',
        icon: ContactRoundIcon,
        description: 'Les personnes que j’ai appelées',
        roles: TERRAIN,
        secondary: true,
      },
      {
        href: '/chues/suggestions',
        label: 'Contacts recommandés',
        icon: PhoneForwardedIcon,
        description: 'Numéros donnés par les représentants',
        roles: TERRAIN,
        secondary: true,
      },
      {
        // Sans « Mes » : l'API borne la liste au périmètre de qui la demande
        // (`scope.ts`), et l'encadrement y lit tout le portefeuille.
        href: '/chues/representants',
        label: 'Représentants',
        icon: UsersRoundIcon,
        description: 'Les enseignants déjà appelés',
        roles: TERRAIN,
        secondary: true,
      },
      {
        href: '/chues/prospects',
        label: 'Prospects',
        icon: UsersIcon,
        description: 'Les fiches déjà notées',
        roles: TERRAIN,
        secondary: true,
      },
      {
        href: '/chues/campagnes',
        label: 'Campagnes',
        icon: MegaphoneIcon,
        description: 'Fiches exportées pour le terrain',
        roles: ENCADREMENT,
        secondary: true,
      },

      // ─── Administration ───────────────────────────────────────────────────
      {
        href: '/chues/statistiques',
        label: 'Tableau de bord',
        icon: LayoutDashboardIcon,
        description: 'Appels, adhésions et encaissements',
        roles: ['ADMIN'],
      },
      {
        href: '/chues',
        label: 'Les trois étapes',
        icon: HouseIcon,
        description: 'Qualifier, ajouter, convertir',
        roles: ['ADMIN'],
        secondary: true,
      },
      {
        href: '/chues/prospects',
        label: 'Prospects',
        icon: UsersIcon,
        description: 'Liste filtrable et export',
        roles: ['ADMIN'],
      },
      {
        href: '/chues/representants',
        label: 'Représentants',
        icon: UsersRoundIcon,
        description: 'Enseignants qui donnent les contacts',
        roles: ['ADMIN'],
      },
      {
        href: '/chues/campagnes',
        label: 'Campagnes',
        icon: MegaphoneIcon,
        description: 'Fiches exportées pour le terrain',
        roles: ['ADMIN'],
      },
      {
        href: '/chues/dossiers',
        label: 'Dossiers bancaires',
        icon: FolderOpenIcon,
        description: 'Dossiers déposés en banque',
        roles: ['ADMIN'],
      },
      {
        href: '/chues/supervision',
        label: 'Équipes',
        icon: ActivityIcon,
        description: 'Activité et présence des téléconseillers',
        roles: ['ADMIN'],
        secondary: true,
      },
      {
        href: '/chues/rappels',
        label: 'Rappels',
        icon: ClockIcon,
        description: 'Échéances promises et retards',
        roles: ['ADMIN'],
        secondary: true,
      },
      {
        href: '/chues/mes-contacts',
        label: 'Mes contacts',
        icon: ContactRoundIcon,
        description: 'Les personnes que j’ai appelées',
        roles: ['ADMIN'],
        secondary: true,
      },
      {
        href: '/chues/suggestions',
        label: 'Contacts recommandés',
        icon: PhoneForwardedIcon,
        description: 'Numéros donnés par les représentants',
        roles: ['ADMIN'],
        secondary: true,
      },
      {
        href: '/chues/banque',
        label: 'Vue d’ensemble bancaire',
        icon: ChartColumnIcon,
        description: 'Encaissements, rejets et délais',
        roles: ['ADMIN'],
        secondary: true,
      },
      {
        // L'arbitrage des demandes déposées par les banques. Sans entrée de
        // menu, l'écran n'était atteignable qu'en tapant son URL, et la
        // demande d'une banque restait en attente indéfiniment.
        href: '/chues/demandes-clients',
        label: 'Créations de client à valider',
        icon: UserPlusIcon,
        description: 'Créations demandées par les banques',
        roles: ['ADMIN'],
        secondary: true,
      },
      {
        href: '/chues/dossiers/export',
        label: 'Exporter les dossiers',
        icon: FileSpreadsheetIcon,
        description: 'Classeur Dossiers · Historique · Synthèse',
        roles: ['ADMIN'],
        secondary: true,
      },
      {
        href: '/chues/dossiers/etapes',
        label: 'Étapes des dossiers',
        icon: ListOrderedIcon,
        description: 'Flux de traitement',
        roles: ['ADMIN'],
        secondary: true,
      },
      // Écrans atteints depuis celui qui les motive : les trois appels depuis
      // l'écran d'ouverture du projet, les saisies depuis leur liste.
      {
        href: '/chues/appels-representants',
        label: 'Qualifier un représentant',
        icon: PhoneCallIcon,
        description: 'Première des trois étapes',
        roles: ['ADMIN'],
        hidden: true,
      },
      {
        href: '/chues/console',
        label: 'Convertir un prospect',
        icon: HeadsetIcon,
        description: 'Dernière des trois étapes',
        roles: ['ADMIN'],
        hidden: true,
      },
      {
        href: '/chues/prospects/nouveau',
        label: 'Ajouter un prospect',
        icon: PlusCircleIcon,
        description: 'Deuxième des trois étapes',
        roles: ['ADMIN'],
        hidden: true,
      },
      {
        href: '/chues/dossiers/nouveau',
        label: 'Nouveau dossier',
        icon: PlusCircleIcon,
        description: 'Ouverture de dossier',
        roles: ['ADMIN'],
        hidden: true,
      },
      {
        href: '/chues/representants/import',
        label: 'Importer des représentants',
        icon: UploadIcon,
        description: 'Classeur de représentants',
        roles: ['ADMIN'],
        hidden: true,
      },

      // ─── Banque & Finance ─────────────────────────────────────────────────
      {
        href: '/chues/banque',
        label: 'Vue d’ensemble',
        icon: LayoutDashboardIcon,
        description: 'Encaissements, rejets et délais',
        roles: ['BANQUE_FINANCE'],
      },
      {
        href: '/chues/dossiers',
        label: 'Dossiers bancaires',
        icon: FolderOpenIcon,
        description: 'Dossiers déposés en banque',
        roles: ['BANQUE_FINANCE'],
      },
      {
        href: '/chues/dossiers/nouveau',
        label: 'Ouvrir un dossier',
        icon: PlusCircleIcon,
        description: 'Ouverture de dossier',
        roles: ['BANQUE_FINANCE'],
      },
      {
        /**
         * Le SUIVI de ses propres demandes, pour un agent bancaire.
         *
         * Refuser une demande lui envoie une notification dont la route est
         * `/chues/demandes-clients` : sans cette entrée, le seul chemin vers
         * l'écran était ce lien-là, et rien ne permettait d'y revenir ensuite.
         * L'API restreint la liste à `requestedById = user.id` : il n'y voit
         * que ses demandes, et l'écran ne lui propose aucun arbitrage.
         */
        href: '/chues/demandes-clients',
        label: 'Mes demandes de création',
        icon: UserPlusIcon,
        description: 'Créations de client demandées',
        roles: ['BANQUE_FINANCE'],
      },
      {
        href: '/chues/dossiers/export',
        label: 'Exporter les dossiers',
        icon: FileSpreadsheetIcon,
        description: 'Classeur Dossiers · Historique · Synthèse',
        roles: ['BANQUE_FINANCE'],
        secondary: true,
      },
    ],
  },
  {
    coque: 'grand-public',
    title: null,
    items: [
      // ─── Téléconseiller ───────────────────────────────────────────────────
      {
        href: '/grand-public',
        label: 'Grand Public',
        icon: UsersIcon,
        description: 'Créer, retrouver et suivre les prospects',
        roles: ['COMMERCIAL'],
      },
      {
        href: '/grand-public/console',
        label: 'Appeler les prospects',
        icon: HeadsetIcon,
        description: 'Chercher un prospect et consigner l’appel',
        roles: ['COMMERCIAL'],
      },
      {
        href: '/grand-public/rappels',
        label: 'Rappels promis',
        icon: ClockIcon,
        description: 'Ce qu’on a promis de rappeler',
        roles: ['COMMERCIAL'],
      },
      {
        href: '/grand-public/mes-contacts',
        label: 'Mes contacts',
        icon: ContactRoundIcon,
        description: 'Les personnes que j’ai appelées',
        roles: ['COMMERCIAL'],
        secondary: true,
      },
      {
        href: '/grand-public/nouveau',
        label: 'Noter un prospect',
        icon: PlusCircleIcon,
        description: 'Saisie d’un prospect',
        roles: ['COMMERCIAL'],
        secondary: true,
      },

      /*
       * PAS de « Contacts recommandés » ici. Une suggestion est le numéro d'un
       * tiers nommé par un REPRÉSENTANT syndical : `GET /api/v1/suggestions`
       * n'accepte aucun filtre de projet et la notion n'existe pas hors CHUES.
       * L'entrée servait la file CHUES sous une étiquette Grand Public.
       */

      // ─── Pilotage ─────────────────────────────────────────────────────────
      {
        href: '/grand-public/statistiques',
        label: 'Tableau de bord',
        icon: LayoutDashboardIcon,
        description: 'Activité et conversion',
        roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR'],
      },
      {
        href: '/grand-public',
        label: 'Prospects',
        icon: UsersIcon,
        description: 'Liste filtrable des prospects',
        roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR'],
      },
      {
        href: '/grand-public/supervision',
        label: 'Mon équipe',
        icon: ActivityIcon,
        description: 'Activité et présence des téléconseillers',
        roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR'],
      },
      {
        href: '/grand-public/dossiers',
        label: 'Dossiers bancaires',
        icon: FolderOpenIcon,
        description: 'Dossiers déposés en banque',
        roles: ['ADMIN'],
      },
      {
        href: '/grand-public/rappels',
        label: 'Rappels',
        icon: ClockIcon,
        description: 'Échéances promises et retards',
        roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR'],
        secondary: true,
      },
      {
        href: '/grand-public/mes-contacts',
        label: 'Mes contacts',
        icon: ContactRoundIcon,
        description: 'Les personnes que j’ai appelées',
        roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR'],
        secondary: true,
      },
      {
        href: '/grand-public/campagnes',
        label: 'Campagnes',
        icon: MegaphoneIcon,
        description: 'Fiches exportées pour le terrain',
        roles: ['ADMIN', 'DIRECTION', 'SUPERVISEUR'],
        secondary: true,
      },
      {
        href: '/grand-public/console',
        label: 'Appeler les prospects',
        icon: HeadsetIcon,
        description: 'Chercher un prospect et consigner l’appel',
        roles: ['ADMIN'],
        secondary: true,
      },
      {
        href: '/grand-public/nouveau',
        label: 'Noter un prospect',
        icon: PlusCircleIcon,
        description: 'Saisie d’un prospect',
        roles: ['ADMIN'],
        secondary: true,
      },
      {
        href: '/grand-public/banque',
        label: 'Vue d’ensemble bancaire',
        icon: ChartColumnIcon,
        description: 'Encaissements, rejets et délais',
        roles: ['ADMIN'],
        secondary: true,
      },
      {
        href: '/grand-public/dossiers/export',
        label: 'Exporter les dossiers',
        icon: FileSpreadsheetIcon,
        description: 'Classeur Dossiers · Historique · Synthèse',
        roles: ['ADMIN'],
        secondary: true,
      },
      {
        href: '/grand-public/dossiers/nouveau',
        label: 'Nouveau dossier',
        icon: PlusCircleIcon,
        description: 'Ouverture de dossier',
        roles: ['ADMIN'],
        hidden: true,
      },
      {
        // Le SEUL lien qui sort de la coque : l'écran de dépôt vit chez l'Admin,
        // et le paramètre y présélectionne le classeur Grand Public.
        href: '/admin/imports?kind=PROSPECTS_GRAND_PUBLIC',
        label: 'Importer des prospects',
        icon: UploadIcon,
        description: 'Classeur de prospects Grand Public',
        roles: ['ADMIN'],
        secondary: true,
      },

      // ─── Banque & Finance ─────────────────────────────────────────────────
      // Les mêmes écrans qu'en CHUES, bornés au projet Grand Public. Ni les
      // étapes du flux ni les demandes de création n'ont ici d'équivalent :
      // elles ignorent la notion de projet et restent en CHUES.
      {
        href: '/grand-public/banque',
        label: 'Vue d’ensemble',
        icon: LayoutDashboardIcon,
        description: 'Encaissements, rejets et délais',
        roles: ['BANQUE_FINANCE'],
      },
      {
        href: '/grand-public/dossiers',
        label: 'Dossiers bancaires',
        icon: FolderOpenIcon,
        description: 'Dossiers déposés en banque',
        roles: ['BANQUE_FINANCE'],
      },
      {
        href: '/grand-public/dossiers/nouveau',
        label: 'Ouvrir un dossier',
        icon: PlusCircleIcon,
        description: 'Ouverture de dossier',
        roles: ['BANQUE_FINANCE'],
      },
      {
        href: '/grand-public/dossiers/export',
        label: 'Exporter les dossiers',
        icon: FileSpreadsheetIcon,
        description: 'Classeur Dossiers · Historique · Synthèse',
        roles: ['BANQUE_FINANCE'],
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
        roles: ['ADMIN'],
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
export function navItems(role: Role, coque: Coque): NavItem[] {
  return navSections(role, coque).flatMap((section) => section.items);
}

/** Premier écran d'une coque pour ce rôle : le premier de la barre, replis exclus. */
export function coqueHomePath(role: Role, coque: Coque): string {
  const first = navItems(role, coque).find((item) => item.secondary !== true);
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
  return matchNavItem(role, pathname)?.href === item.href;
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
