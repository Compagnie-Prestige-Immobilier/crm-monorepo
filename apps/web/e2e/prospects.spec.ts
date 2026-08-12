import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

/**
 * Parcours de référence : session établie → filtrage du tableau → export Excel.
 *
 * La connexion elle-même est jouée par `auth.setup.ts` et vérifiée en propre
 * dans `auth.anon.spec.ts`. Ici on part d'une session déjà posée pour ne pas
 * consommer le quota de connexion de l'API à chaque test.
 *
 * Les deux étapes couvertes ont un mode de défaillance que seul un vrai
 * navigateur révèle :
 *  - les filtres vivent dans l'URL et doivent survivre à un rechargement ;
 *  - l'export est un téléchargement binaire, pas une réponse JSON.
 */

/** Les quatre premiers octets d'un `.xlsx` : la signature ZIP « PK\x03\x04 ». */
async function readMagic(path: string): Promise<number[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream(path, { start: 0, end: 3 })) {
    chunks.push(chunk as Buffer);
  }
  return [...Buffer.concat(chunks)];
}

test('le jeton de session reste hors de portée du JavaScript de la page', async ({ page }) => {
  await page.goto('/tableau-de-bord');
  await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible();

  // C'est toute la raison d'être des cookies httpOnly et du relais `/api/v1/*` :
  // une XSS ne doit pas pouvoir repartir avec la base de prospects.
  const scriptVisible = await page.evaluate(() => document.cookie);
  expect(scriptVisible).not.toContain('cpi_at');
  expect(scriptVisible).not.toContain('cpi_rt');

  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === 'cpi_at')?.httpOnly).toBe(true);
  expect(cookies.find((cookie) => cookie.name === 'cpi_rt')?.httpOnly).toBe(true);
});

test('filtrage du tableau puis export xlsx', async ({ page }) => {
  await page.goto('/prospects');
  await expect(page.getByRole('table')).toBeVisible();

  /**
   * Visé par son NOM accessible, pas par `[aria-live].first()`.
   *
   * Le `Toaster` de Sonner monte sa propre région `aria-live="polite"`, montée
   * plus haut dans le DOM par le fournisseur global. `.first()` tombait donc
   * sur une région vide et attendait dix secondes un texte qui n'y serait
   * jamais apparu.
   */
  const countLine = page.getByRole('status').filter({ hasText: 'Prospects affichés' });
  await expect(countLine).toBeVisible();
  await expect(countLine).not.toHaveText('');

  // ─── Filtrage ────────────────────────────────────────────────────────────
  // Le rôle `combobox` est indispensable : l'en-tête de tri de la colonne
  // porte AUSSI le nom accessible « Statut », mais comme `button`. Viser le
  // bouton triait la colonne au lieu d'ouvrir le filtre.
  await page.getByRole('combobox', { name: 'Statut' }).click();
  await page.getByRole('option', { name: 'Nouveau', exact: true }).click();

  // L'URL EST l'état : sans cela le lien n'est pas partageable, et l'export ne
  // peut pas s'aligner sur ce qui est affiché.
  await expect(page).toHaveURL(/statut=NOUVEAU/);
  await expect(countLine).not.toHaveText('');
  const filtered = (await countLine.textContent())?.trim() ?? '';
  expect(filtered.length).toBeGreaterThan(0);

  // Un rechargement complet restitue exactement le même écran.
  await page.reload();
  await expect(page).toHaveURL(/statut=NOUVEAU/);
  await expect(page.getByRole('status').filter({ hasText: 'Prospects affichés' })).toHaveText(
    filtered,
  );

  // ─── Export ──────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Exporter' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Exporter la vue filtrée/ }).click(),
  ]);

  // Nom daté et extension .xlsx : c'est ce qui décide si le système propose
  // Excel ou ouvre le fichier dans le navigateur.
  expect(download.suggestedFilename()).toMatch(/^cpi-prospects-\d{4}-\d{2}-\d{2}\.xlsx$/);

  const path = await download.path();
  const { size } = await stat(path);
  expect(size).toBeGreaterThan(1_000);

  // Et c'est un VRAI classeur, pas un JSON d'erreur renommé : un 502 relayé
  // tel quel passerait toutes les assertions précédentes sauf celle-ci.
  expect(await readMagic(path)).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

test('chaque écran du panel se charge sans état d’erreur', async ({ page }) => {
  // Balayage large : chaque écran rend son contenu, jamais l'état d'erreur ni
  // un squelette permanent.
  for (const [path, heading] of [
    ['/tableau-de-bord', 'Tableau de bord'],
    ['/prospects', 'Prospects'],
    ['/campagnes', 'Campagnes'],
    ['/dossiers', 'Dossiers'],
    ['/dossiers/nouveau', 'Nouveau dossier'],
    ['/dossiers/export', 'Export'],
    ['/dossiers/etapes', 'Étapes bancaires'],
    ['/representants', 'Représentants'],
    ['/commerciaux', 'Commerciaux'],
    ['/referentiels', 'Référentiels'],
    ['/parametres', 'Paramètres'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();

    /**
     * On vise les titres de `QueryErrorState`, pas `getByRole('alert')` tout
     * court : en développement, Next injecte lui-même un élément `alert`
     * portant le titre du document, et le `Toaster` de Sonner monte une région
     * vide. Compter les `alert` revenait à échouer sur du décor.
     */
    await expect(
      page.getByRole('heading', {
        name: /Serveur injoignable|Chargement impossible|Le serveur CPI a rencontré une erreur|Accès refusé/,
      }),
    ).toHaveCount(0);
  }
});
