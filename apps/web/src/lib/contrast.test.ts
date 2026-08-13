import { describe, expect, it } from 'vitest';

import { AA_LARGE, AA_TEXT, TOKENS, contrastRatio, parseHex, ratio } from '@/lib/contrast';

/**
 * Contraste des paires RÉELLEMENT employées par le panel.
 *
 * Deux familles de tests, et la seconde est celle qui manquait :
 *
 *  1. Les paires sur fond CLAIR, celles que `docs/design.md` mesure.
 *  2. Les paires sur fond SOMBRE — bordeaux `#630210`, sidebar `#3A010A`. Le
 *     document ne les mesure pas, et c'est précisément là que les quatre
 *     tokens de statut deviennent illisibles : ce sont tous des teintes
 *     foncées.
 *
 * Les tests d'échec (« cette paire NE DOIT PAS être employée ») comptent autant
 * que les tests de réussite : ils fixent la raison d'être des déclinaisons
 * sombres. Sans eux, quelqu'un les remplacerait un jour par le token « normal »,
 * les tests resteraient verts, et l'écran redeviendrait illisible.
 */

function expectReadable(name: string, fg: string, bg: string, threshold = AA_TEXT): void {
  const measured = ratio(fg, bg);
  expect(measured, `${name} : ${String(measured)}:1, seuil ${String(threshold)}:1`).toBeGreaterThanOrEqual(
    threshold,
  );
}

function expectUnreadable(name: string, fg: string, bg: string): void {
  const measured = ratio(fg, bg);
  expect(measured, `${name} : ${String(measured)}:1 — cette paire devrait échouer`).toBeLessThan(
    AA_LARGE,
  );
}

describe('formule', () => {
  it('mesure les extrêmes connus', () => {
    expect(ratio('#000000', '#FFFFFF')).toBe(21);
    expect(ratio('#FFFFFF', '#FFFFFF')).toBe(1);
  });

  it('est symétrique', () => {
    expect(contrastRatio('#630210', '#FFC65A')).toBeCloseTo(
      contrastRatio('#FFC65A', '#630210'),
      10,
    );
  });

  it('accepte la forme courte et la casse', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('C8921A')).toEqual(parseHex('#c8921a'));
  });

  it('refuse une couleur mal orthographiée plutôt que de la lire en noir', () => {
    expect(() => parseHex('#12345')).toThrow();
    expect(() => parseHex('rgba(99,2,16,0.12)')).toThrow();
  });
});

describe('texte sur surface claire (design.md §2)', () => {
  it('texte courant et texte secondaire', () => {
    expectReadable('foreground sur background', TOKENS.foreground, TOKENS.background);
    expectReadable('foreground sur card', TOKENS.foreground, TOKENS.card);
    expectReadable('muted-foreground sur card', TOKENS.mutedForeground, TOKENS.card);
    expectReadable('secondary-foreground sur secondary', TOKENS.secondaryForeground, TOKENS.secondary);
  });

  it('statuts sur leurs surfaces dédiées', () => {
    expectReadable('success', TOKENS.success, TOKENS.successSurface);
    expectReadable('destructive', TOKENS.destructive, TOKENS.destructiveSurface);
    expectReadable('warning', TOKENS.warning, TOKENS.warningSurface);
    expectReadable('info', TOKENS.info, TOKENS.infoSurface);
  });

  it('statuts sur la carte, où ils sont aussi employés', () => {
    // `text-destructive` apparaît sur fond `card` dans les libellés de champ
    // obligatoire et les messages d'erreur de formulaire.
    expectReadable('destructive sur card', TOKENS.destructive, TOKENS.card);
    expectReadable('success sur card', TOKENS.success, TOKENS.card);
    expectReadable('warning sur card', TOKENS.warning, TOKENS.card);
    expectReadable('info sur card', TOKENS.info, TOKENS.card);
  });
});

describe('la règle de l’or (design.md §2.3)', () => {
  it('interdit l’or comme couleur de TEXTE', () => {
    // 2,77:1. C'est LA règle du document, et le test la rend opposable.
    expectUnreadable('accent en texte sur card', TOKENS.accent, TOKENS.card);
    expectUnreadable('accent en texte sur background', TOKENS.accent, TOKENS.background);
  });

  it('autorise accent-text, et lui seul, pour du texte or', () => {
    expectReadable('accent-text sur card', TOKENS.accentText, TOKENS.card);
    expectReadable('accent-text sur accent-surface', TOKENS.accentText, TOKENS.accentSurface);
    expectReadable('accent-text sur background', TOKENS.accentText, TOKENS.background);
  });

  it('autorise du texte sombre POSÉ SUR une surface or', () => {
    expectReadable('accent-foreground sur accent', TOKENS.accentForeground, TOKENS.accent);
  });

  it('tient le seuil non textuel pour les traits or', () => {
    // §2.6 condition 1 : c'est ce trait qui délimite la série or d'un graphique.
    expectReadable('accent-border sur card', TOKENS.accentBorder, TOKENS.card, AA_LARGE);
    expectReadable('accent-border sur background', TOKENS.accentBorder, TOKENS.background, AA_LARGE);
  });
});

describe('texte sur surface SOMBRE — ce que design.md ne mesure pas', () => {
  const DARK_SURFACES: readonly [string, string][] = [
    ['bordeaux primary', TOKENS.primary],
    ['sidebar', TOKENS.sidebar],
    ['sidebar-accent', TOKENS.sidebarAccent],
  ];

  it('le blanc passe partout', () => {
    for (const [name, surface] of DARK_SURFACES) {
      expectReadable(`primary-foreground sur ${name}`, TOKENS.primaryForeground, surface);
    }
  });

  it('la navigation est lisible', () => {
    expectReadable('sidebar-foreground sur sidebar', TOKENS.sidebarForeground, TOKENS.sidebar);
    expectReadable(
      'sidebar-foreground sur sidebar-accent',
      TOKENS.sidebarForeground,
      TOKENS.sidebarAccent,
    );
    expectReadable(
      'sidebar-accent-foreground sur sidebar-accent',
      TOKENS.sidebarAccentForeground,
      TOKENS.sidebarAccent,
    );
  });

  it('l’or de l’élément actif est accent-on-dark, jamais accent-text', () => {
    for (const [name, surface] of DARK_SURFACES) {
      expectReadable(`accent-on-dark sur ${name}`, TOKENS.accentOnDark, surface);
    }
    // #856011 sur bordeaux : la déclinaison texte du mode CLAIR ne survit pas
    // au passage sur fond sombre.
    expectUnreadable('accent-text sur bordeaux', TOKENS.accentText, TOKENS.primary);
    expectUnreadable('accent-text sur sidebar', TOKENS.accentText, TOKENS.sidebar);
  });

  it('les quatre tokens de statut du mode clair échouent sur bordeaux', () => {
    // Le défaut constaté sur le mobile : un message de validation rendu en
    // `destructive` #B91C1C sur le fond bordeaux plein, à 2,10:1.
    expectUnreadable('destructive sur bordeaux', TOKENS.destructive, TOKENS.primary);
    expectUnreadable('success sur bordeaux', TOKENS.success, TOKENS.primary);
    expectUnreadable('warning sur bordeaux', TOKENS.warning, TOKENS.primary);
    expectUnreadable('info sur bordeaux', TOKENS.info, TOKENS.primary);
  });

  it('leurs déclinaisons sombres passent', () => {
    for (const [name, surface] of DARK_SURFACES) {
      expectReadable(`destructive-on-dark sur ${name}`, TOKENS.destructiveOnDark, surface);
      expectReadable(`success-on-dark sur ${name}`, TOKENS.successOnDark, surface);
      expectReadable(`warning-on-dark sur ${name}`, TOKENS.warningOnDark, surface);
      expectReadable(`info-on-dark sur ${name}`, TOKENS.infoOnDark, surface);
    }
  });

  it('l’anneau de focus de la sidebar tient le seuil non textuel', () => {
    expectReadable('sidebar-ring sur sidebar', TOKENS.sidebarRing, TOKENS.sidebar, AA_LARGE);
  });
});

describe('mode sombre du panel (design.md §3)', () => {
  it('texte courant', () => {
    expectReadable('foreground sur background', TOKENS.darkForeground, TOKENS.darkBackground);
    expectReadable('foreground sur card', TOKENS.darkForeground, TOKENS.darkCard);
  });

  it('le bordeaux sombre porte du BLANC et non du texte sombre', () => {
    expectReadable('primary-foreground sur primary', TOKENS.primaryForeground, TOKENS.darkPrimary);
    // C'est la raison du token `--primary-text` : le bordeaux d'aplat ne se lit
    // pas en texte sur la carte sombre.
    expectUnreadable('primary en texte sur card sombre', TOKENS.darkPrimary, TOKENS.darkCard);
    expectReadable('primary-text sur card sombre', TOKENS.darkPrimaryText, TOKENS.darkCard);
  });

  it('les statuts sombres se lisent sur la carte sombre', () => {
    expectReadable('destructive', TOKENS.destructiveOnDark, TOKENS.darkCard);
    expectReadable('success', TOKENS.successOnDark, TOKENS.darkCard);
    expectReadable('warning', TOKENS.warningOnDark, TOKENS.darkCard);
    expectReadable('info', TOKENS.infoOnDark, TOKENS.darkCard);
    expectReadable('accent-text', TOKENS.accentOnDark, TOKENS.darkCard);
  });
});

describe('séries de graphiques (design.md §2.6)', () => {
  it('chaque série se distingue de la carte au seuil non textuel, sauf l’or', () => {
    for (const [name, color] of [
      ['chart-1', TOKENS.chart1],
      ['chart-3', TOKENS.chart3],
      ['chart-4', TOKENS.chart4],
      ['chart-5', TOKENS.chart5],
    ] as const) {
      expectReadable(`${name} sur card`, color, TOKENS.card, AA_LARGE);
    }
  });

  it('l’or ne tient QUE par son contour, ce qui est l’exception assumée', () => {
    expectUnreadable('chart-2 sur card', TOKENS.chart2, TOKENS.card);
    expectReadable('contour de chart-2', TOKENS.accentBorder, TOKENS.card, AA_LARGE);
  });
});
