import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const APP = path.dirname(fileURLToPath(import.meta.url));

function pages(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) pages(full, acc);
    else if (entry === 'page.tsx') acc.push(full);
  }
  return acc;
}

/** Le fichier existe-t-il dans ce segment ou dans l'un de ses parents ? */
function coveredBy(page: string, filename: string, root: string = APP): boolean {
  let dir = path.dirname(page);
  for (;;) {
    if (existsSync(path.join(dir, filename))) return true;
    if (dir === root) return false;
    dir = path.dirname(dir);
  }
}

const relative = (file: string): string => path.relative(APP, file).split(path.sep).join('/');

describe('frontières de route', () => {
  const all = pages(APP);

  it('trouve bien les écrans à couvrir', () => {
    expect(all.length).toBeGreaterThan(40);
  });

  // Sans frontière, une exception de rendu remplace TOUT l'écran par la page
  // d'erreur générique de Next, en anglais, coque et navigation comprises.
  it('chaque écran a une frontière d’erreur au-dessus de lui', () => {
    expect(all.filter((page) => !coveredBy(page, 'error.tsx')).map(relative)).toEqual([]);
  });

  it('la coque racine en a une aussi, qui reconstruit le document', () => {
    expect(existsSync(path.join(APP, 'global-error.tsx'))).toBe(true);
  });

  /**
   * Les seules pages du panel sans titre : les racines de coque, qui ne
   * rendent rien et redirigent vers le premier écran du rôle.
   */
  const SANS_TITRE = new Set(['(panel)/chues/page.tsx', '(panel)/admin/page.tsx']);

  /** Déclaré sur place, ou repris d'un écran réexporté. */
  const PORTE_UN_TITRE =
    /export const metadata|export async function generateMetadata|export \{[^}]*\bmetadata\b[^}]*\} from/u;

  it('chaque écran du panel nomme son onglet de navigateur', () => {
    const muets = all
      .filter((page) => relative(page).startsWith('(panel)/'))
      .filter((page) => !SANS_TITRE.has(relative(page)))
      .filter((page) => !PORTE_UN_TITRE.test(readFileSync(page, 'utf8')))
      .map(relative);

    expect(muets).toEqual([]);
  });

  // Deux entrées de menu qui rendaient le MÊME écran : « Tableau de bord » et
  // « Statistiques » du Grand Public réexportaient tous deux la page CHUES.
  it('ne fait pas rendre deux entrées de menu par le même module', () => {
    const reexports = new Map<string, string[]>();
    for (const page of all.filter((entry) => relative(entry).startsWith('(panel)/'))) {
      const match = /export \{[^}]*default[^}]*\} from '([^']+)'/u.exec(readFileSync(page, 'utf8'));
      if (match?.[1] === undefined) continue;
      const cible = path.resolve(path.dirname(page), match[1]);
      reexports.set(cible, [...(reexports.get(cible) ?? []), relative(page)]);
    }

    for (const [cible, sources] of reexports) {
      expect(sources, path.basename(cible)).toHaveLength(1);
    }
  });

  // `(panel)` et `(hub)` forcent le rendu dynamique : sans repli, la navigation
  // reste figée sur l'écran précédent, sans retour visuel.
  it('chaque écran rendu dynamiquement a un repli de chargement', () => {
    const dynamiques = all.filter(
      (page) => relative(page).startsWith('(panel)/') || relative(page).startsWith('(hub)/'),
    );
    expect(dynamiques.length).toBeGreaterThan(40);
    expect(dynamiques.filter((page) => !coveredBy(page, 'loading.tsx')).map(relative)).toEqual([]);
  });
});
