import { expect, test } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import { marque, semerProspect, type FicheSemee } from './donnees-chues';

const ccp = compteDe('CCP');
const teleconseiller = compteDe('COMMERCIAL');

test.describe('parcours, les fiches plateforme', () => {
  test('le CCP prend la fiche, le téléconseiller ne la trouve plus', async ({ browser }) => {
    const suffixe = marque();
    let semee: FicheSemee | null = null;
    await avecBase(async (client) => {
      semee = await semerProspect(client, `Plateforme ${suffixe}`, 'Inscrit', teleconseiller.id);
      await client.query(`UPDATE prospects SET "plateformeDepuis" = now() WHERE id = $1`, [
        semee.id,
      ]);
    });
    if (semee === null) throw new Error('fiche non semée');
    const fiche = semee as FicheSemee;

    const contexteCcp = await browser.newContext({ storageState: ccp.etat });
    const console = await contexteCcp.newPage();
    await console.goto('/teleconseil/plateforme');
    const ligne = console.getByRole('row').filter({ hasText: fiche.nom });
    await expect(ligne).toBeVisible();
    await ligne.getByRole('button', { name: fiche.nom }).click();
    await console.getByRole('button', { name: 'Ouvrir', exact: true }).click();
    await expect(console.getByRole('heading', { name: fiche.nom, level: 2 })).toBeVisible();

    const contexteTeleconseiller = await browser.newContext({ storageState: teleconseiller.etat });
    const fiches = await contexteTeleconseiller.newPage();
    await fiches.goto('/teleconseil/console');
    await fiches.getByLabel('Quel prospect avez-vous appelé ?').fill(fiche.phoneE164);
    await expect(fiches.getByRole('button', { name: fiche.nom })).toHaveCount(0);
    await fiches.goto('/teleconseil/plateforme');
    await expect(fiches.getByRole('heading', { name: fiche.nom, level: 2 })).toHaveCount(0);

    await contexteCcp.close();
    await contexteTeleconseiller.close();
  });
});
