import { expect, test } from '@playwright/test';

import { compteDe, MOT_DE_PASSE } from './comptes';

const compte = compteDe('ADMIN');

test.describe('pannes et erreurs sur la connexion', () => {
  test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.32' } });

  test('hors ligne, le serveur est annonce injoignable', async ({ page, context }) => {
    await page.goto('/connexion');
    await page.getByLabel('E-mail ou identifiant').fill(compte.email);
    await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);

    await context.setOffline(true);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByRole('alert')).toHaveText(
      'Le serveur est injoignable. Vérifiez votre connexion.',
    );
    await context.setOffline(false);
  });

  test('un 500 rend le message francais du serveur', async ({ page }) => {
    await page.route('**/api/v1/auth/login', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'Une erreur interne est survenue.',
        }),
      }),
    );

    await page.goto('/connexion');
    await page.getByLabel('E-mail ou identifiant').fill(compte.email);
    await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByRole('alert')).toHaveText('Une erreur interne est survenue.');
  });
});

test.describe('pannes et erreurs sur le panneau', () => {
  test.use({ storageState: compte.etat });

  test('la session n est pas affichee quand /auth/me est injoignable', async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) => route.abort('connectionrefused'));

    await page.goto('/');

    await expect(page.getByRole('button', { name: `Compte de ${compte.nom}` })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Vos espaces', level: 1 })).toHaveCount(0);
  });
});
