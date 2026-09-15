import { expect, test, type Page } from '@playwright/test';

import { BASE_URL, compteDe, MOT_DE_PASSE } from './comptes';

const compte = compteDe('ADMIN');
const BASE_DEMO = process.env.DATABASE_URL_DEMO;

async function remplir(page: Page, motDePasse: string): Promise<void> {
  await page.getByLabel('E-mail ou identifiant').fill(compte.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test.describe('parcours 1, connexion et session', () => {
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.30' } });

  test('refus, ouverture, rechargement, fermeture', async ({ page }) => {
    await page.goto('/connexion');

    await remplir(page, 'MauvaisMotDePasse');
    await expect(page.getByRole('alert')).toHaveText('Identifiants invalides.');
    await expect(page).toHaveURL(/\/connexion$/);

    await remplir(page, MOT_DE_PASSE);
    const menuCompte = page.getByRole('button', { name: `Compte de ${compte.nom}` });
    await expect(menuCompte).toBeVisible();

    await page.reload();
    await expect(menuCompte).toBeVisible();

    await menuCompte.click();
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/connexion$/);

    await page.goto('/');
    await expect(page).toHaveURL(/\/connexion(\?suite=.*)?$/);
    await expect(page.getByRole('heading', { name: 'Connexion', level: 1 })).toBeVisible();

    await remplir(page, MOT_DE_PASSE);
    await expect(page.getByRole('button', { name: `Compte de ${compte.nom}` })).toBeVisible();
    await page.context().storageState({ path: compte.etat });
  });
});

test.describe('parcours 1, limiteur de connexion', () => {
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.31' } });

  test('la onzieme tentative est refusee', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('E-mail ou identifiant').fill(compte.email);
    await page.getByLabel('Mot de passe', { exact: true }).fill('MauvaisMotDePasse');

    // Le limiteur est un seau de jetons qui se remplit au fil de la minute : dix
    // tentatives par l'écran, machine chargée, dureraient assez pour en regagner.
    for (let tentative = 1; tentative <= 10; tentative += 1) {
      const refus = await page.request.post('/api/v1/auth/login', {
        data: { identifier: compte.email, password: 'MauvaisMotDePasse' },
        headers: { Origin: BASE_URL },
      });
      expect(refus.status(), `tentative ${String(tentative)}`).toBe(401);
    }

    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Trop de tentatives. Réessayez dans une minute.',
    );
  });
});

test.describe('parcours 1, seconde base', () => {
  test.skip(BASE_DEMO === undefined, 'DATABASE_URL_DEMO absent');
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.32' } });

  test('la base démo propose un profil sans identifiants et le signale', async ({ page }) => {
    await page.goto('/connexion');
    // Le raccourci n'est écouté qu'une fois le formulaire monté, après la lecture de la session.
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
    await page.keyboard.press('Control+Shift+N');
    await page.getByRole('combobox', { name: 'Base' }).click();
    await page.getByRole('option', { name: 'demo' }).click();
    await expect(page.getByLabel('E-mail ou identifiant')).toBeHidden();
    await expect(page.getByLabel('Mot de passe', { exact: true })).toBeHidden();
    await page.getByRole('combobox', { name: 'Profil démo' }).click();
    await page.getByRole('option', { name: 'Téléconseiller' }).click();
    await page.getByRole('button', { name: 'Se connecter' }).click();
    const menuCompte = page.getByRole('button', { name: 'Compte de Awa Fixture' });
    await expect(menuCompte).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('MODE DÉMO · BASE DEMO');

    await menuCompte.click();
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await expect(page.getByRole('combobox', { name: 'Base' })).toContainText('demo');
    await page.getByRole('combobox', { name: 'Base' }).click();
    await page.getByRole('option', { name: 'public' }).click();
    await expect(page.getByLabel('E-mail ou identifiant')).toBeVisible();
  });
});
