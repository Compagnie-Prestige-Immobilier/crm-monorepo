import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import { effacerFiches, marque, semerProspect, type FicheSemee } from './donnees-chues';

const admin = compteDe('ADMIN');
const teleconseiller = compteDe('COMMERCIAL');

// Le serveur de parcours n'a aucune clé de modèle : chaque question reçoit le
// refus 503, qui doit se lire en français dans la conversation.
const REFUS = /pas de clé Groq ni Gemini|ne répond pas pour le moment/;

test.describe('assistant', () => {
  test.describe('administrateur', () => {
    test.use({ storageState: admin.etat });
    let fiche: FicheSemee;

    test.beforeAll(async () => {
      await avecBase(async (client) => {
        await client.query(`DELETE FROM "assistant_questions" WHERE "userId" = $1`, [admin.id]);
        await client.query(
          `INSERT INTO "assistant_questions" (id, "userId", libelle, question, epinglee)
           VALUES ($1, $2, 'Appels du mois', 'Combien d''appels ce mois-ci ?', true)`,
          [randomUUID(), admin.id],
        );
        fiche = await semerProspect(client, `Résumé ${marque()}`, 'Awa', admin.id);
      });
    });

    test.afterAll(async () => {
      await effacerFiches([fiche.phoneE164]);
    });

    test('la bulle propose des questions et dit en français pourquoi elle ne répond pas', async ({
      page,
    }) => {
      await page.goto('/teleconseil/tableau-de-bord');
      await page.getByRole('button', { name: 'Ouvrir l’assistant' }).click();
      const fenetre = page.getByRole('dialog', { name: 'Assistant' });
      await expect(fenetre).toBeVisible();

      await fenetre.getByRole('button', { name: "Combien d'appels hier ?" }).click();
      await expect(fenetre.getByRole('alert')).toContainText(REFUS);

      await page.keyboard.press('Escape');
      await expect(fenetre).toBeHidden();
      await page.keyboard.press('Control+k');
      await expect(fenetre.getByRole('alert')).toContainText(REFUS);
    });

    test('la question épinglée du tableau de bord ouvre la bulle et se pose', async ({ page }) => {
      await page.goto('/teleconseil/tableau-de-bord');
      await page
        .getByRole('region', { name: 'Questions épinglées' })
        .getByRole('button', { name: 'Appels du mois' })
        .click();

      const fenetre = page.getByRole('dialog', { name: 'Assistant' });
      await expect(fenetre.getByText("Combien d'appels ce mois-ci ?")).toBeVisible();
      await expect(fenetre.getByRole('alert')).toContainText(REFUS);
    });

    test('la bulle se retire pendant une consignation d’appel', async ({ page }) => {
      await page.goto(`/teleconseil/console?fiche=${fiche.id}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('button', { name: /assistant/ })).toHaveCount(0);
    });

    test('le résumé de fiche se calcule sans modèle', async ({ page }) => {
      await page.goto(`/teleconseil/prospects/${fiche.id}`);
      await page.getByRole('button', { name: 'Résumer cette fiche' }).click();

      const resume = page.locator('details', { hasText: 'Résumé de la fiche' });
      await expect(resume.getByText('résumé calculé')).toBeVisible();
      await expect(resume.getByRole('listitem')).toHaveCount(3);
    });
  });

  test.describe('téléconseiller', () => {
    test.use({ storageState: teleconseiller.etat });

    test('l’assistant ne lui est ni proposé ni accessible', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('link', { name: 'Assistant' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Ouvrir l’assistant' })).toHaveCount(0);

      await page.goto('/admin/assistant');
      await expect(page.getByLabel('Votre question')).toHaveCount(0);
    });
  });
});
