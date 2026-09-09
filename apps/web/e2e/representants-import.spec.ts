import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import { buildXlsx } from './xlsx';

/**
 * Import de masse des représentants : modèle → simulation → application.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Ce que seul un vrai navigateur peut éprouver ici.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les trois temps de cet écran sont exactement les trois choses qu'un test
 * unitaire ne voit pas :
 *
 *  1. le modèle est un TÉLÉCHARGEMENT binaire, produit par l'API à partir des
 *     référentiels du jour, pas une réponse JSON ;
 *  2. le dépôt est un ENVOI MULTIPART qui traverse le relais `/api/v1/*`, donc
 *     le cookie `httpOnly` : un `fetch` simulé ne dirait rien de ce trajet ;
 *  3. la simulation n'écrit RIEN, et c'est la promesse centrale de l'écran.
 *     Elle ne se vérifie qu'en redéposant le même fichier après application et
 *     en constatant que les lignes sont devenues des doublons, ni plus ni
 *     moins.
 *
 * Le classeur est FABRIQUÉ à l'exécution (`e2e/xlsx.ts`), avec un numéro de
 * téléphone neuf à chaque passage. C'est la seule façon que l'étape
 * d'application soit réellement jouée à chaque exécution : le téléphone est la
 * clé de déduplication, et un fichier figé ne produirait que des doublons dès
 * la deuxième fois.
 *
 * L'ordre des parcours compte, d'où `serial` : le second redépose ce que le
 * premier a écrit.
 */

test.describe.configure({ mode: 'serial' });

/** Les quatre premiers octets d'un `.xlsx` : la signature ZIP « PK\x03\x04 ». */
async function readMagic(path: string): Promise<number[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream(path, { start: 0, end: 3 })) {
    chunks.push(chunk as Buffer);
  }
  return [...Buffer.concat(chunks)];
}

/**
 * Un numéro sénégalais valide, neuf à chaque exécution.
 *
 * Préfixe `77` : c'est l'une des plages mobiles que `libphonenumber` reconnaît
 * pour le Sénégal, et le serveur refuserait un numéro fabriqué au hasard. Les
 * sept chiffres suivants viennent de l'horloge : deux exécutions successives
 * ne peuvent pas se marcher dessus.
 */
function freshPhone(stamp: number): string {
  const suffix = String(stamp % 10_000_000).padStart(7, '0');
  // Saisi avec ses espaces, comme dans un vrai classeur : c'est le SERVEUR qui
  // normalise en E.164, et le tester avec un numéro déjà normalisé passerait à
  // côté de ce que fait réellement l'import.
  return `77 ${suffix.slice(0, 3)} ${suffix.slice(3, 5)} ${suffix.slice(5, 7)}`;
}

const STAMP = Date.now();
const FULL_NAME = `Aïssatou E2E${String(STAMP)}`;
const PHONE = freshPhone(STAMP);

/**
 * Le classeur déposé.
 *
 * Ligne 1 : les en-têtes. Ligne 2 : la ligne d'exemple du modèle, que le
 * lecteur de l'API SAUTE (`FIRST_DATA_ROW = 3`) : la garder ici prouve qu'elle
 * n'est pas comptée. Ligne 3 : une fiche valide. Ligne 4 : un numéro
 * inexploitable, pour que le rapport ait quelque chose à rejeter et que le
 * tableau des lignes en erreur soit réellement rendu.
 */
function workbook(): Buffer {
  return buildXlsx('Représentants', [
    ['Nom complet', 'Téléphone', 'Département', 'IEF', 'Notes'],
    ['Fatou Ndiaye', '77 123 45 67', 'Dakar', 'Almadies', 'Ligne d’exemple, ignorée'],
    [FULL_NAME, PHONE, 'Dakar', 'Almadies', 'Déposé par la suite E2E'],
    [`Mauvais numéro E2E${String(STAMP)}`, 'pas-un-numero', 'Dakar', '', ''],
  ]);
}

/**
 * Dépose le classeur et attend que le rapport soit rendu.
 *
 * On vise `input[type="file"]` et non son libellé : le libellé de la zone de
 * dépôt affiche le NOM DU FICHIER dès le premier dépôt, si bien qu'un
 * `getByLabel` figé casserait au second. Le champ, lui, ne bouge pas.
 */
async function deposit(page: Page): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'representants-e2e.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook(),
  });
  await expect(page.getByText('Lignes lues', { exact: true })).toBeVisible({ timeout: 30_000 });
}

/**
 * Le chiffre d'un cadran du rapport.
 *
 * Les quatre cadrans forment une liste de définitions : `<dt>` porte
 * l'intitulé, `<dd>` la valeur. On les apparie par POSITION, seule relation
 * que la sémantique d'une `<dl>` garantisse : viser la valeur par sa classe
 * casserait au premier changement de style, et remonter au bloc parent
 * dépendrait de la profondeur du balisage.
 */
async function figure(page: Page, label: string): Promise<number> {
  const labels = await page.getByRole('term').allTextContents();
  const index = labels.findIndex((text) => text.trim() === label);
  expect(index, `Le cadran « ${label} » ne figure pas dans le rapport.`).toBeGreaterThanOrEqual(0);

  const value = await page.getByRole('definition').nth(index).textContent();
  return Number((value ?? '').replace(/[^\d]/gu, ''));
}

test('le modèle se télécharge, et c’est un vrai classeur', async ({ page }) => {
  await page.goto('/representants/import');
  await expect(page.getByRole('heading', { name: 'Représentants', level: 1 })).toBeVisible();
  await expect(page.getByText('Partir du modèle')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Télécharger le modèle Excel' }).click(),
  ]);

  // Le nom décide si le système propose Excel ou ouvre le fichier dans le
  // navigateur.
  expect(download.suggestedFilename()).toBe('cpi-representants-modele.xlsx');

  const path = await download.path();
  expect((await stat(path)).size).toBeGreaterThan(1_000);
  // Un VRAI classeur, pas un JSON d'erreur renommé : un 502 relayé tel quel
  // passerait toutes les assertions précédentes sauf celle-ci.
  expect(await readMagic(path)).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

test('la simulation chiffre le fichier et n’écrit rien, puis l’application crée la fiche', async ({
  page,
}) => {
  await page.goto('/representants/import');
  await deposit(page);

  // ─── Simulation ───────────────────────────────────────────────────────────
  // Deux lignes lues et non trois : la ligne d'exemple du modèle est sautée.
  expect(await figure(page, 'Lignes lues')).toBe(2);
  expect(await figure(page, 'Valides')).toBe(1);
  expect(await figure(page, 'En erreur')).toBe(1);
  expect(await figure(page, 'Doublons')).toBe(0);

  // Le motif est NOMMÉ et rattaché à une ligne DU CLASSEUR : « 1 erreur » sans
  // numéro obligerait à relire quatre mille lignes à la main.
  const rejected = page.getByRole('row').filter({ hasText: 'Numéro de téléphone inexploitable' });
  await expect(rejected).toHaveCount(1);
  await expect(rejected).toContainText('4');

  // L'aperçu montre le téléphone NORMALISÉ par le serveur : c'est la seule
  // façon de vérifier que « 77 900 12 34 » et « +221779001234 » désignent bien
  // la même personne avant d'écrire quoi que ce soit.
  await expect(page.getByRole('row').filter({ hasText: FULL_NAME })).toHaveCount(1);

  // RIEN N'EST ÉCRIT : la simulation ne rend pas le panneau de confirmation.
  await expect(page.getByText(/fiche(s)? créée/)).toHaveCount(0);

  // ─── Application ──────────────────────────────────────────────────────────
  const apply = page.getByRole('button', { name: 'Créer 1 représentant' });
  await expect(apply).toBeEnabled();
  await apply.click();

  await expect(page.getByText('1 fiche créée.')).toBeVisible({ timeout: 60_000 });
  // L'écran repart d'un état net, sans recharger : le bouton d'application a
  // laissé place à celui d'un nouveau dépôt.
  await expect(page.getByRole('button', { name: 'Importer un autre fichier' })).toBeVisible();

  // ─── La fiche existe vraiment ─────────────────────────────────────────────
  await page.goto('/representants');
  await page.getByLabel('Recherche').fill(FULL_NAME);
  await expect(page.getByRole('button', { name: `Modifier la fiche de ${FULL_NAME}` })).toBeVisible(
    { timeout: 30_000 },
  );
});

test('redéposer le même classeur ne crée pas de second exemplaire', async ({ page }) => {
  await page.goto('/representants/import');
  await deposit(page);

  /**
   * C'est ici que la promesse « la simulation n'écrit rien » devient
   * vérifiable, et pas seulement affirmée : la ligne valide du parcours
   * précédent est maintenant EN BASE, donc comptée en doublon. Si la
   * simulation avait écrit, ce chiffre serait déjà apparu la première fois.
   *
   * La déduplication porte sur le TÉLÉPHONE, pas sur le nom : c'est ce qui
   * évite qu'un import répété rattache des prospects à deux fiches jumelles.
   */
  expect(await figure(page, 'Lignes lues')).toBe(2);
  expect(await figure(page, 'Valides')).toBe(0);
  expect(await figure(page, 'Doublons')).toBe(1);

  await expect(
    page.getByRole('row').filter({ hasText: 'Un représentant porte déjà ce numéro en base' }),
  ).toHaveCount(1);

  // Rien à appliquer : le bouton reste visible mais inerte, plutôt que de
  // disparaître et laisser croire à un écran cassé.
  await expect(page.getByRole('button', { name: 'Créer 0 représentant' })).toBeDisabled();
});
