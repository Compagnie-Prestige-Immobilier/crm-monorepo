import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { AA_LARGE, AA_TEXT, ratio, relativeLuminance, parseHex } from '@/lib/contrast';

/**
 * Les tokens sont lus DANS `globals.css`, jamais recopiés ici : un test qui
 * boucle sur son propre littéral ne peut pas rougir le jour où quelqu'un
 * éclaircit le bleu de la coque.
 */
const CSS = readFileSync(fileURLToPath(new URL('../../app/globals.css', import.meta.url)), 'utf8');

const SIDEBAR_NAV = readFileSync(
  fileURLToPath(new URL('./sidebar-nav.tsx', import.meta.url)),
  'utf8',
);

function block(selector: string): Record<string, string> {
  const start = CSS.indexOf(selector);
  expect(start, `sélecteur absent de globals.css : ${selector}`).toBeGreaterThan(-1);

  const open = CSS.indexOf('{', start);
  const close = CSS.indexOf('}', open);
  const body = CSS.slice(open + 1, close);

  const tokens: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    if (name !== undefined && value !== undefined) tokens[name] = value.trim();
  }
  return tokens;
}

const CLAIR = block("[data-coque='chues'],\nhtml:has([data-coque='chues'])");
const SOMBRE = block(".dark [data-coque='chues'],\nhtml.dark:has([data-coque='chues'])");

/** Paires TEXTE : 4,5:1 au minimum (WCAG 1.4.3). */
const TEXTE: readonly [string, string][] = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['primary-foreground', 'primary-hover'],
  ['primary-text', 'background'],
  ['primary-text', 'card'],
  ['secondary-foreground', 'secondary'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['accent-foreground', 'accent'],
  ['accent-text', 'background'],
  ['accent-text', 'card'],
  ['accent-text', 'accent-surface'],
  ['foreground', 'accent-surface'],
  ['info-foreground', 'info'],
  ['sidebar-foreground', 'sidebar'],
  ['sidebar-foreground', 'sidebar-accent'],
  ['sidebar-muted-foreground', 'sidebar'],
  ['sidebar-muted-foreground', 'sidebar-accent'],
  ['sidebar-accent-foreground', 'sidebar-accent'],
  ['sidebar-primary', 'sidebar'],
  ['accent-on-dark', 'sidebar'],
  ['accent-on-dark', 'sidebar-accent'],
  ['chart-tick', 'background'],
];

/** Paires NON textuelles : contours, anneaux, traits de graphique (WCAG 1.4.11). */
const TRACE: readonly [string, string][] = [
  ['input-border', 'background'],
  ['input-border', 'card'],
  ['accent-border', 'background'],
  ['ring', 'background'],
  ['sidebar-ring', 'sidebar'],
  ['chart-1', 'background'],
  ['chart-4', 'background'],
];

describe.each([
  ['clair', CLAIR],
  ['sombre', SOMBRE],
])('palette CHUES, mode %s', (mode, tokens) => {
  it.each(TEXTE)('%s sur %s atteint 4,5:1', (avant, arriere) => {
    const mesure = ratio(String(tokens[avant]), String(tokens[arriere]));
    expect(
      mesure,
      `${mode} · --${avant} sur --${arriere} : ${String(mesure)}:1`,
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(TRACE)('%s sur %s atteint 3:1', (avant, arriere) => {
    const mesure = ratio(String(tokens[avant]), String(tokens[arriere]));
    expect(
      mesure,
      `${mode} · --${avant} sur --${arriere} : ${String(mesure)}:1`,
    ).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('est BLEUE : le bleu domine le rouge et le vert sur la couleur d’action', () => {
    const { r, g, b } = parseHex(String(tokens['primary']));
    expect(b).toBeGreaterThan(r + 40);
    expect(b).toBeGreaterThan(g + 20);
  });

  it('est NOIRE : la barre latérale reprend le noir massif du logo', () => {
    expect(relativeLuminance(parseHex(String(tokens['sidebar'])))).toBeLessThan(0.02);
  });

  it('n’emprunte pas l’or de CPI', () => {
    for (const role of ['accent', 'accent-text', 'accent-border', 'accent-on-dark']) {
      expect(String(tokens[role]).toLowerCase(), role).not.toBe('#c8921a');
    }
  });
});

/**
 * Le repère de l'entrée courante, LU DANS LE COMPOSANT.
 *
 * L'entrée active ne peut pas se signaler par la seule couleur du texte : elle
 * porte un filet vertical, qui doit lui-même se voir. Le token est extrait de
 * la classe plutôt que recopié, sinon le test survivrait au retour d'un bleu
 * illisible sur le noir de la coque.
 */
describe('filet de l’entrée courante', () => {
  const token = /before:bg-([\w-]+)/u.exec(SIDEBAR_NAV)?.[1];

  it('existe, et ne repose pas sur la couleur du texte seule', () => {
    expect(token).toBeDefined();
    expect(SIDEBAR_NAV).toContain("aria-current={isActive ? 'page' : undefined}");
  });

  it.each([
    ['clair', CLAIR],
    ['sombre', SOMBRE],
  ])('se détache du fond de la barre en mode %s', (mode, tokens) => {
    for (const fond of ['sidebar', 'sidebar-accent']) {
      const mesure = ratio(String(tokens[String(token)]), String(tokens[fond]));
      expect(
        mesure,
        `${mode} · --${String(token)} sur --${fond} : ${String(mesure)}:1`,
      ).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });
});

describe('les deux modes de la coque CHUES', () => {
  // `html:has(...)` bat `.dark` en spécificité : un token déclaré en clair et
  // oublié en sombre servirait sa valeur CLAIRE sur fond sombre.
  it('déclarent exactement les mêmes tokens', () => {
    expect(Object.keys(SOMBRE).sort()).toEqual(Object.keys(CLAIR).sort());
  });

  it('en déclarent assez pour couvrir tout ce que les tests mesurent', () => {
    for (const [avant, arriere] of [...TEXTE, ...TRACE]) {
      expect(CLAIR, avant).toHaveProperty(avant);
      expect(CLAIR, arriere).toHaveProperty(arriere);
    }
  });
});
