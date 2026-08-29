import { expect, test } from '@playwright/test';

/**
 * L'encadrement lit les numéros suggérés de tout le plateau mais ne les solde
 * pas : `readsOnly(SUPERVISEUR)` retire les trois gestes de chaque carte, et
 * l'API refuserait de toute façon le `PATCH` (`Roles(ADMIN, COMMERCIAL)`).
 *
 * Aucune donnée n'est posée ici (§5.5) et aucune n'est interceptée : la page
 * PRÉCHARGE sa liste côté serveur (`HydrationBoundary`, `staleTime` de 30 s),
 * donc une réponse posée dans le navigateur ne serait jamais lue. Le parcours
 * s'appuie sur les numéros déjà en base — un superviseur les voit tous — et
 * nomme leur absence si la base n'en porte aucun.
 */

test.use({ storageState: 'e2e/.auth/superviseur.json' });

test('CHU-SUG-06 un rôle en lecture seule ne voit aucun geste', async ({ page }) => {
  await page.goto('/chues/suggestions');
  await expect(page).toHaveTitle('Numéros suggérés · CPI GO');

  const cartes = page.getByRole('list', { name: 'Numéros suggérés' }).getByRole('listitem');
  await expect(
    cartes.first(),
    'aucun numéro suggéré en base : une carte sans geste ne prouverait rien',
  ).toBeVisible();

  // Les cartes restent LISIBLES : c'est la lecture qui est autorisée.
  await expect(cartes.first()).toContainText('Donné par le représentant');
  await expect(cartes.first()).toContainText('recueilli par');

  await expect(page.getByRole('button', { name: 'Marquer appelé' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abandonner' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Créer la fiche' })).toHaveCount(0);
});
