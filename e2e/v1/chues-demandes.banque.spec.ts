import { expect, test } from '@playwright/test';

/**
 * Demandes de création de client, côté banque.
 *
 * `workspaces.spec.ts` couvre le parcours qui aboutit : dépôt, approbation,
 * prospect créé. Ce fichier éprouve les deux branches qu'il laisse de côté —
 * le dépôt refusé faute de numéro, et le refus motivé — plus la séparation des
 * titres entre les deux rôles.
 *
 * Une demande de création ne se supprime pas : aucune route ne l'efface. Le
 * nom porte donc un identifiant d'exécution, pour que la centième relance
 * trouve toujours UNE carte et non cent.
 */

test.describe.configure({ mode: 'serial' });
test.use({ storageState: 'v1/.auth/banque.json' });

const RUN = String(Date.now()).slice(-8);
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:4000';

/**
 * Le dialogue de dépôt répartit le terme cherché entre « nom » et
 * « téléphone » selon sa proportion de chiffres : le préfixe reste donc le
 * PRÉNOM, premier mot du terme, et le nom porte le reste.
 */
const PRENOM = 'E2E-CHUES-DMC';
const NOM_INCOMPLET = 'Incomplet';
const NOM_REFUS = `Refus${RUN}`;

/** Plage réservée à ce fichier : `+221 78 100 49 01` à `49 09`. */
const TELEPHONE_REFUS = '78 100 49 01';
const TELEPHONE_JAMAIS_ENVOYE = '78 100 49 09';

const MOTIF = `Numéro à revérifier avec l’agence. E2E-CHUES-DMC ${RUN}`;

test('CHU-DMC-01 · la banque et l’administration ne lisent pas le même titre', async ({
  page,
  browser,
}) => {
  await page.goto('/chues/demandes-clients');
  await expect(
    page.getByRole('heading', { name: 'Mes demandes de création', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Créations de client à valider', level: 1 }),
  ).toHaveCount(0);

  // Second contexte, aucune connexion de plus : l'état ADMIN est déjà sur
  // disque, posé une fois pour toute la suite par le projet `setup`.
  const adminContext = await browser.newContext({
    baseURL: WEB_URL,
    storageState: 'v1/.auth/admin.json',
  });
  try {
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/chues/demandes-clients');
    await expect(
      adminPage.getByRole('heading', { name: 'Créations de client à valider', level: 1 }),
    ).toBeVisible();
    await expect(
      adminPage.getByRole('heading', { name: 'Mes demandes de création', level: 1 }),
    ).toHaveCount(0);
  } finally {
    await adminContext.close();
  }
});

test('CHU-DMC-03 · une demande sans téléphone ne peut pas partir', async ({ page }) => {
  await page.goto('/chues/dossiers/nouveau');
  await page.getByLabel('Rechercher un client').fill(`${PRENOM} ${NOM_INCOMPLET}`);

  await expect(page.getByText('Aucun client ne correspond.')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Demander la création du client' }).click();

  const depot = page.getByRole('dialog');
  await expect(depot.getByLabel(/^Prénom/)).toHaveValue(PRENOM);
  await expect(depot.getByLabel(/^Nom/)).toHaveValue(NOM_INCOMPLET);
  // La recherche ne portait aucun chiffre : le champ clé est vide, et c'est
  // exactement l'état que le dépôt doit refuser.
  await expect(depot.getByLabel(/^Téléphone/)).toHaveValue('');

  await depot.getByRole('combobox', { name: /Banque demandeuse/ }).click();
  await page.getByRole('option', { name: /^CBAO/ }).click();

  const envoyer = depot.getByRole('button', { name: 'Envoyer la demande' });
  await expect(envoyer).toBeDisabled();

  // Le téléphone est bien le SEUL verrou restant : renseigné l'envoi s'ouvre,
  // effacé il se referme. Sans cet aller-retour, un bouton désactivé pour une
  // tout autre raison ferait passer ce scénario.
  await depot.getByLabel(/^Téléphone/).fill(TELEPHONE_JAMAIS_ENVOYE);
  await expect(envoyer).toBeEnabled();
  await depot.getByLabel(/^Téléphone/).fill('');
  await expect(envoyer).toBeDisabled();

  await depot.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/chues/demandes-clients?statut=tous');
  await page.getByLabel('Recherche').fill(NOM_INCOMPLET);
  await expect(page).toHaveURL(new RegExp(`search=${NOM_INCOMPLET}`));

  await expect(
    page.getByRole('main').getByRole('listitem').filter({ hasText: NOM_INCOMPLET }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Aucune demande ne correspond à ces filtres', level: 2 }),
  ).toBeVisible();
});

test('CHU-DMC-04 · le refus porte son motif jusqu’à la banque', async ({ page, browser }) => {
  await page.goto('/chues/dossiers/nouveau');
  await page.getByLabel('Rechercher un client').fill(`${PRENOM} ${NOM_REFUS}`);

  await expect(page.getByText('Aucun client ne correspond.')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Demander la création du client' }).click();

  const depot = page.getByRole('dialog');
  await depot.getByLabel(/^Téléphone/).fill(TELEPHONE_REFUS);
  await depot.getByRole('combobox', { name: /Banque demandeuse/ }).click();
  await page.getByRole('option', { name: /^CBAO/ }).click();
  await depot.getByRole('button', { name: 'Envoyer la demande' }).click();

  await expect(depot).toContainText(`${PRENOM} ${NOM_REFUS} est en attente d’approbation.`, {
    timeout: 30_000,
  });
  // Deux boutons portent ce nom une fois la demande partie : l'action du pied
  // de page et la croix de l'en-tête.
  await depot
    .locator('[data-slot="dialog-footer"]')
    .getByRole('button', { name: 'Fermer' })
    .click();

  const adminContext = await browser.newContext({
    baseURL: WEB_URL,
    storageState: 'v1/.auth/admin.json',
  });
  try {
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/chues/demandes-clients');

    const carte = adminPage.getByRole('main').getByRole('listitem').filter({ hasText: NOM_REFUS });
    await expect(carte).toBeVisible({ timeout: 30_000 });
    await carte.getByRole('button', { name: 'Refuser' }).click();

    const refus = adminPage.getByRole('dialog', { name: 'Refuser la demande' });
    const confirmer = refus.getByRole('button', { name: 'Refuser la demande' });
    // Un refus muet renverrait l'agent à son impasse : sans motif, rien ne part.
    await expect(confirmer).toBeDisabled();

    await refus.getByLabel(/^Motif du refus/).fill(MOTIF);
    await expect(confirmer).toBeEnabled();
    await confirmer.click();
    await expect(adminPage.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });
  } finally {
    await adminContext.close();
  }

  await page.goto('/chues/demandes-clients');
  await page.getByRole('button', { name: 'Refusées' }).click();
  await expect(page).toHaveURL(/statut=REJECTED/);

  const suivi = page.getByRole('main').getByRole('listitem').filter({ hasText: NOM_REFUS });
  await expect(suivi).toContainText(`Refusée : ${MOTIF}`, { timeout: 30_000 });
  // L'arbitrage n'est pas le sien : la carte ne lui propose aucun des deux
  // gestes, même sur une demande qu'il a lui-même déposée.
  await expect(suivi.getByRole('button', { name: 'Approuver et créer le prospect' })).toHaveCount(
    0,
  );
  await expect(suivi.getByRole('button', { name: 'Refuser' })).toHaveCount(0);
});
