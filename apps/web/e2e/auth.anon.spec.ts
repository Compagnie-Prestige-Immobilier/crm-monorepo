import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Parcours partant d'un navigateur VIERGE : connexion, déconnexion, refus.
 *
 * Ils tournent dans le projet `chromium-anonyme`, sans l'état de session
 * partagé, c'est précisément la pose et l'effacement des cookies qu'ils
 * vérifient.
 */

const IDENTIFIER = process.env.E2E_ADMIN_IDENTIFIER ?? 'admin@cpi.sn';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMoiEnProd2026';

async function login(page: Page): Promise<void> {
  await page.goto('/connexion');
  await page.getByLabel('E-mail ou identifiant').fill(IDENTIFIER);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/espaces');
}

test('l’écran de connexion ne présente aucune violation axe', async ({ page }) => {
  await page.goto('/connexion');
  await expect(page.getByRole('heading', { name: 'Connexion', level: 1 })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations)).toEqual([]);
});

test('la connexion pose une session utilisable et mène au hub des espaces', async ({ page }) => {
  await login(page);

  // Rendu PAR LE SERVEUR avec la session : si le layout avait renvoyé vers
  // /connexion, ce titre serait absent.
  await expect(page.getByRole('heading', { name: 'Choisissez un espace', level: 1 })).toBeVisible();

  const cookies = await page.context().cookies();
  expect(cookies.map((cookie) => cookie.name)).toEqual(
    expect.arrayContaining(['cpi_at', 'cpi_rt']),
  );

  // Les quatre tuiles sont OUVERTES à un administrateur, et la session
  // traverse bien la tuile : le titre du document est celui de la PAGE, pas
  // celui de la coquille montée par le layout.
  const tuiles = page.getByRole('main');
  for (const espace of ['Accueil', 'Projet CHUES', 'Projet Grand Public', 'Admin']) {
    await expect(tuiles.getByRole('link', { name: new RegExp(`^${espace}`) })).toBeVisible();
  }

  await tuiles.getByRole('link', { name: /^Projet CHUES/ }).click();
  await page.waitForURL('**/chues/tableau-de-bord');
  await expect(page).toHaveTitle(/Tableau de bord/);
});

test('la déconnexion efface la session et reverrouille le panel', async ({ page }) => {
  await login(page);

  await page.getByRole('button', { name: /Administrateur CPI/ }).click();
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
  await page.waitForURL('**/connexion');

  // Les deux cookies sont partis...
  const names = (await page.context().cookies()).map((cookie) => cookie.name);
  expect(names).not.toContain('cpi_at');
  expect(names).not.toContain('cpi_rt');

  // ...et le panel n'est plus atteignable en tapant l'URL directement.
  await page.goto('/prospects');
  await page.waitForURL('**/connexion**');
});

test('un identifiant refusé ne révèle pas si le compte existe', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByLabel('E-mail ou identifiant').fill('inconnu@cpi.sn');
  await page.getByLabel('Mot de passe').fill('mauvaisMotDePasse');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  // Dans le `<form>` : `getByRole('alert')` seul attraperait aussi le
  // route-announcer de Next, qui annonce le titre à chaque navigation.
  const alert = page.locator('form').getByRole('alert').first();
  await expect(alert).toBeVisible();
  // Message générique : ni « compte inconnu », ni « mot de passe incorrect ».
  await expect(alert).toContainText(/incorrects ou compte non autorisé/i);
  await expect(page).toHaveURL(/\/connexion/);
});
