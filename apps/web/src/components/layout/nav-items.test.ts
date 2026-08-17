import { describe, expect, it } from 'vitest';

import {
  homePathForRole,
  isNavItemActive,
  navItems,
  navSections,
  navTitle,
} from '@/components/layout/nav-items';

const hrefs = (role: Parameters<typeof navItems>[0]): string[] =>
  navItems(role).map((item) => item.href);

describe('navigation d’un agent BANQUE_FINANCE', () => {
  it('ne montre QUE ses écrans', () => {
    expect(hrefs('BANQUE_FINANCE')).toEqual([
      '/banque',
      '/dossiers',
      '/dossiers/nouveau',
      '/dossiers/export',
      '/demandes-clients',
    ]);
  });

  it('masque entièrement les écrans de prospection et d’administration', () => {
    const visible = hrefs('BANQUE_FINANCE');
    for (const forbidden of [
      '/tableau-de-bord',
      '/prospects',
      '/campagnes',
      '/notifications',
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
      '/demandes-clients',
      '/notifications',
      '/representants',
      '/commerciaux',
      '/supervision',
      '/referentiels',
      '/parametres',
    ]) {
      expect(visible).toContain(expected);
    }
  });

  it('propose les deux écrans qui n’étaient joignables qu’en tapant leur URL', () => {
    const visible = hrefs('ADMIN');
    expect(visible).toContain('/notifications');
    expect(visible).toContain('/demandes-clients');
  });

  it('ne propose PAS le composeur de notifications à un agent bancaire', () => {
    expect(hrefs('BANQUE_FINANCE')).not.toContain('/notifications');
  });

  it('propose à l’agent bancaire le SUIVI de ses demandes, sous son propre libellé', () => {
    const entry = navItems('BANQUE_FINANCE').find((item) => item.href === '/demandes-clients');
    expect(entry?.label).toBe('Mes demandes');
    expect(navItems('ADMIN').find((item) => item.href === '/demandes-clients')?.label).toBe(
      'Demandes clients',
    );
  });

  it('ne voit PAS le tableau de bord bancaire en doublon de son propre tableau de bord', () => {
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
    expect(homePathForRole('COMMERCIAL')).toBe('/connexion');
  });
});

describe('titre et surbrillance par PRÉFIXE LE PLUS LONG', () => {
  it('distingue « Nouveau dossier » de « Dossiers »', () => {
    expect(navTitle('BANQUE_FINANCE', '/dossiers/nouveau')).toBe('Nouveau dossier');
    expect(navTitle('BANQUE_FINANCE', '/dossiers/export')).toBe('Export');
    expect(navTitle('ADMIN', '/dossiers/etapes')).toBe('Étapes bancaires');
  });

  it('nomme l’écran des comptes par ce qu’il contient VRAIMENT', () => {
    expect(navTitle('ADMIN', '/commerciaux')).toBe('Utilisateurs');
    expect(navTitle('ADMIN', '/commerciaux')).not.toContain('Commerciaux');
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
