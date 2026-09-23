import { expect, test } from '@playwright/test';

import { avecBase, compteDe } from './comptes';

const admin = compteDe('ADMIN');
const teleconseiller = compteDe('COMMERCIAL');

// Le parcours ne pose aucune question : la réponse dépend d'un modèle distant.
// Ce qui se prouve ici sans lui : qui entre, et ce que les questions
// enregistrées deviennent entre deux visites.
test.describe('assistant', () => {
  test.beforeAll(async () => {
    await avecBase(async (client) => {
      await client.query(`DELETE FROM "assistant_questions" WHERE "userId" = $1`, [admin.id]);
    });
  });

  test.describe('administrateur', () => {
    test.use({ storageState: admin.etat });

    test('la question enregistrée survit au rechargement puis se supprime', async ({ page }) => {
      await page.goto('/admin/assistant');
      await expect(page.getByRole('heading', { name: 'Assistant', level: 1 })).toBeVisible();

      await page.getByLabel('Votre question').fill('combien d’appels ce mois-ci ?');
      await page.getByRole('button', { name: 'Enregistrer la question' }).click();
      await page.getByLabel('Nom du raccourci').fill('Appels du mois');
      await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();

      const raccourci = page.getByRole('button', { name: 'Appels du mois', exact: true });
      await expect(raccourci).toBeVisible();

      await page.reload();
      await expect(raccourci).toBeVisible();

      await page.getByRole('button', { name: 'Supprimer Appels du mois' }).click();
      await expect(raccourci).toBeHidden();
    });
  });

  test.describe('téléconseiller', () => {
    test.use({ storageState: teleconseiller.etat });

    test('l’assistant ne lui est ni proposé ni accessible', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('link', { name: 'Assistant' })).toHaveCount(0);

      await page.goto('/admin/assistant');
      await expect(page.getByLabel('Votre question')).toHaveCount(0);
    });
  });
});
