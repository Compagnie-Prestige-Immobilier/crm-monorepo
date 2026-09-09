import {
  ActivityIcon,
  ClockIcon,
  ContactRoundIcon,
  HeadsetIcon,
  HouseIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  MegaphoneIcon,
  PhoneCallIcon,
  PhoneForwardedIcon,
  PlusCircleIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  UsersRoundIcon,
} from 'lucide-react';

import type { NavItem } from '@/lib/nav';
import { NAV_CHUES_ADMIN } from '@/lib/nav-chues-admin';
import { ENCADREMENT, PILOTAGE, TELECONSEIL, TERRAIN } from '@/lib/roles';

const TERRAIN_ET_ENCADREMENT: readonly NavItem[] = [
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
    roles: TELECONSEIL,
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
    href: '/chues/supervision',
    label: 'Tableau de bord',
    icon: ActivityIcon,
    description: 'Activité et présence des téléconseillers',
    roles: ENCADREMENT,
    hidden: true,
    onglet: '/chues/statistiques',
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
    label: 'Tableau de bord',
    icon: MegaphoneIcon,
    description: 'Fiches exportées pour le terrain',
    roles: ENCADREMENT,
    hidden: true,
    onglet: '/chues/statistiques',
  },
  {
    href: '/chues/parametres-chues',
    label: 'Paramètres CHUES',
    icon: SlidersHorizontalIcon,
    description: 'Liens, contacts et messages envoyés',
    roles: PILOTAGE,
    secondary: true,
  },
  {
    // Le seul lien qui sort de la coque : la supervision et la direction
    // n'ouvrent pas la coque Admin pour cette seule entrée.
    href: '/admin/referentiels',
    label: 'Listes de référence',
    icon: LibraryIcon,
    description: 'Départements, banques, syndicats',
    roles: ENCADREMENT,
    secondary: true,
  },
];

export const NAV_CHUES: readonly NavItem[] = [...TERRAIN_ET_ENCADREMENT, ...NAV_CHUES_ADMIN];
