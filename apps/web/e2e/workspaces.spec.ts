import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

/**
 * Parcours de bout en bout des trois surfaces livrées : mode démonstration,
 * campagnes de phase 2, dossiers bancaires.
 *
 * UN SEUL fichier, en `describe.serial`, et c'est nécessaire : ces parcours
 * partagent un ÉTAT DE BASE DE DONNÉES. Les campagnes ont besoin de prospects
 * en attente, les dossiers bancaires de clients dont la méthode d'enrôlement
 * est obtenue — et c'est précisément le mode démonstration qui les crée. Répartis
 * en trois fichiers, Playwright les jouerait dans l'ordre alphabétique, donc
 * les dossiers AVANT l'ensemencement, et la suite échouerait pour une raison
 * qui n'a rien à voir avec le code testé.
 *
 * L'ordre est donc : on ensemence, on éprouve, on nettoie. Le nettoyage final
 * n'est pas une politesse — c'est le dernier parcours à vérifier, celui de la
 * désactivation.
 *
 * La CONNEXION n'est jouée qu'une fois, par `auth.setup.ts`, et son état est
 * relu sur disque : l'API limite les connexions à dix par minute et par IP, et
 * une suite qui se reconnecte par test épuise le quota avant d'avoir rien
 * prouvé.
 */

test.describe.configure({ mode: 'serial' });

/** Les quatre premiers octets d'un `.xlsx` : la signature ZIP « PK\x03\x04 ». */
async function readMagic(path: string, length = 4): Promise<number[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream(path, { start: 0, end: length - 1 })) {
    chunks.push(chunk as Buffer);
  }
  return [...Buffer.concat(chunks)];
}

async function expectNoErrorState(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', {
      name: /Serveur injoignable|Chargement impossible|Le serveur CPI a rencontré une erreur|Accès refusé/,
    }),
  ).toHaveCount(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Mode démonstration — activation
// ─────────────────────────────────────────────────────────────────────────────

test('le mode démonstration s’active et pose un bandeau sur tous les écrans', async ({ page }) => {
  await page.goto('/parametres');
  await expect(page.getByRole('heading', { name: 'Paramètres', level: 1 })).toBeVisible();

  const enable = page.getByRole('button', { name: 'Activer le mode démonstration' });
  const disable = page.getByRole('button', {
    name: 'Retirer les données de démonstration',
  });

  // Idempotent côté API : si un jeu traîne d'une exécution précédente, on part
  // de l'état propre plutôt que d'échouer sur une précondition.
  if (await disable.isVisible().catch(() => false)) {
    await disable.click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
    await expect(enable).toBeVisible({ timeout: 60_000 });
  }

  await expect(enable).toBeVisible();
  await enable.click();

  // Le succès n'est PAS annoncé avant la réponse du serveur : le bouton part en
  // état occupé, et c'est l'apparition du bouton inverse qui prouve que
  // l'opération a abouti.
  await expect(disable).toBeVisible({ timeout: 90_000 });

  // Le bandeau global est rendu par le layout SERVEUR : il doit apparaître sans
  // que l'utilisateur recharge, et sur un écran qui n'est pas celui de la
  // bascule.
  const banner = page.getByRole('status').filter({ hasText: 'Mode démonstration actif' });
  await expect(banner).toBeVisible();

  await page.goto('/prospects');
  await expect(
    page.getByRole('status').filter({ hasText: 'Mode démonstration actif' }),
  ).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Prospects — surface de phase 2 et double export
// ─────────────────────────────────────────────────────────────────────────────

test('les filtres de phase 2 vivent dans l’URL et survivent au rechargement', async ({ page }) => {
  await page.goto('/prospects');
  await expect(page.getByRole('table')).toBeVisible();

  const countLine = page.getByRole('status').filter({ hasText: 'Prospects affichés' });
  await expect(countLine).not.toHaveText('');

  await page.getByRole('button', { name: 'Filtres avancés' }).click();
  await page.getByRole('combobox', { name: 'Statut phase 2' }).click();
  await page.getByRole('option', { name: 'Méthode obtenue' }).click();
  await expect(page).toHaveURL(/phase2Status=METHOD_OBTAINED/);

  await page.getByRole('combobox', { name: 'Segment BDD' }).click();
  await page.getByRole('option', { name: /^BDD1/ }).click();
  await expect(page).toHaveURL(/segment=BDD1/);

  const filtered = (await countLine.textContent())?.trim() ?? '';

  // L'URL EST l'état : un rechargement complet doit rendre le même écran.
  await page.reload();
  await expect(page).toHaveURL(/phase2Status=METHOD_OBTAINED/);
  await expect(page).toHaveURL(/segment=BDD1/);
  await expect(page.getByRole('status').filter({ hasText: 'Prospects affichés' })).toHaveText(
    filtered,
  );

  // Les colonnes de phase 2 sont bien là — c'est ce qui évitait d'ouvrir
  // l'export pour savoir qui a obtenu le résultat et quand.
  for (const header of ['Segment', 'Phase 2', 'Méthode', 'Dernier appel', 'Obtenu par']) {
    await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
  }
});

test('le menu d’export produit les DEUX classeurs', async ({ page }) => {
  await page.goto('/prospects?segment=BDD1');
  await expect(page.getByRole('table')).toBeVisible();

  // ─── Vue filtrée ─────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Exporter' }).click();
  const [filteredDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Exporter la vue filtrée/ }).click(),
  ]);
  expect(filteredDownload.suggestedFilename()).toMatch(/^cpi-prospects-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const filteredPath = await filteredDownload.path();
  expect((await stat(filteredPath)).size).toBeGreaterThan(1_000);
  // Un VRAI classeur, pas un JSON d'erreur renommé.
  expect(await readMagic(filteredPath)).toEqual([0x50, 0x4b, 0x03, 0x04]);

  // ─── Classeur consolidé ──────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Exporter' }).click();
  const [consolidated] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Classeur consolidé/ }).click(),
  ]);
  expect(consolidated.suggestedFilename()).toMatch(
    /^cpi-prospects-consolide-\d{4}-\d{2}-\d{2}\.xlsx$/,
  );
  const consolidatedPath = await consolidated.path();
  expect((await stat(consolidatedPath)).size).toBeGreaterThan(1_000);
  expect(await readMagic(consolidatedPath)).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Phase 2 — campagne, aperçu, programme PDF, clôture
// ─────────────────────────────────────────────────────────────────────────────

test('création d’une campagne : l’aperçu chiffre AVANT la confirmation', async ({ page }) => {
  await page.goto('/campagnes');
  await expect(page.getByRole('heading', { name: 'Campagnes', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Nouvelle campagne' }).first().click();

  const name = `E2E ${String(Date.now())}`;
  await page.getByLabel('Nom de la campagne').fill(name);

  // Périmètre BDD1 : plus étroit que « Toutes bases », donc le décompte se
  // distingue franchement du total.
  await page.getByRole('radio', { name: /^BDD1/ }).check();

  // Deux commerciaux : le tourniquet doit répartir, pas tout donner au premier.
  const commerciaux = page.getByRole('checkbox');
  await commerciaux.nth(0).check();
  await commerciaux.nth(1).check();

  await page.getByRole('button', { name: 'Voir l’aperçu' }).click();

  // LE point de cet écran : le nombre est affiché, et il l'est avant que le
  // bouton de confirmation ne soit actionnable.
  const preview = page.getByRole('status').filter({ hasText: /Maximum à distribuer/i });
  await expect(preview).toBeVisible({ timeout: 30_000 });
  const previewText = (await preview.textContent()) ?? '';
  const shown = Number(
    (/(\d[\d   ]*)\s*prospects/u.exec(previewText)?.[1] ?? '0').replace(/[^\d]/gu, ''),
  );
  expect(shown).toBeGreaterThan(0);

  // La répartition nominative est visible elle aussi : « 800 » ne dit pas si
  // c'est 800 chacun ou 800 en tout.
  await expect(page.getByRole('heading', { name: 'Répartition en tourniquet' })).toBeVisible();
  const parts = await page.getByText(/\d+ appels$/).allTextContents();
  expect(parts.length).toBe(2);
  const distributed = parts.reduce((sum, part) => sum + Number(part.replace(/[^\d]/gu, '')), 0);
  expect(distributed).toBe(shown);

  await page.getByRole('button', { name: 'Lancer la campagne' }).click();

  // On atterrit sur le détail, et le total tiré correspond à l'aperçu.
  await page.waitForURL(/\/campagnes\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Répartition par commercial' })).toBeVisible();
  await expectNoErrorState(page);
});

test('chaque commercial a son programme PDF téléchargeable', async ({ page }) => {
  await page.goto('/campagnes');
  await page.getByRole('link', { name: /^E2E / }).first().click();
  await page.waitForURL(/\/campagnes\/[0-9a-f-]{36}/);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page
      .getByRole('button', { name: /Programme PDF/ })
      .first()
      .click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^programme-e2e-.*\.pdf$/);
  const path = await download.path();
  expect((await stat(path)).size).toBeGreaterThan(500);
  // « %PDF » : un vrai document, pas un JSON d'erreur relayé en .pdf.
  expect(await readMagic(path, 4)).toEqual([0x25, 0x50, 0x44, 0x46]);
});

test('la clôture annonce les tâches annulées avant de les annuler', async ({ page }) => {
  await page.goto('/campagnes');
  await page.getByRole('link', { name: /^E2E / }).first().click();
  await page.waitForURL(/\/campagnes\/[0-9a-f-]{36}/);

  await page.getByRole('button', { name: 'Clôturer' }).click();

  // La confirmation NOMME la conséquence : sans elle, la clôture se lirait
  // comme un simple archivage, alors qu'elle vide les téléphones.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(/annulée|annulées|figer la campagne/);
  await expect(dialog).toContainText(/tâche|Aucune tâche/);

  await dialog.getByRole('button', { name: 'Clôturer la campagne' }).click();

  await expect(page.getByText('Clôturée', { exact: true })).toBeVisible({ timeout: 30_000 });
  // Une campagne clôturée ne propose plus de clôture.
  await expect(page.getByRole('button', { name: 'Clôturer' })).toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Banque & Finance — cycle complet d'un dossier
// ─────────────────────────────────────────────────────────────────────────────

/** Ouvre un dossier sur le premier client trouvé et rend sa référence. */
async function createCase(page: Page, reference: string): Promise<void> {
  await page.goto('/dossiers/nouveau');
  await expect(page.getByLabel('Rechercher un client')).toBeVisible();

  await page.getByLabel('Rechercher un client').fill('Di');
  const firstResult = page.getByRole('button', { name: /\+221/ }).first();
  await expect(firstResult).toBeVisible({ timeout: 30_000 });
  await firstResult.click();

  // Le résumé compact confirme QUI a été retenu : ouvrir un dossier sur le
  // mauvais homonyme ne se découvre qu'à l'encaissement.
  await expect(page.getByText(/Nom et téléphone sont copiés/)).toBeVisible();

  await page.getByLabel('Référence bancaire').fill(reference);
  await page.getByRole('button', { name: 'Ouvrir le dossier' }).click();
  await page.waitForURL(/\/dossiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
}

test('un dossier peut être mené jusqu’à l’encaissement', async ({ page }) => {
  const reference = `E2E-ENC-${String(Date.now())}`;
  await createCase(page, reference);

  await expect(page.getByText(reference, { exact: true })).toBeVisible();
  await expectNoErrorState(page);

  // Étape 1 → 2. Le libellé du bouton NOMME l'étape cible : « Suivant » ne dit
  // pas où l'on va.
  const advance = page.getByRole('button', { name: /^Passer à/ });
  await expect(advance).toBeVisible();
  await advance.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });

  // Encaissement : le montant est demandé, et l'aperçu formaté doit apparaître
  // AVANT la validation — « 12000000 » et « 1200000 » se distinguent mal.
  const cash = page.getByRole('button', { name: 'Déclarer l’encaissement' });
  await expect(cash).toBeVisible({ timeout: 30_000 });
  await cash.click();

  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'Confirmer l’encaissement' });
  // Sans montant, la confirmation est verrouillée.
  await expect(confirm).toBeDisabled();

  await dialog.getByLabel('Montant encaissé').fill('12400000');
  // Aperçu en direct, en FCFA groupés.
  await expect(dialog.getByRole('status')).toContainText('FCFA');
  await expect(dialog.getByRole('status')).toContainText('400');
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });

  // Le montant est rendu formaté, et le dossier est verrouillé.
  await expect(page.getByText(/12\s*400\s*000 FCFA/u).first()).toBeVisible();
  await expect(page.getByText(/Étape terminale/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rejeter le dossier' })).toHaveCount(0);

  // L'historique conserve la trace des trois transitions.
  await expect(page.getByRole('heading', { name: 'Historique du dossier' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Montant :' })).toHaveCount(1);
});

test('un dossier peut être rejeté, et le rejet annonce « Montant : 0 FCFA »', async ({ page }) => {
  const reference = `E2E-REJ-${String(Date.now())}`;
  await createCase(page, reference);

  await page.getByRole('button', { name: 'Rejeter le dossier' }).click();

  const dialog = page.getByRole('dialog');
  // La phrase qui évite la surprise : un agent qui vient de voir un montant à
  // l'écran croirait sinon que le rejet le conserve.
  await expect(dialog).toContainText('Montant : 0 FCFA');

  const confirm = dialog.getByRole('button', { name: 'Rejeter définitivement' });
  // Sans motif, rien ne part : la statistique des rejets serait aveugle.
  await expect(confirm).toBeDisabled();

  await dialog.getByRole('combobox', { name: 'Motif de rejet' }).click();
  await page.getByRole('option', { name: 'Document manquant' }).click();
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(/Rejeté : Document manquant/)).toBeVisible();
  await expect(page.getByText(/Étape terminale/)).toBeVisible();
});

test('le motif « Autre » exige une précision', async ({ page }) => {
  const reference = `E2E-AUT-${String(Date.now())}`;
  await createCase(page, reference);

  await page.getByRole('button', { name: 'Rejeter le dossier' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Motif de rejet' }).click();
  await page.getByRole('option', { name: 'Autre motif' }).click();

  const confirm = dialog.getByRole('button', { name: 'Rejeter définitivement' });
  await expect(dialog.getByLabel('Précision')).toBeVisible();
  await expect(confirm).toBeDisabled();

  await dialog.getByLabel('Précision').fill('Vérification à mener avec la direction.');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(/Vérification à mener avec la direction/).last()).toBeVisible();
});

test('la référence dupliquée est signalée au flou, avec un lien vers le dossier existant', async ({
  page,
}) => {
  const reference = `E2E-DUP-${String(Date.now())}`;
  await createCase(page, reference);

  // Deuxième dossier, même référence.
  await page.goto('/dossiers/nouveau');
  await page.getByLabel('Rechercher un client').fill('Di');
  await page.getByRole('button', { name: /\+221/ }).first().click();
  await page.getByLabel('Référence bancaire').fill(reference);
  // Le contrôle part au FLOU, pas à chaque frappe.
  await page.getByLabel('Référence bancaire').blur();

  const alert = page.getByRole('alert').filter({ hasText: 'existe déjà' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert.getByRole('link', { name: 'Ouvrir ce dossier' })).toBeVisible();
});

test('la liste, les vues rapides et l’export des dossiers', async ({ page }) => {
  await page.goto('/dossiers');
  await expect(page.getByRole('heading', { name: 'Dossiers', level: 1 })).toBeVisible();

  const countLine = page.getByRole('status').filter({ hasText: 'Dossiers affichés' });
  await expect(countLine).not.toHaveText('');

  await page.getByRole('button', { name: 'Encaissés', exact: true }).click();
  await expect(page).toHaveURL(/stageType=CASHED/);
  await expect(countLine).not.toHaveText('');

  await page.getByRole('button', { name: 'Rejetés', exact: true }).click();
  await expect(page).toHaveURL(/stageType=REJECTED/);

  // L'export suit le filtre affiché : c'est toute la promesse faite à l'agent.
  await page.getByRole('button', { name: 'Exporter' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Classeur des dossiers filtrés/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^cpi-dossiers-bancaires-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const path = await download.path();
  expect(await readMagic(path)).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

test('le tableau de bord bancaire mène à la liste filtrée depuis un graphique', async ({
  page,
}) => {
  await page.goto('/banque');
  await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible();
  await expectNoErrorState(page);

  await expect(page.getByText('Taux de rejet')).toBeVisible();
  await expect(page.getByText('Délai moyen')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dossiers par étape' })).toBeVisible();
  // Les montants sont rendus en FCFA, jamais en nombre brut.
  await expect(page.getByText(/FCFA/).first()).toBeVisible();
});

test('la configuration des étapes se réordonne au clavier, sans glisser-déposer', async ({
  page,
}) => {
  await page.goto('/dossiers/etapes');
  await expect(page.getByRole('heading', { name: 'Étapes bancaires', level: 1 })).toBeVisible();

  // Les boutons NOMMENT l'étape déplacée : « Monter » seul, répété six fois,
  // ne dit pas quoi on déplace.
  await expect(page.getByRole('button', { name: /^Monter « / }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Descendre « / }).first()).toBeVisible();

  // L'étape initiale ne bouge pas : l'API refuserait, autant le dire par un
  // bouton désactivé.
  const initialRow = page.getByRole('listitem').filter({ hasText: 'Étape initiale' });
  await expect(initialRow.getByRole('button', { name: /^Monter/ })).toBeDisabled();

  // Les étapes système ne se désactivent pas.
  await expect(page.getByRole('heading', { name: 'Étapes terminales' })).toBeVisible();
  await expect(page.getByText('Non modifiable').first()).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Mode démonstration — désactivation
// ─────────────────────────────────────────────────────────────────────────────

test('la désactivation exige une confirmation et affirme que le réel est intact', async ({
  page,
}) => {
  await page.goto('/parametres');

  await page.getByRole('button', { name: 'Retirer les données de démonstration' }).click();

  const dialog = page.getByRole('dialog');
  // La phrase qui décide si le bouton sera pressé un jour.
  await expect(dialog).toContainText('Vos données réelles ne sont pas touchées');
  await expect(dialog).toContainText(/enregistré.*identifiant de chaque/s);

  const confirm = dialog.getByRole('button', { name: 'Supprimer définitivement' });
  // Le geste ne part PAS sans confirmation explicite : c'est tout l'objet de
  // cette case à cocher.
  await expect(confirm).toBeDisabled();

  await dialog.getByRole('checkbox').check();
  await expect(confirm).toBeEnabled();
  await confirm.click();

  // Aucun succès n'est annoncé avant la réponse du serveur : c'est l'apparition
  // du bouton d'activation qui prouve l'aboutissement.
  await expect(page.getByRole('button', { name: 'Activer le mode démonstration' })).toBeVisible({
    timeout: 90_000,
  });

  // Et le bandeau global disparaît de tous les écrans.
  await expect(
    page.getByRole('status').filter({ hasText: 'Mode démonstration actif' }),
  ).toHaveCount(0);

  await page.goto('/tableau-de-bord');
  await expect(
    page.getByRole('status').filter({ hasText: 'Mode démonstration actif' }),
  ).toHaveCount(0);
});
