import { expect, test } from '@playwright/test';

/**
 * `/chues/statistiques` est fermé à Banque & Finance : ce rôle n'a aucun
 * périmètre commercial dans le projet CHUES.
 *
 * Refus lisible ET absence de chargement : les deux, sinon la cellule
 * d'autorisation ne prouve rien.
 */

test.use({ storageState: 'e2e/.auth/banque.json' });

const FAMILLES_DE_L_ECRAN = ['/api/v1/supervision/', '/api/v1/tableaux-de-bord/', '/api/v1/analytics/'];

test('CHU-CHF-04 · l’écran est refusé à un agent Banque & Finance', async ({ page }) => {
  const chargees: string[] = [];
  page.on('response', (response) => {
    const chemin = new URL(response.url()).pathname;
    if (chemin.startsWith('/api/v1/') && response.status() < 400) chargees.push(chemin);
  });

  await page.goto('/chues/statistiques');

  await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();

  const refus = page.getByRole('alert').filter({ hasText: 'réservé à un autre rôle' });
  await expect(refus).toContainText('Les chiffres du projet CHUES est réservé à un autre rôle.');
  await expect(refus).toContainText('Banque & Finance');
  await expect(refus.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute(
    'href',
    '/espaces',
  );

  const fuites = chargees.filter((chemin) =>
    FAMILLES_DE_L_ECRAN.some((famille) => chemin.startsWith(famille)),
  );
  expect(fuites, 'un écran refusé ne charge aucune donnée de cet écran').toEqual([]);
});
