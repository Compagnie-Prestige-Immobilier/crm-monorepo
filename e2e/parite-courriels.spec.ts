import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import { ecrire, lire, marque } from './donnees-admin';

const administrateur = compteDe('ADMIN');
const cle = marque();
const ADRESSE = `compta.${cle}@example.sn`;
const REGLAGES = `SELECT value FROM app_settings WHERE key = 'courriels.destinataires'`;
const ADHESION = 'chues.destinatairesAdhesion';

interface ReglageLu {
  value: string;
}

let avant: string | null = null;
let adhesionAvant: string | null = null;

test.beforeAll(async () => {
  avant = (await lire<ReglageLu>(REGLAGES))[0]?.value ?? null;
  adhesionAvant =
    (await lire<ReglageLu>(`SELECT value FROM app_settings WHERE key = $1`, [ADHESION]))[0]
      ?.value ?? null;
  await ecrire(`DELETE FROM app_settings WHERE key = $1`, [ADHESION]);
});

test.afterAll(async () => {
  if (adhesionAvant !== null) {
    await ecrire(
      `INSERT INTO app_settings (key, value, "updatedAt") VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [ADHESION, adhesionAvant],
    );
  }
  if (avant === null) {
    await ecrire(`DELETE FROM app_settings WHERE key = 'courriels.destinataires'`);
    return;
  }
  await ecrire(`UPDATE app_settings SET value = $1 WHERE key = 'courriels.destinataires'`, [avant]);
});

test.describe('courriels et messages, réglés sur un seul écran', () => {
  test.use({ storageState: administrateur.etat });

  test('chaque courriel a ses destinataires et un texte à trous, rétabli d’un clic', async ({
    page,
  }) => {
    await page.goto('/admin/courriels');
    const carte = page.getByRole('region', { name: 'Dossier encaissé' });
    await carte.getByLabel('Destinataires', { exact: true }).fill(ADRESSE);
    const intro = carte.getByLabel('Texte d’introduction', { exact: true });
    await intro.fill('Encaissé pour ');
    await carte.getByRole('button', { name: '{montant}' }).click();
    await expect(intro).toHaveValue('Encaissé pour {montant}');

    await carte.getByRole('button', { name: 'Enregistrer' }).click();
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

  test('une liste vide coupe le courriel d’enrôlement, et l’écran le dit', async ({ page }) => {
    await page.goto('/admin/courriels');
    const carte = page.getByRole('region', { name: 'Rendez-vous d’enrôlement' });
    const destinataires = carte.getByLabel('Destinataires', { exact: true });
    const avertissement = carte.getByText('Aucun destinataire : ce courriel ne part pas.');
    await destinataires.fill(ADRESSE);
    await expect(avertissement).toBeHidden();
    await carte.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Réglages des courriels enregistrés.')).toBeVisible();

    await destinataires.fill('');
    await expect(avertissement).toBeVisible();
    await carte.getByRole('button', { name: 'Enregistrer' }).click();
    await expect
      .poll(async () => {
        const ecrit = (await lire<ReglageLu>(REGLAGES))[0]?.value ?? '{}';
        return (JSON.parse(ecrit) as { enrolement?: { destinataires: string[] } }).enrolement;
      })
      .toMatchObject({ destinataires: [] });

    const adhesion = page.getByRole('region', { name: 'Avis d’adhésion' });
    await expect(adhesion.getByText('Aucun destinataire : ce courriel ne part pas.')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Accusé de réception' }).getByRole('button', {
        name: '{prenomNom}',
      }),
    ).toHaveCount(2);
  });

  test('les envois se lisent dans Exploitation, ouverte sur l’onglet Courriels', async ({
    page,
  }) => {
    await page.goto('/admin/courriels');
    await page.getByRole('link', { name: 'Voir les envois' }).click();
    await expect(page.getByRole('tab', { name: 'Courriels', selected: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Envoyé le' })).toBeVisible();
    await expect(page.getByLabel('État', { exact: true })).toBeVisible();
  });

  test('les paramètres CHUES ne gardent que ce qui leur est propre', async ({ page }) => {
    await page.goto('/teleconseil/parametres-chues');
    await expect(page.getByRole('button', { name: '{telephoneTeleconseiller}' })).toBeVisible();
    await expect(page.getByText('Cellule enrôlement')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '{prenomNom}', exact: true })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Motif' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Courriels et messages' })).toBeVisible();
  });
});
