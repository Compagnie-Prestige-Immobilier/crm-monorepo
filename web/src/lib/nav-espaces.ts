import {
  BellIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  ListChecksIcon,
  ListIcon,
  PlugZapIcon,
  SettingsIcon,
  UploadIcon,
  UsersIcon,
} from 'lucide-react';

import type { NavItem } from '@/lib/nav';
import { ACCUEIL_ADMINISTRATION, ACCUEIL_LECTURE, ADMIN_SEUL, PILOTAGE } from '@/lib/roles';

export const NAV_ACCUEIL: readonly NavItem[] = [
  {
    href: '/accueil',
    label: 'Registre des visites',
    icon: ClipboardListIcon,
    description: 'Visites du jour et saisie',
    roles: ACCUEIL_LECTURE,
  },
  // Les trois écrans qui suivent sont les onglets du registre.
  {
    href: '/accueil/tableau-de-bord',
    label: 'Tableau de bord',
    icon: LayoutDashboardIcon,
    description: 'Affluence et motifs de visite',
    roles: ACCUEIL_LECTURE,
    hidden: true,
  },
  {
    href: '/accueil/listes',
    label: 'Listes',
    icon: ListIcon,
    description: 'Entreprises, directions, destinataires, objets',
    roles: ACCUEIL_ADMINISTRATION,
    hidden: true,
  },
  {
    href: '/accueil/import',
    label: 'Import du registre',
    icon: UploadIcon,
    description: 'Export, correction et réimport en masse',
    roles: ACCUEIL_ADMINISTRATION,
    hidden: true,
  },
];

export const NAV_ADMIN: readonly NavItem[] = [
  {
    href: '/admin/commerciaux',
    label: 'Utilisateurs',
    icon: UsersIcon,
    description: 'Comptes, rôles et accès',
    roles: ADMIN_SEUL,
  },
  {
    href: '/admin/referentiels',
    label: 'Listes de référence',
    icon: LibraryIcon,
    description: 'Départements, banques, syndicats',
    roles: PILOTAGE,
  },
  {
    href: '/admin/imports',
    label: 'Importer un fichier Excel',
    icon: UploadIcon,
    description: 'Dépôt de classeurs et suivi des travaux',
    roles: ADMIN_SEUL,
  },
  {
    href: '/admin/notifications',
    label: 'Envoyer une notification',
    icon: BellIcon,
    description: 'Annonces et rappels envoyés',
    roles: ADMIN_SEUL,
  },
  {
    href: '/admin/enrolement',
    label: 'Plateformes d’enrôlement',
    icon: PlugZapIcon,
    description: 'Inscriptions CHUES et Grand Public',
    roles: ADMIN_SEUL,
  },
  {
    href: '/admin/parametres',
    label: 'Paramètres',
    icon: SettingsIcon,
    description: 'Démonstration et suppression',
    roles: ADMIN_SEUL,
  },
  {
    href: '/admin/champs-conversion',
    label: 'Champs de la conversion',
    icon: ListChecksIcon,
    description: 'Ordre, visibilité et champs ajoutés',
    roles: ADMIN_SEUL,
    secondary: true,
  },
];
