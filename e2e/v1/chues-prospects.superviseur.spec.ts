import { expect, test } from '@playwright/test';

/**
 * `/chues/prospects` vu par la SUPERVISION (`fixture.superviseur@cpi.sn`).
 * CHU-PRO-03.
 *
 * Aucune donnée créée. La liste est lue telle que la base la rend.
 */
test.use({ storageState: 'v1/.auth/superviseur.json' });

test('CHU-PRO-03 un rôle en lecture seule n’a ni fusion, ni réaffectation, ni suppression', async ({
  page,
}) => {
  await page.goto('/chues/prospects');

  // L'écran a rendu SON contenu : sans cela, l'absence de gestes ne prouverait
  // qu'une page vide (§6.5).
  await expect(page).toHaveTitle(/Prospects/u);
  await expect(page.getByRole('columnheader', { name: 'Nom' })).toBeVisible();

  // Les trois gestes vivent dans le menu de ligne « Actions pour … ». La
  // colonne entière disparaît en lecture seule : aucun menu à ouvrir.
  await expect(
    page.getByRole('button', { name: /^Actions pour /u }),
    'la supervision ne dispose d’aucun geste de ligne',
  ).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Fusionner un doublon…' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Réaffecter' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Supprimer' })).toHaveCount(0);

  // L'export, lui, reste proposé : la supervision rend compte, donc elle sort
  // des chiffres.
  await expect(
    page.getByRole('button', { name: 'Exporter' }),
    'la supervision doit garder l’export',
  ).toBeVisible();
});
