import { expect, test as installer } from '@playwright/test';

import { BASE_URL, COMPTES, MOT_DE_PASSE } from './comptes';

for (const compte of COMPTES) {
  installer(`session ${compte.role}`, async ({ browser }) => {
    const contexte = await browser.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { 'X-Forwarded-For': compte.adresse },
    });
    const page = await contexte.newPage();

    await page.goto('/connexion');
    await page.getByLabel('E-mail ou identifiant').fill(compte.email);
    await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByRole('button', { name: `Compte de ${compte.nom}` })).toBeVisible();

    await contexte.storageState({ path: compte.etat });
    await contexte.close();
  });
}
