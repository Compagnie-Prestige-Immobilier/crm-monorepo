import { expect, test } from '@playwright/test';

/**
 * `/chues/representants` vu par la SUPERVISION (`fixture.superviseur@cpi.sn`).
 * CHU-REP-06.
 *
 * Aucune donnée créée : ce fichier n'a ni préfixe ni plage réservée (§5.5). La
 * liste est lue telle que la base la rend au moment du passage.
 */
test.use({ storageState: 'e2e/.auth/superviseur.json' });

test('CHU-REP-06 un rôle en lecture seule ne voit aucun geste d’écriture', async ({ page }) => {
  await page.goto('/chues/representants');

  // L'écran a bien rendu SON contenu : sans cela, l'absence de boutons ne
  // prouverait qu'une page vide (§6.5).
  await expect(page).toHaveTitle(/Représentants/u);
  await expect(page.getByRole('heading', { level: 1, name: 'Représentants' })).toBeVisible();
  await expect(page.getByRole('table').getByRole('row').first()).toBeVisible();

  await expect(
    page.getByRole('button', { name: /^Modifier la fiche de /u }),
    'la supervision ne modifie aucune fiche : l’API refuserait le geste',
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Nouveau représentant' }),
    'la supervision ne crée aucune fiche',
  ).toHaveCount(0);
});
