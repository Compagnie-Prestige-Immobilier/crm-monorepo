import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type Page, type Request } from '@playwright/test';

import { buildXlsx } from './xlsx';

/**
 * `/admin/imports` : dépôt de classeurs, modèles, historique. ADM-IMP-01 à 08.
 *
 * Ce que seul un navigateur éprouve ici : le modèle est un TÉLÉCHARGEMENT
 * binaire, le dépôt est un envoi multipart qui traverse le relais `/api/v1/*`
 * porteur du cookie `httpOnly`, et les deux garde-fous du dépôt (extension,
 * taille) vivent dans le navigateur, avant tout réseau. Un test qui simule
 * `fetch` ne dirait rien des trois.
 *
 * L'entité Représentants est délibérément absente : `representants-import.spec.ts`
 * la couvre déjà de bout en bout (§7.5.5).
 *
 * AUCUNE LIGNE N'EST APPLIQUÉE. Les travaux déposés restent en simulation ; ils
 * ne sont pas supprimables, d'où l'horodatage `RUN` dans chaque nom de fichier
 * (§5.1) : deux exécutions ne se voient jamais.
 */

/** Un travail d'import ne se supprime pas : chaque exécution porte son empreinte. */
const RUN = String(Date.now()).slice(-8);

const CLASSEUR = `E2E-ADM-IMP-${RUN}-historique.xlsx`;
const MAUVAISE_EXTENSION = `E2E-ADM-IMP-${RUN}-mauvaise-extension.txt`;
const TROP_GROS = `E2E-ADM-IMP-${RUN}-trop-gros.xlsx`;

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * `+221781002229` : dernier numéro de la plage réservée à cette vague de specs
 * admin (§5.2). Il n'est jamais écrit en base — le classeur reste en
 * simulation — mais un numéro pris ailleurs rendrait la ligne « déjà en base »
 * chez son propriétaire.
 */
const TELEPHONE_SIMULE = '+221781002229';

/**
 * Ligne 1 : en-têtes. Ligne 2 : l'exemple grisé du modèle, que le lecteur saute
 * (`FIRST_DATA_ROW = 3`). Ligne 3 : la seule ligne de données.
 * L'onglet doit répondre à `/prospect/i` (`GRAND_PUBLIC_SHEET_LAYOUT`).
 */
function classeurGrandPublic(): Buffer {
  return buildXlsx('Prospects Grand Public', [
    ['Nom', 'Téléphone'],
    ['Ndiaye', '77 123 45 67'],
    [`E2E-ADM-IMP-${RUN}`, TELEPHONE_SIMULE],
  ]);
}

/** Les quatre premiers octets d'un `.xlsx` : la signature ZIP « PK\x03\x04 ». */
async function readMagic(path: string): Promise<number[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream(path, { start: 0, end: 3 })) {
    chunks.push(chunk as Buffer);
  }
  return [...Buffer.concat(chunks)];
}

/**
 * Enregistre tout envoi vers la famille `/api/v1/imports`.
 *
 * Les quatre entités visent quatre chemins distincts
 * (`/api/v1/imports/prospects`, `…/prospects-grand-public`, `…/representants`,
 * `…/visites`) : viser le seul `/api/v1/imports` laisserait passer trois
 * d'entre eux.
 */
function watchUploads(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request: Request) => {
    const { pathname } = new URL(request.url());
    if (request.method() === 'POST' && pathname.startsWith('/api/v1/imports')) seen.push(pathname);
  });
  return seen;
}

async function ouvrirEcran(page: Page): Promise<void> {
  await page.goto('/admin/imports');
  await expect(page.getByText('Déposer un classeur', { exact: true })).toBeVisible();
}

async function deplierHistorique(page: Page): Promise<void> {
  await page.getByText('Imports précédents', { exact: true }).click();
  await expect(
    page.getByText(
      'Un travail « échu » n’a pas échoué : son classeur et son rapport ont passé leur échéance.',
    ),
  ).toBeVisible();
}

test('ADM-IMP-01 · l’écran se charge et propose ses quatre entités', async ({ page }) => {
  await ouvrirEcran(page);

  await expect(page).toHaveTitle(/Importer un fichier Excel/);
  await expect(
    page.getByText(
      'Le fichier est d’abord simulé. Rien n’est écrit tant que vous n’avez pas confirmé l’application.',
    ),
  ).toBeVisible();

  await page.getByLabel('Entité à importer').click();
  // Une entité qui disparaît de cette liste, c'est un domaine entier qui ne
  // peut plus être importé : l'ordre et le contenu sont donc figés.
  await expect(page.getByRole('option')).toHaveText([
    'Prospects CHUES',
    'Prospects Grand Public',
    'Représentants',
    'Visites',
  ]);
  await page.keyboard.press('Escape');

  await expect(page.getByRole('main').getByRole('heading', { name: 'Erreur serveur' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('main').getByRole('alert').filter({ hasText: 'Réessayer' }),
  ).toHaveCount(0);
});

test('ADM-IMP-02 · le sélecteur d’entité change le texte d’aide', async ({ page }) => {
  await ouvrirEcran(page);

  const aide = page.getByText('lignes au maximum.', { exact: false });
  await expect(aide).toContainText(
    'Banque et Syndicat se choisissent dans les listes déroulantes du modèle',
  );

  await page.getByLabel('Entité à importer').click();
  await page.getByRole('option', { name: 'Prospects Grand Public' }).click();

  // L'aide de l'entité PRÉCÉDENTE laissée en place ferait préparer le classeur
  // au mauvais format : la phrase entière est vérifiée, plafond compris.
  await expect(aide).toContainText(
    'Seuls le nom et le téléphone sont exigés : profession, syndicat, banque, durée du système et canal de provenance peuvent rester vides.',
  );
  // U+202F : le séparateur de milliers de `fr-SN`, pas une espace ordinaire.
  await expect(aide).toContainText('50 000 lignes au maximum.');
  await expect(aide).not.toContainText('Banque et Syndicat se choisissent');
});

test('ADM-IMP-03 · le modèle Grand Public est un vrai classeur', async ({ page }) => {
  await ouvrirEcran(page);

  await page.getByLabel('Entité à importer').click();
  await page.getByRole('option', { name: 'Prospects Grand Public' }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Télécharger le modèle' }).click(),
  ]);

  expect(download.suggestedFilename()).toBe('cpi-prospects-grand-public-modele.xlsx');

  const chemin = await download.path();
  expect((await stat(chemin)).size).toBeGreaterThan(1_000);
  // Un JSON d'erreur relayé sous l'extension `.xlsx` passerait toutes les
  // assertions précédentes : seule la signature binaire le démasque.
  expect(await readMagic(chemin)).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

test('ADM-IMP-04 · un fichier de mauvaise extension ne part pas vers l’API', async ({ page }) => {
  const uploads = watchUploads(page);
  await ouvrirEcran(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: MAUVAISE_EXTENSION,
    mimeType: 'text/plain',
    buffer: Buffer.from('Ceci n’est pas un classeur.'),
  });

  // Deux bornes, aucune attente fixe : le silence réseau prouve qu'aucun envoi
  // n'est en vol, et le rechargement relit l'historique depuis le serveur.
  await page.waitForLoadState('networkidle');
  await ouvrirEcran(page);

  expect(uploads, 'un fichier hors .xlsx ne doit jamais atteindre l’API').toEqual([]);

  await deplierHistorique(page);
  await expect(
    page.getByRole('table').getByRole('row').filter({ hasText: MAUVAISE_EXTENSION }),
    'aucun travail d’import ne doit avoir été créé pour un .txt',
  ).toHaveCount(0);
});

test('ADM-IMP-05 · un fichier de plus de 25 Mo est refusé sans quitter le navigateur', async ({
  page,
}) => {
  const uploads = watchUploads(page);
  await ouvrirEcran(page);

  const dossier = await mkdtemp(join(tmpdir(), 'e2e-adm-imp-'));
  const chemin = join(dossier, TROP_GROS);
  // 26 Mo : un mégaoctet au-dessus du plafond de `MAX_FILE_BYTES`.
  await writeFile(chemin, Buffer.alloc(26 * 1024 * 1024));

  await page.locator('input[type="file"]').setInputFiles(chemin);

  // Le libellé exact du toast, et non `getByRole('status')` : le `<li>` de
  // Sonner ne porte aucun rôle, et la seule région `status` de cet écran est
  // l'avancement du travail d'import.
  await expect(
    page.getByText('Fichier trop volumineux : 25 Mo au maximum.', { exact: true }),
  ).toBeVisible();
  // Le refus vient du navigateur : la bande passante n'est pas dépensée pour
  // se faire dire non par le serveur.
  expect(uploads, 'un fichier de plus de 25 Mo ne doit pas être envoyé').toEqual([]);

  await rm(dossier, { recursive: true, force: true });
});

test('ADM-IMP-06 · l’historique liste le travail qui vient d’être déposé', async ({ page }) => {
  await ouvrirEcran(page);

  await page.getByLabel('Entité à importer').click();
  await page.getByRole('option', { name: 'Prospects Grand Public' }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: CLASSEUR,
    mimeType: XLSX_MIME,
    buffer: classeurGrandPublic(),
  });

  // Le bandeau du travail, visé par son nom de fichier : l'historique replié
  // reste dans le document et porte les mêmes libellés d'état.
  const bandeau = page.locator('[data-slot="card-title"]').filter({ hasText: CLASSEUR });
  // La simulation, et elle seule : rien n'est appliqué dans ce fichier.
  await expect(bandeau).toContainText('Simulation terminée', { timeout: 30_000 });
  await expect(bandeau).toContainText('Simulation');

  await deplierHistorique(page);

  const tableau = page.getByRole('table');
  await expect(tableau.getByRole('columnheader')).toHaveText([
    'Fichier',
    'Entité',
    'État',
    'Créées',
    'Ignorées',
    'Erreurs',
    'Déposé le',
    '',
  ]);

  // Le travail le plus récent est le mien : il porte son entité et son état,
  // pas seulement son nom de fichier.
  const ligne = tableau.getByRole('row').filter({ hasText: CLASSEUR });
  await expect(ligne).toHaveCount(1);
  await expect(ligne).toContainText('Prospects Grand Public');
  await expect(ligne).toContainText('Simulation terminée');
});

test('ADM-IMP-07 · la pagination de l’historique garde sa butée', async ({ page }) => {
  await ouvrirEcran(page);
  await deplierHistorique(page);

  const precedente = page.getByRole('button', { name: 'Page précédente' });
  const suivante = page.getByRole('button', { name: 'Page suivante' });
  const rang = page.getByText(/^\d+ \/ \d+$/);

  await expect(rang).toHaveText(/^1 \/ \d+$/);
  await expect(precedente, 'la première page n’a pas de précédente').toBeDisabled();

  if (await suivante.isDisabled()) {
    // Une seule page servie : la butée haute est gardée elle aussi.
    await expect(rang).toHaveText('1 / 1');
    return;
  }

  const premierFichier = await page
    .getByRole('table')
    .getByRole('row')
    .nth(1)
    .getByRole('cell')
    .first()
    .textContent();

  await suivante.click();

  await expect(rang).toHaveText(/^2 \/ \d+$/);
  await expect(precedente, 'la deuxième page peut revenir en arrière').toBeEnabled();
  // Les lignes servies ont réellement changé : un compteur qui avance sur les
  // mêmes lignes ne pagine rien.
  await expect(
    page.getByRole('table').getByRole('row').nth(1).getByRole('cell').first(),
  ).not.toHaveText(premierFichier ?? '');
});

test('ADM-IMP-08 · un historique en panne ne fait pas tomber le dépôt', async ({ page }) => {
  // Le prédicat vise le chemin EXACT : un motif glob attraperait aussi
  // `/api/v1/imports/prospects-grand-public`, et le dépôt tomberait avec.
  await page.route(
    (url) => url.pathname === '/api/v1/imports',
    (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );

  await ouvrirEcran(page);
  await deplierHistorique(page);

  const panne = page.getByRole('alert').filter({ hasText: 'Réessayer' });
  await expect(panne).toContainText('Erreur serveur (500). Réessayez.');
  await expect(panne.getByRole('button', { name: 'Réessayer' })).toBeVisible();

  // Le reste de l'écran vit : le bloc en panne est le seul à tomber.
  await expect(page.getByText('Déposer un classeur', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Entité à importer')).toBeEnabled();
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Télécharger le modèle' })).toBeEnabled();
});
