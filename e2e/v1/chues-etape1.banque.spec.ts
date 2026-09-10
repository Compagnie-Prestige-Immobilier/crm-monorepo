import { expect, test } from '@playwright/test';

/**
 * CHU-ET1-14. `/chues/appels-representants` est REFUSÉ à Banque & Finance, et
 * le refus doit être LISIBLE — pas un écran qui se rend puis collectionne des
 * 403.
 */
test.use({ storageState: 'v1/.auth/banque.json' });

test('CHU-ET1-14 l’écran est refusé à un agent Banque & Finance', async ({ page }) => {
  // Posé AVANT le `goto` : ce qui compte est qu'aucune donnée de représentant
  // n'ait été chargée, pas seulement que le refus s'affiche par-dessus (§6.5).
  const chargees: string[] = [];
  page.on('response', (response) => {
    const chemin = new URL(response.url()).pathname;
    if (chemin.startsWith('/api/v1/') && response.status() < 400) chargees.push(chemin);
  });

  await page.goto('/chues/appels-representants');

  const refus = page.getByRole('alert').filter({ hasText: 'Accès refusé' });
  await expect(refus.getByRole('heading', { level: 2, name: 'Accès refusé' })).toBeVisible();
  await expect(refus).toContainText('Les appels aux représentants est réservé à un autre rôle.');
  await expect(refus).toContainText('Banque & Finance');
  await expect(refus.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute(
    'href',
    '/espaces',
  );

  expect(
    chargees.filter((chemin) => chemin.startsWith('/api/v1/representants')),
    'aucune donnée de représentant ne doit être chargée derrière un refus',
  ).toEqual([]);
});
