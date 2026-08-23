import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const CSS = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'globals.css'),
  'utf8',
);

const bloc = (): string => {
  const start = CSS.indexOf('@media print');
  expect(start, 'aucune règle @media print').toBeGreaterThan(-1);
  return CSS.slice(start);
};

describe('impression des tableaux', () => {
  // Aucun navigateur ne fragmente un contexte de défilement sur plusieurs
  // pages : le registre s'arrêtait net au bas de la première feuille.
  it('neutralise le conteneur défilant de `Table`', () => {
    expect(bloc()).toMatch(/\[data-slot='table-container'\][\s\S]*?overflow:\s*visible/u);
  });

  it('ne coupe pas une ligne en deux et répète l’en-tête', () => {
    expect(bloc()).toMatch(/\[data-slot='table-row'\][\s\S]*?break-inside:\s*avoid/u);
    expect(bloc()).toMatch(/\[data-slot='table-header'\][\s\S]*?table-header-group/u);
  });
});
