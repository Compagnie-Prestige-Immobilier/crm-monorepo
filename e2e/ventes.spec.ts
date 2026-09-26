import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import { ecrire, numero } from './donnees-admin';
import { apiDe, suffixe } from './donnees-listes';

const client = `CLIENT RETARD ${suffixe().toUpperCase()}`;
const telephone = numero();

test.use({ storageState: compteDe('DIRECTION').etat });

// Trois échéances mensuelles passées sans versement : 300 000 FCFA dus.
test.beforeAll(async () => {
  const api = await apiDe('DIRECTION', '198.51.100.93');
  const reponse = await api.post('/api/v1/ventes', {
    data: {
      canal: 'CPI',
      client,
      telephone,
      dateSouscription: '2025-01-05',
      site: 'NGOLFANIKE',
      nombreLots: 1,
      numerosLots: '',
      superficie: '',
      prixUnitaire: 300_000,
      acompte: 0,
      modePaiement: 'CREDIT',
      nombreEcheances: 3,
      periodiciteMois: 1,
      jourVersement: 10,
      premierVersement: '2025-02-10',
    },
  });
  expect(reponse.status(), await reponse.text()).toBe(201);
  await api.dispose();
});

test.afterAll(async () => {
  await ecrire('DELETE FROM "ventes" WHERE "client" = $1', [client]);
});

test.describe('ventes, sommes dues et relances', () => {
  test('le classeur des sommes dues se télécharge pour la période choisie', async ({ page }) => {
    await page.goto('/ventes');
    await page.getByRole('button', { name: 'Sommes dues' }).click();
    const fenetre = page.getByRole('dialog', { name: 'Sommes dues' });
    await fenetre.getByLabel('Du').fill('2025-01-01');
    await fenetre.getByLabel('Au').fill('2025-01-31');
    await fenetre.getByLabel('Site').selectOption('NGOLFANIKE');

    const telechargement = page.waitForEvent('download');
    await fenetre.getByRole('button', { name: 'Télécharger' }).click();
    const fichier = await telechargement;
    expect(fichier.suggestedFilename()).toBe('sommes-dues-cpi-2025-01-01-2025-01-31.xlsx');
    const contenu = await readFile(await fichier.path());
    expect(contenu.subarray(0, 2).toString(), 'un classeur xlsx est une archive zip').toBe('PK');
  });

  test('la vente en retard se relance sur WhatsApp ou par téléphone', async ({ page }) => {
    await page.goto('/ventes');
    await page.getByRole('link', { name: 'Échéances en retard' }).click();
    await expect(page).toHaveURL(/\/ventes\/retards$/u);

    const ligne = page.getByRole('row').filter({ hasText: client });
    await expect(ligne).toContainText('300 000 FCFA');
    await expect(ligne).toContainText('jours de retard');
    await expect(ligne.getByRole('link', { name: /^\+221 77 / })).toHaveAttribute(
      'href',
      `tel:${telephone}`,
    );
    const whatsapp = ligne.getByRole('link', { name: 'Relancer sur WhatsApp' });
    const lien = new URL((await whatsapp.getAttribute('href')) ?? '');
    expect(lien.origin + lien.pathname).toBe(`https://wa.me/${telephone.slice(1)}`);
    expect(lien.searchParams.get('text')).toContain('300 000 FCFA');
  });
});
