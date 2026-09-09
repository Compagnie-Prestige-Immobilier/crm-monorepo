import { expect, test, type Page } from '@playwright/test';

import { BASE_URL, compteDe, MOT_DE_PASSE } from './comptes';

const compte = compteDe('ADMIN');

async function remplir(page: Page, motDePasse: string): Promise<void> {
  await page.getByLabel('E-mail ou identifiant').fill(compte.email);
  await page.getByLabel('Mot de passe').fill(motDePasse);
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
    await expect(page).toHaveURL(/\/connexion(\?next=.*)?$/);
    await expect(page.getByRole('heading', { name: 'Connexion', level: 1 })).toBeVisible();
  });
});

test.describe('parcours 1, limiteur de connexion', () => {
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.31' } });

  test('la onzieme tentative est refusee', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('E-mail ou identifiant').fill(compte.email);
    await page.getByLabel('Mot de passe').fill('MauvaisMotDePasse');

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
