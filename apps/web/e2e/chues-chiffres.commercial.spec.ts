import { expect, test } from '@playwright/test';

/**
 * `/chues/statistiques` est fermé au téléconseiller : il n'a aucune raison de
 * lire l'activité de ses collègues.
 *
 * Deux assertions, jamais une : le refus doit être LISIBLE, et aucune donnée
 * métier ne doit avoir été chargée derrière. C'est la seconde qui distingue
 * « l'écran refuse » de « l'écran charge tout puis pose un refus par-dessus ».
 */

test.use({ storageState: 'e2e/.auth/commercial.json' });

const FAMILLES_DE_L_ECRAN = ['/api/v1/supervision/', '/api/v1/tableaux-de-bord/', '/api/v1/analytics/'];

test('CHU-CHF-03 · l’écran est refusé à un téléconseiller', async ({ page }) => {
  const chargees: string[] = [];
  page.on('response', (response) => {
    const chemin = new URL(response.url()).pathname;
    if (chemin.startsWith('/api/v1/') && response.status() < 400) chargees.push(chemin);
  });

  await page.goto('/chues/statistiques');

  await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();

  const refus = page.getByRole('alert').filter({ hasText: 'réservé à un autre rôle' });
  await expect(refus).toContainText('Les chiffres du projet CHUES est réservé à un autre rôle.');
  await expect(refus).toContainText('Téléconseiller');
  await expect(refus.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute(
    'href',
    '/espaces',
  );

  const fuites = chargees.filter((chemin) =>
    FAMILLES_DE_L_ECRAN.some((famille) => chemin.startsWith(famille)),
  );
  expect(fuites, 'un écran refusé ne charge aucune donnée de cet écran').toEqual([]);
});
