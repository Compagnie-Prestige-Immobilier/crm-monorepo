import { expect, test } from '@playwright/test';

import { avecBase, compteDe } from './comptes';

const compte = compteDe('SUPERVISEUR');

// Le binaire d'essai vise un GLPI injoignable : le parcours prouve que la
// reception et le suivi tiennent sans lui.
test.describe('signalement au support', () => {
  test.use({ storageState: compte.etat });

  test.beforeAll(async () => {
    await avecBase(async (client) => {
      await client.query(
        `INSERT INTO "support_categories" ("id", "nom") VALUES (1, 'Panne applicative')
         ON CONFLICT ("id") DO UPDATE SET "nom" = EXCLUDED."nom"`,
      );
      await client.query(`DELETE FROM "support_signalements" WHERE "auteurId" = $1`, [compte.id]);
    });
  });

  test('le signalement est recu sans attendre GLPI, et son suivi survit au rechargement', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Signaler un problème' }).click();

    const message = "Le tableau des rappels ne s'ouvre plus";
    await page.getByLabel('Ce qui ne va pas').fill(message);
    await page.getByLabel('Urgence').click();
    await page.getByRole('option', { name: 'Urgence moyenne' }).click();
    await page.getByLabel('Catégorie').click();
    await page.getByRole('option', { name: 'Panne applicative' }).click();

    await page.getByRole('button', { name: 'Envoyer au support' }).click();
    await expect(page.getByRole('heading', { name: 'Signalement reçu.' })).toBeVisible();

    const suivi = page.getByRole('listitem').filter({ hasText: message });
    await expect(suivi).toBeVisible();
    await expect(suivi).toContainText(/Envoi retardé|En cours d'envoi/);

    // Aucun stockage local : le suivi vient du serveur.
    await page.reload();
    await page.getByRole('button', { name: 'Signaler un problème' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: message })).toBeVisible();
  });
});
