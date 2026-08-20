import { describe, expect, it } from 'vitest';

import {
  COQUES,
  coqueAllowed,
  coqueHomePath,
  coqueOf,
  coquesForRole,
  homePathForRole,
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

describe('navigation d’un agent BANQUE_FINANCE', () => {
  it('ne montre QUE ses écrans, dans la coque CHUES', () => {
    expect(hrefs('BANQUE_FINANCE', 'chues')).toEqual([
      '/chues/banque',
      '/chues/dossiers',
      '/chues/dossiers/nouveau',
      '/chues/dossiers/export',
      '/chues/demandes-clients',
    ]);
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

  it('son « Tableau de bord » est le tableau de bord BANCAIRE', () => {
    const dashboard = navItems('BANQUE_FINANCE', 'chues').find(
      (item) => item.label === 'Tableau de bord',
    );
    expect(dashboard?.href).toBe('/chues/banque');
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
      '/chues/tableau-de-bord',
      '/chues/statistiques',
      '/chues/prospects',
      '/chues/campagnes',
      '/chues/dossiers',
      '/chues/dossiers/nouveau',
      '/chues/dossiers/export',
      '/chues/dossiers/etapes',
      '/chues/demandes-clients',
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
    expect(entry?.label).toBe('Mes demandes');
    expect(
      navItems('ADMIN', 'chues').find((item) => item.href === '/chues/demandes-clients')?.label,
    ).toBe('Demandes clients');
  });

  it('ne voit PAS le tableau de bord bancaire en doublon de son propre tableau de bord', () => {
    expect(
      navItems('ADMIN', 'chues').filter((item) => item.label === 'Tableau de bord'),
    ).toHaveLength(1);
    expect(hrefs('ADMIN', 'chues')).not.toContain('/chues/banque');
  });

  it('groupe la navigation de CHUES en sections non vides', () => {
    const sections = navSections('ADMIN', 'chues');
    expect(sections.map((section) => section.title)).toEqual([null, 'Terrain', 'Banque & Finance']);
    for (const section of sections) expect(section.items.length).toBeGreaterThan(0);
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
});

describe('navigation d’un téléconseiller', () => {
  it('ne montre QUE la section Terrain de CHUES', () => {
    expect(navSections('COMMERCIAL', 'chues').map((section) => section.title)).toEqual(['Terrain']);
    expect(hrefs('COMMERCIAL', 'chues')).toEqual([
      '/chues/console',
      '/chues/rappels',
      '/chues/representants',
      '/chues/suggestions',
      '/chues/prospects/nouveau',
    ]);
  });

  it('masque entièrement le pilotage et l’administration', () => {
    const visible = [...hrefs('COMMERCIAL', 'chues'), ...hrefs('COMMERCIAL', 'admin')];
    for (const forbidden of [
      '/accueil',
      '/chues/tableau-de-bord',
      '/chues/banque',
      '/chues/statistiques',
      '/chues/prospects',
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

  it('donne à l’ADMIN les mêmes écrans de terrain, sans doublon de « Représentants »', () => {
    for (const shared of ['/chues/console', '/chues/representants', '/chues/prospects/nouveau']) {
      expect(hrefs('ADMIN', 'chues')).toContain(shared);
    }
    expect(hrefs('ADMIN', 'chues').filter((href) => href === '/chues/representants')).toHaveLength(
      1,
    );
  });

  it('n’ouvre le terrain à aucun agent bancaire', () => {
    const visible = hrefs('BANQUE_FINANCE', 'chues');
    for (const forbidden of [
      '/chues/console',
      '/chues/prospects/nouveau',
      '/chues/representants',
      '/chues/suggestions',
    ]) {
      expect(visible).not.toContain(forbidden);
    }
  });

  it('range les numéros suggérés dans le Terrain, sous son propre titre', () => {
    const terrain = navSections('COMMERCIAL', 'chues').find(
      (section) => section.title === 'Terrain',
    );
    const entry = terrain?.items.find((item) => item.href === '/chues/suggestions');
    expect(entry?.label).toBe('Numéros suggérés');
    expect(navTitle('COMMERCIAL', '/chues/suggestions')).toBe('Numéros suggérés');
  });

  it('nomme sa console sans employer le mot proscrit', () => {
    const labels = navItems('COMMERCIAL', 'chues').map(
      (item) => `${item.label} ${item.description}`,
    );
    for (const text of labels) expect(text.toLowerCase()).not.toContain('commercial');
    expect(navTitle('COMMERCIAL', '/chues/console')).toBe('Console d’appel');
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
    expect(navTitle('DIRECTION', '/accueil/tableau-de-bord')).toBe('Tableau de bord');
    expect(hrefs('DIRECTION', 'accueil')).toContain('/accueil/tableau-de-bord');
    expect(hrefs('DIRECTION', 'chues')).not.toContain('/chues/tableau-de-bord');
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
    expect(coqueHomePath('ADMIN', 'chues')).toBe('/chues/tableau-de-bord');
    expect(coqueHomePath('BANQUE_FINANCE', 'chues')).toBe('/chues/banque');
    expect(coqueHomePath('COMMERCIAL', 'chues')).toBe('/chues/console');
    expect(coqueHomePath('SUPERVISEUR', 'chues')).toBe('/chues/supervision');
    expect(coqueHomePath('DIRECTION', 'accueil')).toBe('/accueil');
    expect(coqueHomePath('ACCUEIL', 'accueil')).toBe('/accueil');
  });

  it('renvoie au hub une coque qu’un rôle ne peut pas ouvrir, au lieu d’un écran interdit', () => {
    expect(coqueHomePath('ACCUEIL', 'admin')).toBe('/espaces');
    expect(coqueHomePath('BANQUE_FINANCE', 'grand-public')).toBe('/espaces');
  });
});

describe('titre et surbrillance par PRÉFIXE LE PLUS LONG', () => {
  it('distingue « Nouveau dossier » de « Dossiers »', () => {
    expect(navTitle('BANQUE_FINANCE', '/chues/dossiers/nouveau')).toBe('Nouveau dossier');
    expect(navTitle('BANQUE_FINANCE', '/chues/dossiers/export')).toBe('Export');
    expect(navTitle('ADMIN', '/chues/dossiers/etapes')).toBe('Étapes bancaires');
  });

  it('nomme l’écran des comptes par ce qu’il contient VRAIMENT', () => {
    expect(navTitle('ADMIN', '/admin/commerciaux')).toBe('Utilisateurs');
    expect(navTitle('ADMIN', '/admin/commerciaux')).not.toContain('Commerciaux');
    expect(navTitle('ADMIN', '/chues/supervision')).toBe('Supervision');
    expect(navTitle('ADMIN', '/chues/statistiques')).toBe('Statistiques');
  });

  it('garde « Dossiers » sur le détail d’un dossier', () => {
    expect(navTitle('BANQUE_FINANCE', '/chues/dossiers/019ff658-dddd-7489-ab22-1f2ada5ef38a')).toBe(
      'Dossiers',
    );
  });

  it('surligne une seule entrée à la fois', () => {
    const items = navItems('ADMIN', 'chues');
    const active = items.filter((item) =>
      isNavItemActive('ADMIN', '/chues/dossiers/nouveau', item),
    );
    expect(active).toHaveLength(1);
    expect(active[0]?.href).toBe('/chues/dossiers/nouveau');
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
  it('ne montre QUE des écrans de lecture', () => {
    expect(hrefs('SUPERVISEUR', 'chues')).toEqual([
      '/chues/supervision',
      '/chues/statistiques',
      '/chues/prospects',
      '/chues/campagnes',
      '/chues/rappels',
      '/chues/representants',
      '/chues/suggestions',
    ]);
  });

  it('masque tout ce qui écrit, saisit, administre ou synchronise', () => {
    const visible = [
      ...hrefs('SUPERVISEUR', 'chues'),
      ...hrefs('SUPERVISEUR', 'accueil'),
      ...hrefs('SUPERVISEUR', 'admin'),
    ];
    for (const forbidden of [
      '/accueil',
      '/chues/console',
      '/chues/prospects/nouveau',
      '/chues/representants/import',
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

  it('ne dit jamais « commercial » dans ses intitulés', () => {
    const labels = navItems('SUPERVISEUR', 'chues').map(
      (item) => `${item.label} ${item.description}`,
    );
    for (const text of labels) expect(text.toLowerCase()).not.toContain('commercial');
  });
});

describe('navigation d’un compte d’ACCUEIL', () => {
  it('ne montre QUE le registre et son tableau de bord', () => {
    expect(hrefs('ACCUEIL', 'accueil')).toEqual(['/accueil', '/accueil/tableau-de-bord']);
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
    expect(hrefs('DIRECTION', 'accueil')).toEqual(['/accueil', '/accueil/tableau-de-bord']);
    expect(hrefs('DIRECTION', 'chues')).toEqual([
      '/chues/supervision',
      '/chues/statistiques',
      '/chues/prospects',
      '/chues/campagnes',
      '/chues/rappels',
      '/chues/representants',
      '/chues/suggestions',
    ]);
  });

  it('masque ce qui écrit, saisit, administre ou relève de la banque', () => {
    const visible = [...hrefs('DIRECTION', 'chues'), ...hrefs('DIRECTION', 'admin')];
    for (const forbidden of [
      '/chues/tableau-de-bord',
      '/chues/console',
      '/chues/prospects/nouveau',
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
