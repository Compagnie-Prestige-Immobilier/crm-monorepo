import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import { ecrire, lire, marque } from './donnees-admin';

const administrateur = compteDe('ADMIN');
const cle = marque();
const ADRESSE = `compta.${cle}@example.sn`;
const REGLAGES = `SELECT value FROM app_settings WHERE key = 'courriels.destinataires'`;

interface ReglageLu {
  value: string;
}

let avant: string | null = null;

test.beforeAll(async () => {
  avant = (await lire<ReglageLu>(REGLAGES))[0]?.value ?? null;
});

test.afterAll(async () => {
  if (avant === null) {
    await ecrire(`DELETE FROM app_settings WHERE key = 'courriels.destinataires'`);
    return;
  }
  await ecrire(`UPDATE app_settings SET value = $1 WHERE key = 'courriels.destinataires'`, [avant]);
});

test.describe('parité courriels, réglés par l’administrateur', () => {
  test.use({ storageState: administrateur.etat });

  test('chaque courriel a ses destinataires et un texte à trous, rétabli d’un clic', async ({
    page,
  }) => {
    await page.goto('/admin/courriels');
    const carte = page.getByRole('region', { name: 'Dossier encaissé' });
    // `exact` : le « i » d'aide porte « Aide : Destinataires » en nom accessible.
    await carte.getByLabel('Destinataires', { exact: true }).fill(ADRESSE);
    const intro = carte.getByLabel('Texte d’introduction', { exact: true });
    await intro.fill('Encaissé pour ');
    await carte.getByRole('button', { name: '{montant}' }).click();
    await expect(intro).toHaveValue('Encaissé pour {montant}');

    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Réglages des courriels enregistrés.')).toBeVisible();
    const ecrit = (await lire<ReglageLu>(REGLAGES))[0]?.value ?? '{}';
    expect(JSON.parse(ecrit)).toMatchObject({
      encaissement: { destinataires: [ADRESSE], intro: 'Encaissé pour {montant}' },
    });

    await page.reload();
    const relue = page.getByRole('region', { name: 'Dossier encaissé' });
    const introRelue = relue.getByLabel('Texte d’introduction', { exact: true });
    await expect(introRelue).toHaveValue('Encaissé pour {montant}');
    await relue.getByRole('button', { name: 'Texte d’origine' }).click();
    await expect(introRelue).toHaveValue(/a été encaissé par \{banque\}/u);
  });

  test('les envois se lisent dans Exploitation, pas dans les réglages', async ({ page }) => {
    await page.goto('/admin/courriels');
    await expect(page.getByText('Journal des courriels')).toHaveCount(0);
    await page.goto('/admin/exploitation');
    await page.getByRole('tab', { name: 'Courriels' }).click();
    await expect(page.getByRole('columnheader', { name: 'Envoyé le' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'État' })).toBeVisible();
  });

  test('les paramètres CHUES gardent les messages aux prospects, avec leurs variables', async ({
    page,
  }) => {
    await page.goto('/teleconseil/parametres-chues');
    await expect(page.getByText('Messages envoyés aux prospects')).toBeVisible();
    await expect(page.getByText('Courriels automatiques')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '{prenomNom}' }).first()).toBeVisible();
  });
});
