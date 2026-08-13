import { describe, expect, it } from 'vitest';

import {
  homePathForRole,
  isNavItemActive,
  navItems,
  navSections,
  navTitle,
} from '@/components/layout/nav-items';

/**
 * Navigation dépendante du rôle.
 *
 * L'exigence n'est pas cosmétique : l'API répond 403 à un BANQUE_FINANCE sur
 * `/prospects`, `/representants`, `/users`, `/referentiels` et `/phase2/*`. Une
 * entrée de menu qui mène à un refus de droits est un défaut de conception. Ces
 * tests fixent la liste exacte de ce que chaque rôle voit.
 */

const hrefs = (role: Parameters<typeof navItems>[0]): string[] =>
  navItems(role).map((item) => item.href);

describe('navigation d’un agent BANQUE_FINANCE', () => {
  it('ne montre QUE ses quatre écrans', () => {
    expect(hrefs('BANQUE_FINANCE')).toEqual([
      '/banque',
      '/dossiers',
      '/dossiers/nouveau',
      '/dossiers/export',
    ]);
  });

  it('masque entièrement les écrans de prospection et d’administration', () => {
    const visible = hrefs('BANQUE_FINANCE');
    for (const forbidden of [
      '/tableau-de-bord',
      '/prospects',
      '/campagnes',
      '/representants',
      '/commerciaux',
      '/supervision',
      '/statistiques',
      '/referentiels',
      '/parametres',
      '/dossiers/etapes',
    ]) {
      expect(visible, `« ${forbidden} » ne doit pas être proposé`).not.toContain(forbidden);
    }
  });

  it('son « Tableau de bord » est le tableau de bord BANCAIRE', () => {
    const dashboard = navItems('BANQUE_FINANCE').find((item) => item.label === 'Tableau de bord');
    expect(dashboard?.href).toBe('/banque');
  });
});

describe('navigation d’un ADMIN', () => {
  it('voit tout, y compris la configuration du flux et les paramètres', () => {
    const visible = hrefs('ADMIN');
    for (const expected of [
      '/tableau-de-bord',
      '/statistiques',
      '/prospects',
      '/campagnes',
      '/dossiers',
      '/dossiers/nouveau',
      '/dossiers/export',
      '/dossiers/etapes',
      '/representants',
      '/commerciaux',
      '/supervision',
      '/referentiels',
      '/parametres',
    ]) {
      expect(visible).toContain(expected);
    }
  });

  it('ne voit PAS le tableau de bord bancaire en doublon de son propre tableau de bord', () => {
    // Deux entrées « Tableau de bord » dans la même barre seraient
    // indiscernables l'une de l'autre.
    expect(navItems('ADMIN').filter((item) => item.label === 'Tableau de bord')).toHaveLength(1);
    expect(hrefs('ADMIN')).not.toContain('/banque');
  });

  it('groupe la navigation en sections non vides', () => {
    const sections = navSections('ADMIN');
    expect(sections.length).toBeGreaterThan(1);
    for (const section of sections) expect(section.items.length).toBeGreaterThan(0);
  });

  it('ne laisse aucune section vide pour un BANQUE_FINANCE', () => {
    for (const section of navSections('BANQUE_FINANCE')) {
      expect(section.items.length).toBeGreaterThan(0);
    }
  });
});

describe('écran d’atterrissage après connexion', () => {
  it('mène chaque rôle là où l’API ne lui répondra pas 403', () => {
    expect(homePathForRole('ADMIN')).toBe('/tableau-de-bord');
    expect(homePathForRole('BANQUE_FINANCE')).toBe('/dossiers');
    // Le COMMERCIAL est refusé à la porte du panel : son outil est le mobile.
    expect(homePathForRole('COMMERCIAL')).toBe('/connexion');
  });
});

describe('titre et surbrillance par PRÉFIXE LE PLUS LONG', () => {
  it('distingue « Nouveau dossier » de « Dossiers »', () => {
    // `/dossiers/nouveau` commence par `/dossiers/` : une correspondance
    // naïve par ordre de déclaration afficherait « Dossiers » sur le
    // formulaire de création, et surlignerait la mauvaise entrée.
    expect(navTitle('BANQUE_FINANCE', '/dossiers/nouveau')).toBe('Nouveau dossier');
    expect(navTitle('BANQUE_FINANCE', '/dossiers/export')).toBe('Export');
    expect(navTitle('ADMIN', '/dossiers/etapes')).toBe('Étapes bancaires');
  });

  it('nomme les téléconseillers par leur métier, pas par leur lieu', () => {
    // L'application sert des téléconseillers sur place. « Commerciaux »
    // décrivait un métier de terrain qui n'existe pas ici.
    expect(navTitle('ADMIN', '/commerciaux')).toBe('Téléconseillers');
    expect(navTitle('ADMIN', '/supervision')).toBe('Supervision');
    expect(navTitle('ADMIN', '/statistiques')).toBe('Statistiques');
  });

  it('garde « Dossiers » sur le détail d’un dossier', () => {
    expect(navTitle('BANQUE_FINANCE', '/dossiers/019ff658-dddd-7489-ab22-1f2ada5ef38a')).toBe(
      'Dossiers',
    );
  });

  it('surligne une seule entrée à la fois', () => {
    const items = navItems('ADMIN');
    const active = items.filter((item) => isNavItemActive('ADMIN', '/dossiers/nouveau', item));
    expect(active).toHaveLength(1);
    expect(active[0]?.href).toBe('/dossiers/nouveau');
  });

  it('retombe sur « CPI GO » pour une route hors navigation', () => {
    expect(navTitle('ADMIN', '/une-route-inconnue')).toBe('CPI GO');
  });
});
