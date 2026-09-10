import { expect, test } from '@playwright/test';

/**
 * « Proposer par défaut » : le seul geste de la barre d'édition qui sort du
 * compte courant. Il fixe la disposition de TOUS les comptes qui n'en ont pas
 * enregistré, donc ce parcours prouve sa présence et sa confirmation — et NE LA
 * CONFIRME JAMAIS. Aucun `PUT …/disposition/par-defaut` ne part d'ici.
 *
 * Aucune donnée n'est laissée : le mode est ouvert puis quitté sans
 * modification, ce qui n'écrit rien.
 */

test.use({ storageState: 'v1/.auth/admin.json' });

const DISPOSITION = '/api/v1/tableaux-de-bord/chues/disposition';

test('CHU-DSP-02 · « Proposer par défaut » n’existe que pour l’ADMIN et demande confirmation', async ({
  page,
}) => {
  const parDefaut: string[] = [];
  page.on('request', (requete) => {
    if (requete.url().includes(`${DISPOSITION}/par-defaut`)) parDefaut.push(requete.method());
  });

  const disposition = page.waitForResponse(
    (reponse) =>
      reponse.url().includes(DISPOSITION) &&
      reponse.request().method() === 'GET' &&
      reponse.status() === 200,
  );
  await page.goto('/chues/statistiques');
  await disposition;

  await page.getByRole('button', { name: 'Composer l’écran' }).click();
  await expect(page.getByText('Mode organisation')).toBeVisible();

  await page.getByRole('button', { name: 'Proposer par défaut' }).click();

  const confirmation = page.getByRole('dialog');
  await expect(confirmation.getByText('Fixer la disposition par défaut')).toBeVisible();
  await expect(confirmation).toContainText(
    'Les comptes qui n’ont rien enregistré verront cette organisation.',
  );
  await expect(confirmation.getByRole('button', { name: 'Proposer par défaut' })).toBeVisible();

  // On ferme SANS confirmer : le geste changerait l'écran de tous les comptes.
  await confirmation.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Quitter' }).click();
  await expect(page.getByRole('button', { name: 'Composer l’écran' })).toBeVisible();

  expect(parDefaut, 'aucun appel ne doit partir vers la disposition par défaut').toEqual([]);
});
