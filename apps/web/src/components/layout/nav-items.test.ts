import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ETAPES } from '@/components/chues/etapes';
import {
  COQUES,
  coqueAllowed,
  coqueHomePath,
  coqueOf,
  coquesForRole,
  fallbackCoque,
  homePathForRole,
  INBOX_PATH,
  INBOX_ROLES,
  inboxPathFor,
  isNavItemActive,
  navItems,
  navSections,
  navTitle,
  type Coque,
} from '@/components/layout/nav-items';
import { PANEL_ROLES } from '@/lib/data/auth';
import type { Role } from '@/lib/types';

const hrefs = (role: Role, coque: Coque): string[] =>
  navItems(role, coque).map((item) => item.href);

/** Une barre latérale par rôle et par espace autorisé : le plan complet, à plat. */
const BARRES = PANEL_ROLES.flatMap((role) =>
  coquesForRole(role)
    .filter(({ allowed }) => allowed)
    .map(({ entry }) => {
      const items = navItems(role, entry.id);
      return {
        role,
        coque: entry.id,
        items,
        primaires: items.filter((item) => item.secondary !== true),
      };
    }),
);

const ENTREES = BARRES.flatMap(({ role, items }) => items.map((item) => ({ role, item })));

const PANEL = fileURLToPath(new URL('../../app/(panel)', import.meta.url));

function pagesOf(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) pagesOf(full, acc);
    else if (entry === 'page.tsx') acc.push(full);
  }
  return acc;
}

const routeOf = (page: string): string =>
  `/${path
    .relative(PANEL, path.dirname(page))
    .split(path.sep)
    .filter((segment) => segment !== '' && !segment.startsWith('('))
    .join('/')}`;

/** Rôles admis par le `guardRoles` de l'écran ou d'un gabarit au-dessus. */
function guardOf(page: string): Role[] {
  const fichiers = [page];
  for (let dir = path.dirname(page); ; dir = path.dirname(dir)) {
    fichiers.push(path.join(dir, 'layout.tsx'));
    if (dir === PANEL) break;
  }

  let admis: Role[] = [...PANEL_ROLES];
  for (const fichier of fichiers.filter((candidat) => existsSync(candidat))) {
    const appel = /guardRoles\(\s*(\[[\s\S]*?\]|INBOX_ROLES)/u.exec(readFileSync(fichier, 'utf8'));
    if (appel?.[1] === undefined) continue;
    const cites =
      appel[1] === 'INBOX_ROLES'
        ? [...INBOX_ROLES]
        : [...appel[1].matchAll(/'([A-Z_]+)'/gu)].map(([, role]) => role as Role);
    admis = admis.filter((role) => cites.includes(role));
  }
  return admis;
}

/** Un écran par route servie, les segments dynamiques exclus : ils s'ouvrent depuis leur liste. */
const ROUTES = pagesOf(PANEL)
  .filter((page) => !page.includes('['))
  .map((page) => ({ route: routeOf(page), roles: guardOf(page) }));

/**
 * Écrans hors barre latérale, avec le geste qui y mène. Masquer n'est pas
 * supprimer : une entrée retirée de la barre sans ligne ici fait rougir le
 * balayage des orphelines.
 */
const ATTEINT_AUTREMENT: Readonly<Record<string, string>> = {
  '/accueil/tableau-de-bord': 'onglet · accueil/visites-tabs.tsx',
  '/accueil/listes': 'onglet · accueil/visites-tabs.tsx',
  '/accueil/import': 'onglet · accueil/visites-tabs.tsx',
  '/admin': 'redirige vers le premier écran du rôle',
  '/admin/referentiels/issues-appel': 'lien · referentiels/referentiels-view.tsx',
  '/chues': 'redirige l’agent bancaire vers son tableau de bord',
  '/chues/appels-representants': 'premier geste · chues/hub-view.tsx',
  '/chues/prospects/nouveau': 'deuxième geste · chues/hub-view.tsx',
  '/chues/console': 'troisième geste · chues/hub-view.tsx',
  '/chues/tableau-de-bord': 'redirige vers « Chiffres », qui l’a absorbé',
  '/grand-public/tableau-de-bord': 'redirige vers « Chiffres », qui l’a absorbé',
  '/chues/dossiers/nouveau': 'bouton · bank/bank-cases-view.tsx',
  '/chues/representants/import': 'bouton · representants/representants-view.tsx',
  '/compte': 'menu du compte · layout/user-menu.tsx',
  '/notifications': 'cloche · notifications/notification-bell.tsx',
};

/** Ce que chaque rôle a le droit d'ouvrir SANS le trouver dans sa barre. */
const MASQUEES: Readonly<Record<Role, readonly string[]>> = {
  ADMIN: [
    '/accueil/import',
    '/accueil/listes',
    '/accueil/tableau-de-bord',
    '/admin',
    '/admin/referentiels/issues-appel',
    '/chues/appels-representants',
    '/chues/console',
    '/chues/dossiers/nouveau',
    '/chues/prospects/nouveau',
    '/chues/representants/import',
    '/chues/tableau-de-bord',
    '/compte',
    '/grand-public/tableau-de-bord',
    '/notifications',
  ],
  DIRECTION: [
    '/accueil/import',
    '/accueil/listes',
    '/accueil/tableau-de-bord',
    '/chues',
    '/chues/tableau-de-bord',
    '/compte',
    '/grand-public/tableau-de-bord',
    '/notifications',
  ],
  SUPERVISEUR: [
    '/chues',
    '/chues/tableau-de-bord',
    '/compte',
    '/grand-public/tableau-de-bord',
    '/notifications',
  ],
  // Les deux redirections ne portent aucun garde : elles renvoient vers
  // « Chiffres », qui refuse lui-même qui n'y a pas droit.
  COMMERCIAL: ['/chues/tableau-de-bord', '/compte', '/grand-public/tableau-de-bord'],
  BANQUE_FINANCE: ['/chues', '/chues/tableau-de-bord', '/compte', '/notifications'],
  ACCUEIL: ['/accueil/tableau-de-bord', '/compte', '/notifications'],
};

const horsBarre = (role: Role): string[] =>
  ROUTES.filter(({ route, roles }) => {
    if (!roles.includes(role)) return false;
    const coque = coqueOf(route);
    if (coque === null) return true;
    return coqueAllowed(role, coque) && !hrefs(role, coque).includes(route);
  })
    .map(({ route }) => route)
    .sort();

describe('navigation d’un agent BANQUE_FINANCE', () => {
  it('ne montre QUE ses écrans, dans la coque CHUES', () => {
    expect(hrefs('BANQUE_FINANCE', 'chues')).toEqual([
      '/chues/banque',
      '/chues/dossiers',
      '/chues/dossiers/nouveau',
      '/chues/demandes-clients',
      // Sous « Plus » : on exporte une fois par mois, pas une fois par heure.
      '/chues/dossiers/export',
    ]);
  });

  it('ne replie que l’export : les quatre gestes du jour restent en pleine barre', () => {
    const replies = navItems('BANQUE_FINANCE', 'chues')
      .filter((item) => item.secondary === true)
      .map((item) => item.href);
    expect(replies).toEqual(['/chues/dossiers/export']);
  });

  it('masque entièrement les écrans de prospection et d’administration', () => {
    const visible = hrefs('BANQUE_FINANCE', 'chues');
    for (const forbidden of [
      '/accueil',
      '/chues/tableau-de-bord',
      '/chues/prospects',
      '/chues/campagnes',
      '/admin/notifications',
      '/chues/representants',
      '/chues/suggestions',
      '/admin/commerciaux',
      '/chues/supervision',
      '/chues/statistiques',
      '/admin/referentiels',
      '/admin/parametres',
      '/chues/dossiers/etapes',
    ]) {
      expect(visible, `« ${forbidden} » ne doit pas être proposé`).not.toContain(forbidden);
    }
  });

  it('n’ouvre ni l’accueil, ni le grand public, ni l’administration', () => {
    for (const coque of ['accueil', 'grand-public', 'admin'] as const) {
      expect(navItems('BANQUE_FINANCE', coque), coque).toEqual([]);
      expect(coqueAllowed('BANQUE_FINANCE', coque), coque).toBe(false);
    }
  });

  it('son écran d’ouverture est le tableau de bord BANCAIRE, nommé sans jargon', () => {
    const dashboard = navItems('BANQUE_FINANCE', 'chues').find(
      (item) => item.label === 'Vue d’ensemble',
    );
    expect(dashboard?.href).toBe('/chues/banque');
    expect(navItems('BANQUE_FINANCE', 'chues').map((item) => item.label)).not.toContain(
      'Tableau de bord',
    );
  });
});

describe('navigation d’un ADMIN', () => {
  it('voit tout, y compris la configuration du flux et les paramètres', () => {
    const visible = [
      ...hrefs('ADMIN', 'accueil'),
      ...hrefs('ADMIN', 'chues'),
      ...hrefs('ADMIN', 'grand-public'),
      ...hrefs('ADMIN', 'admin'),
    ];
    for (const expected of [
      '/accueil',
      '/chues',
      '/chues/statistiques',
      '/chues/prospects',
      '/chues/campagnes',
      '/chues/dossiers',
      '/chues/dossiers/etapes',
      '/chues/dossiers/export',
      '/chues/demandes-clients',
      '/chues/banque',
      '/admin/notifications',
      '/chues/representants',
      '/chues/suggestions',
      '/admin/commerciaux',
      '/chues/supervision',
      '/admin/referentiels',
      '/admin/imports',
      '/admin/parametres',
    ]) {
      expect(visible).toContain(expected);
    }
  });

  it('range hors de la barre les écrans qu’un bouton ou un onglet ouvre déjà', () => {
    const visible = [...hrefs('ADMIN', 'accueil'), ...hrefs('ADMIN', 'chues')];
    for (const parBouton of [
      '/accueil/tableau-de-bord',
      '/accueil/listes',
      '/accueil/import',
      '/chues/appels-representants',
      '/chues/prospects/nouveau',
      '/chues/console',
      '/chues/dossiers/nouveau',
      '/chues/representants/import',
    ]) {
      expect(visible, `« ${parBouton} » s’atteint autrement`).not.toContain(parBouton);
    }

    // Hors barre ne veut pas dire sans nom : le titre et la surbrillance tiennent.
    expect(navTitle('ADMIN', '/chues/representants/import')).toBe('Importer des représentants');
    expect(navTitle('ADMIN', '/accueil/listes')).toBe('Listes');
  });

  it('propose les deux écrans qui n’étaient joignables qu’en tapant leur URL', () => {
    expect(hrefs('ADMIN', 'admin')).toContain('/admin/notifications');
    expect(hrefs('ADMIN', 'chues')).toContain('/chues/demandes-clients');
  });

  it('ne propose PAS le composeur de notifications à un agent bancaire', () => {
    expect(hrefs('BANQUE_FINANCE', 'chues')).not.toContain('/admin/notifications');
    expect(hrefs('BANQUE_FINANCE', 'admin')).toEqual([]);
  });

  it('propose à l’agent bancaire le SUIVI de ses demandes, sous son propre libellé', () => {
    const entry = navItems('BANQUE_FINANCE', 'chues').find(
      (item) => item.href === '/chues/demandes-clients',
    );
    expect(entry?.label).toBe('Mes demandes de création');
    expect(
      navItems('ADMIN', 'chues').find((item) => item.href === '/chues/demandes-clients')?.label,
    ).toBe('Créations de client à valider');
  });

  it('atteint le tableau de bord bancaire par la barre, sous un nom qui le distingue', () => {
    const banque = navItems('ADMIN', 'chues').find((item) => item.href === '/chues/banque');
    expect(banque?.label).toBe('Vue d’ensemble bancaire');
    expect(banque?.secondary).toBe(true);
    // Le même écran s'appelle « Vue d'ensemble » chez l'agent bancaire, pour
    // qui il n'y a rien d'autre à survoler.
    expect(
      navItems('BANQUE_FINANCE', 'chues').find((item) => item.href === '/chues/banque')?.label,
    ).toBe('Vue d’ensemble');
  });

  // Les chiffres du projet tiennent en UN écran, « Tableau de bord » : plus de
  // « Chiffres » à côté, et plus d'entrée qui pointe vers la redirection.
  it('n’offre qu’un seul écran de chiffres du projet', () => {
    const labels = navItems('ADMIN', 'chues').map((item) => item.label);
    expect(labels.filter((label, rang) => labels.indexOf(label) !== rang)).toEqual([]);
    expect(navTitle('ADMIN', '/chues/statistiques')).toBe('Tableau de bord');
    expect(hrefs('ADMIN', 'chues')).not.toContain('/chues/tableau-de-bord');
    expect(hrefs('ADMIN', 'grand-public')).not.toContain('/grand-public/tableau-de-bord');
  });

  it('range la navigation de CHUES en UNE liste, sans intitulé à lire', () => {
    const sections = navSections('ADMIN', 'chues');
    expect(sections.map((section) => section.title)).toEqual([null]);
    for (const section of sections) expect(section.items.length).toBeGreaterThan(0);
  });

  it('ouvre sur le tableau de bord, garde cinq entrées en pleine barre et replie le reste', () => {
    const items = navItems('ADMIN', 'chues');
    expect(items.filter((item) => item.secondary !== true).map((item) => item.href)).toEqual([
      '/chues/statistiques',
      '/chues/prospects',
      '/chues/representants',
      '/chues/campagnes',
      '/chues/dossiers',
    ]);
    expect(items.filter((item) => item.secondary === true).map((item) => item.href)).toEqual([
      '/chues',
      '/chues/supervision',
      '/chues/rappels',
      '/chues/suggestions',
      '/chues/banque',
      '/chues/demandes-clients',
      '/chues/dossiers/export',
      '/chues/dossiers/etapes',
    ]);
  });

  it('ne laisse aucune section vide pour un BANQUE_FINANCE', () => {
    for (const section of navSections('BANQUE_FINANCE', 'chues')) {
      expect(section.items.length).toBeGreaterThan(0);
    }
  });

  it('range l’administration dans SA coque, jamais dans celle d’un projet', () => {
    expect(hrefs('ADMIN', 'admin')).toEqual([
      '/admin/commerciaux',
      '/admin/referentiels',
      '/admin/imports',
      '/admin/notifications',
      '/admin/parametres',
    ]);
  });

  it('nomme chaque écran d’administration par le geste, pas par le jargon', () => {
    expect(navItems('ADMIN', 'admin').map((item) => item.label)).toEqual([
      'Utilisateurs',
      'Listes de référence',
      'Importer un fichier Excel',
      'Envoyer une notification',
      'Paramètres',
    ]);
  });
});

describe('navigation d’un téléconseiller', () => {
  it('ouvre sur son travail et numérote les trois étapes, dans l’ordre', () => {
    expect(navSections('COMMERCIAL', 'chues').map((section) => section.title)).toEqual([null]);
    expect(hrefs('COMMERCIAL', 'chues')).toEqual([
      '/chues',
      '/chues/appels-representants',
      '/chues/prospects/nouveau',
      '/chues/console',
      '/chues/rappels',
      // Sous « Plus » : utile, pas quotidien.
      '/chues/suggestions',
      '/chues/representants',
      '/chues/prospects',
    ]);
    expect(navItems('COMMERCIAL', 'chues').map((item) => item.label)).toEqual([
      'Mon travail',
      'Qualifier un représentant',
      'Ajouter un prospect',
      'Convertir un prospect',
      'Rappels promis',
      'Contacts recommandés',
      'Représentants',
      'Prospects',
    ]);
  });

  it('ouvre le Grand Public sur l’appel, la liste restant sous « Plus »', () => {
    expect(hrefs('COMMERCIAL', 'grand-public')).toEqual([
      '/grand-public/console',
      '/grand-public/rappels',
      '/grand-public/nouveau',
      '/grand-public',
    ]);
    expect(coqueHomePath('COMMERCIAL', 'grand-public')).toBe('/grand-public/console');
  });

  it('lui ouvre les prospects, que l’API borne déjà à ses fiches', () => {
    const entry = navItems('COMMERCIAL', 'chues').find((item) => item.href === '/chues/prospects');
    expect(entry?.label).toBe('Prospects');
    expect(entry?.secondary).toBe(true);
  });

  it('masque entièrement le pilotage et l’administration', () => {
    const visible = [...hrefs('COMMERCIAL', 'chues'), ...hrefs('COMMERCIAL', 'admin')];
    for (const forbidden of [
      '/accueil',
      '/chues/tableau-de-bord',
      '/chues/banque',
      '/chues/statistiques',
      '/chues/campagnes',
      '/chues/dossiers',
      '/chues/dossiers/nouveau',
      '/chues/dossiers/export',
      '/chues/dossiers/etapes',
      '/chues/demandes-clients',
      '/admin/notifications',
      '/admin/commerciaux',
      '/chues/supervision',
      '/admin/referentiels',
      '/admin/imports',
      '/admin/parametres',
    ]) {
      expect(visible, `« ${forbidden} » ne doit pas être proposé`).not.toContain(forbidden);
    }
  });

  it('laisse les trois appels à l’écran d’ouverture, sans les répéter dans la barre', () => {
    const barre = hrefs('ADMIN', 'chues');
    expect(ETAPES.filter(({ href }) => barre.includes(href))).toEqual([]);
    // Hors barre, l'écran garde son titre et sa surbrillance.
    expect(ETAPES.filter(({ href }) => navTitle('ADMIN', href) === 'CPI GO')).toEqual([]);
    expect(navTitle('ADMIN', '/chues/prospects/nouveau')).toBe('Ajouter un prospect');
    expect(hrefs('ADMIN', 'chues').filter((href) => href === '/chues/representants')).toHaveLength(
      1,
    );
  });

  it('n’ouvre le terrain à aucun agent bancaire', () => {
    const visible = hrefs('BANQUE_FINANCE', 'chues');
    for (const forbidden of [
      '/chues',
      '/chues/console',
      '/chues/appels-representants',
      '/chues/prospects/nouveau',
      '/chues/representants',
      '/chues/suggestions',
    ]) {
      expect(visible).not.toContain(forbidden);
    }
  });

  it('nomme les contacts suggérés par ce qu’ils sont, et les replie sous « Plus »', () => {
    const entry = navItems('COMMERCIAL', 'chues').find(
      (item) => item.href === '/chues/suggestions',
    );
    expect(entry?.label).toBe('Contacts recommandés');
    expect(entry?.secondary).toBe(true);
    expect(navTitle('COMMERCIAL', '/chues/suggestions')).toBe('Contacts recommandés');
  });

  // Le rang se lit dans l'ordre de la barre ; le chiffre collé à l'intitulé
  // n'apprenait rien qu'un superviseur ne voie déjà.
  it('range les trois étapes dans l’ordre du travail, sans les numéroter', () => {
    const described = new Map(
      navItems('COMMERCIAL', 'chues').map((item) => [item.href, item.description]),
    );

    expect(described.get('/chues/appels-representants')).toBe('Première étape');
    expect(described.get('/chues/prospects/nouveau')).toBe('Deuxième étape');
    expect(described.get('/chues/console')).toBe('Dernière étape');

    for (const item of navItems('COMMERCIAL', 'chues')) {
      expect(item.label).not.toMatch(/^\d/u);
    }
  });

  it('nomme ses écrans d’appel par le geste, sans employer le mot proscrit', () => {
    const labels = navItems('COMMERCIAL', 'chues').map(
      (item) => `${item.label} ${item.description}`,
    );
    for (const text of labels) expect(text.toLowerCase()).not.toContain('commercial');
    for (const text of labels) expect(text.toLowerCase()).not.toContain('console');
    expect(navTitle('COMMERCIAL', '/chues/console')).toBe('Convertir un prospect');
    expect(navTitle('COMMERCIAL', '/chues/appels-representants')).toBe('Qualifier un représentant');
  });
});

describe('registre des visites', () => {
  it('n’est proposé qu’à ceux qui le tiennent', () => {
    for (const role of ['ADMIN', 'DIRECTION', 'ACCUEIL'] as const) {
      expect(hrefs(role, 'accueil'), role).toContain('/accueil');
    }
    for (const role of ['BANQUE_FINANCE', 'COMMERCIAL', 'SUPERVISEUR'] as const) {
      expect(hrefs(role, 'accueil'), role).not.toContain('/accueil');
    }
  });

  it('le nomme par le classeur qu’il remplace, pas par sa route', () => {
    expect(navTitle('ADMIN', '/accueil')).toBe('Registre des visites');
  });

  it('ouvre la coque Accueil sur l’écran où la Directrice passe sa journée', () => {
    expect(hrefs('ADMIN', 'accueil')[0]).toBe('/accueil');
    expect(coqueHomePath('DIRECTION', 'accueil')).toBe('/accueil');
  });

  it('garde son tableau de bord sous sa propre coque, sans le confondre avec celui de CHUES', () => {
    // L'écran est un ONGLET du registre : nommé partout, doublé nulle part.
    expect(navTitle('DIRECTION', '/accueil/tableau-de-bord')).toBe('Tableau de bord');
    expect(hrefs('DIRECTION', 'accueil')).not.toContain('/accueil/tableau-de-bord');
    expect(hrefs('DIRECTION', 'chues')).not.toContain('/chues/tableau-de-bord');
  });

  it('ouvre les listes à l’ADMIN et à la DIRECTION par l’onglet, jamais à l’ACCUEIL', () => {
    for (const role of ['ADMIN', 'DIRECTION'] as const) {
      expect(navTitle(role, '/accueil/listes'), role).toBe('Listes');
    }
    expect(navTitle('ACCUEIL', '/accueil/listes')).toBe('Registre des visites');
    expect(hrefs('ACCUEIL', 'accueil')).toEqual(['/accueil']);
  });

  it('ouvre l’import du registre à l’ADMIN et à la DIRECTION, jamais à l’ACCUEIL', () => {
    for (const role of ['ADMIN', 'DIRECTION'] as const) {
      expect(navTitle(role, '/accueil/import'), role).toBe('Import du registre');
    }
    expect(navTitle('ACCUEIL', '/accueil/import')).toBe('Registre des visites');
    expect(hrefs('ACCUEIL', 'accueil')).not.toContain('/accueil/import');
  });
});

describe('les quatre coques', () => {
  it('sont montrées EN ENTIER à tout le monde, ouvertes ou non', () => {
    for (const role of PANEL_ROLES) {
      expect(
        coquesForRole(role).map(({ entry }) => entry.id),
        role,
      ).toEqual(['accueil', 'chues', 'grand-public', 'admin']);
    }
  });

  it('n’ouvrent à chaque rôle que ce que le propriétaire du produit a décidé', () => {
    const ouvertes = (role: Role): Coque[] =>
      coquesForRole(role)
        .filter(({ allowed }) => allowed)
        .map(({ entry }) => entry.id);

    expect(ouvertes('ACCUEIL')).toEqual(['accueil']);
    expect(ouvertes('DIRECTION')).toEqual(['accueil', 'chues', 'grand-public']);
    expect(ouvertes('SUPERVISEUR')).toEqual(['chues', 'grand-public']);
    expect(ouvertes('COMMERCIAL')).toEqual(['chues', 'grand-public']);
    expect(ouvertes('BANQUE_FINANCE')).toEqual(['chues']);
    expect(ouvertes('ADMIN')).toEqual(['accueil', 'chues', 'grand-public', 'admin']);
  });

  it('grisent sans masquer : un compte d’accueil VOIT les trois autres', () => {
    const grisees = coquesForRole('ACCUEIL')
      .filter(({ allowed }) => !allowed)
      .map(({ entry }) => entry.label);
    expect(grisees).toEqual(['Projet CHUES', 'Projet Grand Public', 'Admin']);
  });

  it('ouvrent chacune sur un écran que la navigation du rôle propose vraiment', () => {
    for (const role of PANEL_ROLES) {
      for (const { entry } of coquesForRole(role).filter(({ allowed }) => allowed)) {
        expect(hrefs(role, entry.id), `${role} · ${entry.id}`).toContain(
          coqueHomePath(role, entry.id),
        );
      }
    }
  });

  it('rangent la section bancaire dans CHUES, là où vivent les dossiers', () => {
    expect(coqueOf('/chues/dossiers')).toBe('chues');
    expect(coqueAllowed('BANQUE_FINANCE', 'chues')).toBe(true);
  });
});

describe('coque d’une route, qui commande la palette', () => {
  it('reconnaît chaque racine et ce qu’elle contient', () => {
    expect(coqueOf('/accueil')).toBe('accueil');
    expect(coqueOf('/accueil/tableau-de-bord')).toBe('accueil');
    expect(coqueOf('/chues')).toBe('chues');
    expect(coqueOf('/chues/prospects/nouveau')).toBe('chues');
    expect(coqueOf('/grand-public')).toBe('grand-public');
    expect(coqueOf('/admin/parametres')).toBe('admin');
  });

  it('ne laisse AUCUNE coque hors de ces racines : le hub garde la palette CPI', () => {
    expect(coqueOf('/espaces')).toBeNull();
    expect(coqueOf('/connexion')).toBeNull();
    expect(coqueOf('/')).toBeNull();
  });

  it('compare sur le segment, pas sur les lettres', () => {
    expect(coqueOf('/administration')).toBeNull();
    expect(coqueOf('/accueil-des-visites')).toBeNull();
    expect(coqueOf('/chuesx')).toBeNull();
  });

  it('ne mélange jamais CHUES et Grand Public : aucune route commune', () => {
    const chues = COQUES.find((entry) => entry.id === 'chues');
    const grandPublic = COQUES.find((entry) => entry.id === 'grand-public');
    expect(coqueOf(`${String(grandPublic?.path)}/prospects`)).toBe('grand-public');
    expect(coqueOf(`${String(chues?.path)}/prospects`)).toBe('chues');
    for (const role of PANEL_ROLES) {
      const communs = hrefs(role, 'chues').filter((href) =>
        hrefs(role, 'grand-public').includes(href),
      );
      expect(communs, role).toEqual([]);
    }
  });
});

describe('écran d’atterrissage après connexion', () => {
  it('passe TOUT LE MONDE par le hub, y compris un compte qui n’a qu’une tuile', () => {
    for (const role of PANEL_ROLES) {
      expect(homePathForRole(role), role).toBe('/espaces');
    }
  });

  // Sur PANEL_ROLES et non sur une liste retapée : un rôle admis dans le
  // panel sans aucune coque part en boucle vers « /connexion ».
  it('ne renvoie personne vers « /connexion », qui l’y renverrait en boucle', () => {
    for (const role of PANEL_ROLES) {
      expect(homePathForRole(role), role).not.toBe('/connexion');
    }
  });

  it('mène chaque rôle là où l’API ne lui répondra pas 403', () => {
    // L'encadrement et l'admin atterrissent sur les chiffres ; le
    // téléconseiller sur ses trois étapes.
    expect(coqueHomePath('ADMIN', 'chues')).toBe('/chues/statistiques');
    expect(coqueHomePath('BANQUE_FINANCE', 'chues')).toBe('/chues/banque');
    expect(coqueHomePath('COMMERCIAL', 'chues')).toBe('/chues');
    expect(coqueHomePath('SUPERVISEUR', 'chues')).toBe('/chues/statistiques');
    expect(coqueHomePath('DIRECTION', 'chues')).toBe('/chues/statistiques');
    expect(coqueHomePath('DIRECTION', 'accueil')).toBe('/accueil');
    expect(coqueHomePath('ACCUEIL', 'accueil')).toBe('/accueil');
  });

  it('n’atterrit JAMAIS sur un écran replié sous « Plus »', () => {
    for (const role of PANEL_ROLES) {
      for (const { entry } of coquesForRole(role).filter(({ allowed }) => allowed)) {
        const home = coqueHomePath(role, entry.id);
        const item = navItems(role, entry.id).find((candidate) => candidate.href === home);
        expect(item?.secondary, `${role} · ${entry.id}`).not.toBe(true);
      }
    }
  });

  it('renvoie au hub une coque qu’un rôle ne peut pas ouvrir, au lieu d’un écran interdit', () => {
    expect(coqueHomePath('ACCUEIL', 'admin')).toBe('/espaces');
    expect(coqueHomePath('BANQUE_FINANCE', 'grand-public')).toBe('/espaces');
  });
});

describe('titre et surbrillance par PRÉFIXE LE PLUS LONG', () => {
  it('distingue « Ouvrir un dossier » de « Dossiers bancaires »', () => {
    expect(navTitle('BANQUE_FINANCE', '/chues/dossiers/nouveau')).toBe('Ouvrir un dossier');
    expect(navTitle('BANQUE_FINANCE', '/chues/dossiers/export')).toBe('Exporter les dossiers');
    expect(navTitle('ADMIN', '/chues/dossiers/etapes')).toBe('Étapes des dossiers');
  });

  it('nomme l’écran des comptes par ce qu’il contient VRAIMENT', () => {
    expect(navTitle('ADMIN', '/admin/commerciaux')).toBe('Utilisateurs');
    expect(navTitle('ADMIN', '/admin/commerciaux')).not.toContain('Commerciaux');
    expect(navTitle('ADMIN', '/chues/supervision')).toBe('Équipes');
    expect(navTitle('ADMIN', '/chues/statistiques')).toBe('Tableau de bord');
  });

  it('garde « Dossiers bancaires » sur le détail d’un dossier', () => {
    expect(navTitle('BANQUE_FINANCE', '/chues/dossiers/019ff658-dddd-7489-ab22-1f2ada5ef38a')).toBe(
      'Dossiers bancaires',
    );
  });

  it('surligne une seule entrée à la fois', () => {
    const items = navItems('ADMIN', 'chues');
    const active = items.filter((item) => isNavItemActive('ADMIN', '/chues/dossiers/etapes', item));
    expect(active).toHaveLength(1);
    expect(active[0]?.href).toBe('/chues/dossiers/etapes');
  });

  it('ne laisse pas la racine de la coque voler la surbrillance d’un écran plus précis', () => {
    const items = navItems('COMMERCIAL', 'chues');
    const active = items.filter((item) => isNavItemActive('COMMERCIAL', '/chues/console', item));
    expect(active.map((item) => item.href)).toEqual(['/chues/console']);
    expect(navTitle('COMMERCIAL', '/chues')).toBe('Mon travail');
  });

  it('ne surligne rien dans une AUTRE coque que celle de la route', () => {
    for (const item of navItems('ADMIN', 'admin')) {
      expect(isNavItemActive('ADMIN', '/chues/prospects', item), item.href).toBe(false);
    }
  });

  it('retombe sur « CPI GO » pour une route hors navigation', () => {
    expect(navTitle('ADMIN', '/une-route-inconnue')).toBe('CPI GO');
    expect(navTitle('ADMIN', '/espaces')).toBe('CPI GO');
  });
});

describe('navigation d’un SUPERVISEUR', () => {
  it('ouvre sur le tableau de bord, puis ses propres appels, puis le suivi de son équipe', () => {
    expect(hrefs('SUPERVISEUR', 'chues')).toEqual([
      '/chues/statistiques',
      '/chues/appels-representants',
      '/chues/prospects/nouveau',
      '/chues/console',
      '/chues/rappels',
      '/chues/supervision',
      // Sous « Plus ».
      '/chues/suggestions',
      '/chues/representants',
      '/chues/prospects',
      '/chues/campagnes',
    ]);
    expect(navItems('SUPERVISEUR', 'chues').map((item) => item.label)).toEqual([
      'Tableau de bord',
      'Qualifier un représentant',
      'Ajouter un prospect',
      'Convertir un prospect',
      'Rappels promis',
      'Mon équipe',
      'Contacts recommandés',
      'Représentants',
      'Prospects',
      'Campagnes',
    ]);
  });

  it('garde le tableau de bord et le suivi de l’équipe en pleine barre, replie les lots', () => {
    const replies = navItems('SUPERVISEUR', 'chues')
      .filter((item) => item.secondary === true)
      .map((item) => item.href);
    expect(replies).toContain('/chues/campagnes');
    expect(replies).not.toContain('/chues/statistiques');
    expect(replies).not.toContain('/chues/supervision');
  });

  it('masque toujours l’administration, la banque et le registre des visites', () => {
    const visible = [
      ...hrefs('SUPERVISEUR', 'chues'),
      ...hrefs('SUPERVISEUR', 'accueil'),
      ...hrefs('SUPERVISEUR', 'admin'),
    ];
    for (const forbidden of [
      '/accueil',
      '/chues/representants/import',
      '/chues/dossiers',
      '/chues/demandes-clients',
      '/chues/banque',
      '/admin/notifications',
      '/admin/commerciaux',
      '/admin/referentiels',
      '/admin/imports',
      '/admin/parametres',
    ]) {
      expect(visible, `« ${forbidden} » ne doit pas être proposé`).not.toContain(forbidden);
    }
  });

  it('ne dit jamais « commercial » dans ses intitulés', () => {
    const labels = navItems('SUPERVISEUR', 'chues').map(
      (item) => `${item.label} ${item.description}`,
    );
    for (const text of labels) expect(text.toLowerCase()).not.toContain('commercial');
  });
});

describe('les trois étapes, lues à l’identique par les trois rôles qui les font', () => {
  const TERRAIN: readonly Role[] = ['COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'];

  /** Le même relevé pour chacun des trois : le diff nomme le rôle qui dévie. */
  const parRole = <T>(mesure: (role: Role) => T): Record<string, T> =>
    Object.fromEntries(TERRAIN.map((role) => [role, mesure(role)]));

  const PARTAGES = [
    '/chues/appels-representants',
    '/chues/prospects/nouveau',
    '/chues/console',
    '/chues/rappels',
    '/chues/suggestions',
    '/chues/representants',
    '/chues/prospects',
  ];

  it('ouvre sur son écran du matin, puis les trois étapes, dans le même ordre', () => {
    const etapes = ETAPES.map(({ href }) => href);

    expect(parRole((role) => hrefs(role, 'chues').slice(1, 4))).toEqual(parRole(() => etapes));
    // Le téléconseiller ouvre sur ses trois étapes ; qui encadre, sur les
    // chiffres de l'équipe. Les étapes viennent juste après pour tous.
    expect(parRole((role) => coqueHomePath(role, 'chues'))).toEqual({
      COMMERCIAL: '/chues',
      SUPERVISEUR: '/chues/statistiques',
      DIRECTION: '/chues/statistiques',
    });
  });

  it('emploie les mots du métier, ceux du sélecteur d’étapes', () => {
    expect(ETAPES.map(({ titre }) => titre)).toEqual([
      'Qualifier un représentant',
      'Ajouter un prospect',
      'Convertir un prospect',
    ]);
    // La barre latérale ne peut pas dériver du sélecteur : elle reprend les
    // mêmes intitulés, mot pour mot.
    expect(ETAPES.map(({ href }) => navTitle('COMMERCIAL', href))).toEqual(
      ETAPES.map(({ titre }) => titre),
    );
  });

  it('nomme chaque écran partagé exactement pareil pour les trois', () => {
    const titres = (role: Role): Record<string, string> =>
      Object.fromEntries(PARTAGES.map((href) => [href, navTitle(role, href)]));

    expect(titres('SUPERVISEUR')).toEqual(titres('COMMERCIAL'));
    expect(titres('DIRECTION')).toEqual(titres('COMMERCIAL'));
  });

  it('laisse les écrans des étapes ouverts aux trois rôles, garde serveur comprise', () => {
    const ouverts = Object.fromEntries(
      ETAPES.map(({ href }) => [
        href,
        TERRAIN.filter((role) => ROUTES.find(({ route }) => route === href)?.roles.includes(role)),
      ]),
    );

    expect(ouverts).toEqual(Object.fromEntries(ETAPES.map(({ href }) => [href, [...TERRAIN]])));
  });

  it('ne réserve le suivi de l’équipe qu’à ceux qui encadrent', () => {
    expect(parRole((role) => hrefs(role, 'chues').includes('/chues/supervision'))).toEqual({
      COMMERCIAL: false,
      SUPERVISEUR: true,
      DIRECTION: true,
    });
  });
});

describe('navigation d’un compte d’ACCUEIL', () => {
  it('ne montre QUE le registre : le tableau de bord est un onglet, pas une entrée', () => {
    expect(hrefs('ACCUEIL', 'accueil')).toEqual(['/accueil']);
    expect(navTitle('ACCUEIL', '/accueil/tableau-de-bord')).toBe('Tableau de bord');
  });

  it('n’a qu’une section, sans intitulé à lire', () => {
    const sections = navSections('ACCUEIL', 'accueil');
    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBeNull();
  });

  it('n’a rien à voir dans les trois autres coques', () => {
    for (const coque of ['chues', 'grand-public', 'admin'] as const) {
      expect(navItems('ACCUEIL', coque), coque).toEqual([]);
    }
  });
});

describe('navigation de la DIRECTION', () => {
  it('montre le registre, le pilotage et le terrain, jamais la banque', () => {
    expect(hrefs('DIRECTION', 'accueil')).toEqual(['/accueil']);
    expect(hrefs('DIRECTION', 'chues')).toEqual([
      '/chues/statistiques',
      '/chues/appels-representants',
      '/chues/prospects/nouveau',
      '/chues/console',
      '/chues/rappels',
      '/chues/supervision',
      // Sous « Plus ».
      '/chues/suggestions',
      '/chues/representants',
      '/chues/prospects',
      '/chues/campagnes',
    ]);
  });

  it('range le Grand Public dans le même ordre que CHUES, replis compris', () => {
    expect(hrefs('DIRECTION', 'grand-public')).toEqual([
      '/grand-public/statistiques',
      '/grand-public',
      // Sous « Plus ».
      '/grand-public/rappels',
    ]);
  });

  it('masque ce qui administre ou relève de la banque', () => {
    const visible = [...hrefs('DIRECTION', 'chues'), ...hrefs('DIRECTION', 'admin')];
    for (const forbidden of [
      '/chues/tableau-de-bord',
      '/chues/dossiers',
      '/chues/demandes-clients',
      '/admin/notifications',
      '/admin/commerciaux',
      '/admin/referentiels',
      '/admin/imports',
      '/admin/parametres',
    ]) {
      expect(visible, `« ${forbidden} » ne doit pas être proposé`).not.toContain(forbidden);
    }
  });

  it('voit au moins tout ce que voit la supervision', () => {
    const visible = new Set(hrefs('DIRECTION', 'chues'));
    expect(hrefs('SUPERVISEUR', 'chues').filter((href) => !visible.has(href))).toEqual([]);
  });
});

describe('boîte de réception, hors coque', () => {
  it('n’est proposée qu’aux rôles dont le garde la sert', () => {
    // La cloche s'affichait à l'ACCUEIL, dont le garde de l'écran ne voulait
    // pas : la pastille menait à un refus de permission.
    expect([...INBOX_ROLES].sort()).toEqual(
      PANEL_ROLES.filter((role) => role !== 'COMMERCIAL')
        .slice()
        .sort(),
    );
  });

  it('laisse une barre latérale REMPLIE à chacun d’eux', () => {
    for (const role of INBOX_ROLES) {
      const coque = fallbackCoque(role);
      expect(coque, role).not.toBeNull();
      expect(navSections(role, coque as Coque), role).not.toEqual([]);
    }
  });

  it('porte son propre titre dans la barre supérieure', () => {
    for (const role of INBOX_ROLES) {
      expect(navTitle(role, INBOX_PATH)).toBe('Notifications');
    }
  });

  it('renvoie l’ADMIN vers le composeur, qui porte le même onglet', () => {
    expect(inboxPathFor('ADMIN')).toBe('/admin/notifications?onglet=reception');
    expect(inboxPathFor('ACCUEIL')).toBe(INBOX_PATH);
  });
});

describe('navigation du pilotage sur le Grand Public et le registre', () => {
  it('range le Grand Public de la supervision comme celui de la direction', () => {
    expect(hrefs('SUPERVISEUR', 'grand-public')).toEqual([
      '/grand-public/statistiques',
      '/grand-public',
      // Sous « Plus ».
      '/grand-public/rappels',
    ]);
    expect(
      navItems('SUPERVISEUR', 'grand-public')
        .filter((item) => item.secondary === true)
        .map((item) => item.href),
    ).toEqual(['/grand-public/rappels']);
  });

  it('donne à l’ADMIN les deux écrans de saisie du Grand Public, sous « Plus »', () => {
    expect(hrefs('ADMIN', 'grand-public')).toEqual([
      '/grand-public/statistiques',
      '/grand-public',
      // Sous « Plus ».
      '/grand-public/rappels',
      '/grand-public/console',
      '/grand-public/nouveau',
    ]);
  });

  it('n’ouvre à l’ADMIN qu’une entrée dans le registre : les trois autres sont des onglets', () => {
    expect(hrefs('ADMIN', 'accueil')).toEqual(['/accueil']);
  });
});

describe('charge de la barre latérale', () => {
  it('tient à six entrées en pleine barre au plus, pour chaque rôle et chaque espace', () => {
    const trop = BARRES.filter(({ primaires }) => primaires.length > 6).map(
      ({ role, coque, primaires }) => `${role} · ${coque} : ${primaires.length}`,
    );
    expect(trop).toEqual([]);
  });

  it('n’ouvre jamais un espace autorisé sur une barre vide', () => {
    const vides = BARRES.filter(({ items }) => items.length === 0).map(
      ({ role, coque }) => `${role} · ${coque}`,
    );
    expect(vides).toEqual([]);
  });
});

describe('mots interdits dans la barre', () => {
  // « Phase n » est proscrit dans l'interface ; « tâche » et « file d'appel »
  // nomment une fonctionnalité retirée ; les autres sont du
  // vocabulaire d'équipe que personne n'emploie au téléphone.
  const PROSCRITS = [
    'phase',
    'pilotage',
    'console',
    'commercial',
    'tâche',
    'file d’appel',
  ];

  it('ne laisse passer aucun jargon, pour aucun rôle', () => {
    const fautes = ENTREES.flatMap(({ role, item }) => {
      const texte = `${item.label} ${item.description}`.toLowerCase();
      return PROSCRITS.filter((mot) => texte.includes(mot)).map(
        (mot) => `${role} · ${item.href} · « ${mot} »`,
      );
    });
    expect(fautes).toEqual([]);
  });

  it('nomme chaque entrée par un geste ou un objet, jamais par sa route', () => {
    const fautes = ENTREES.filter(
      ({ item }) => item.label.length <= 2 || item.label.includes('/'),
    ).map(({ role, item }) => `${role} · ${item.href} · « ${item.label} »`);
    expect(fautes).toEqual([]);
  });
});

describe('aucun écran orphelin', () => {
  it('trouve bien les écrans du panel', () => {
    expect(ROUTES.length).toBeGreaterThan(25);
    expect(ROUTES.find(({ route }) => route === '/chues')?.roles).toContain('BANQUE_FINANCE');
    expect(ROUTES.find(({ route }) => route === '/admin/parametres')?.roles).toEqual(['ADMIN']);
    expect(ROUTES.find(({ route }) => route === '/notifications')?.roles).not.toContain(
      'COMMERCIAL',
    );
  });

  it('laisse à chaque rôle un chemin cliquable vers chaque écran qu’il a le droit d’ouvrir', () => {
    const orphelines: string[] = [];
    for (const { route, roles } of ROUTES) {
      const coque = coqueOf(route);
      for (const role of roles) {
        if (coque !== null && !coqueAllowed(role, coque)) continue;
        if (coque !== null && hrefs(role, coque).includes(route)) continue;
        if (route in ATTEINT_AUTREMENT) continue;
        orphelines.push(`${role} · ${route}`);
      }
    }
    expect(orphelines).toEqual([]);
  });

  it('masque exactement les écrans prévus, rôle par rôle', () => {
    expect(Object.fromEntries(PANEL_ROLES.map((role) => [role, horsBarre(role)]))).toEqual(
      MASQUEES,
    );
  });

  it('ne garde aucun renvoi vers un écran disparu', () => {
    const connues = new Set(ROUTES.map(({ route }) => route));
    expect(Object.keys(ATTEINT_AUTREMENT).filter((route) => !connues.has(route))).toEqual([]);
  });
});
