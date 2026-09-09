import { expect, test } from '@playwright/test';

/**
 * `/chues/supervision` porte l'activité NOMINATIVE de tout le plateau : un
 * téléconseiller n'y entre pas. Le refus doit être lisible, et surtout aucune
 * donnée de supervision ne doit avoir été chargée derrière l'écran de refus.
 */

test.use({ storageState: 'e2e/.auth/commercial.json' });

test('CHU-SUP-08 l’écran est refusé à un téléconseiller', async ({ page }) => {
  const charges: string[] = [];
  page.on('response', (response) => {
    const chemin = new URL(response.url()).pathname;
    if (chemin.startsWith('/api/v1/') && response.status() < 400) charges.push(chemin);
  });

  await page.goto('/chues/supervision');

  await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
  const refus = page.getByRole('alert').filter({ hasText: 'Accès refusé' });
  await expect(refus).toContainText('La supervision est réservé à un autre rôle.');
  await expect(refus).toContainText('Téléconseiller');

  await expect(page.getByRole('tab', { name: 'Activité' })).toHaveCount(0);
  expect(
    charges.filter((chemin) => chemin.includes('supervision')),
    'l’écran refusé a tout de même chargé la supervision',
  ).toEqual([]);
});
