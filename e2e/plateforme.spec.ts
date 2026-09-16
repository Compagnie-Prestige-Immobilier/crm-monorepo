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

  test('l’étoile distingue l’inscrit du visiteur du site, la note du classeur suit', async ({
    browser,
  }) => {
    const suffixe = marque();
    const identifiant = `e2e-plateforme-${suffixe}`;
    let chaud: FicheSemee | null = null;
    let froid: FicheSemee | null = null;
    await avecBase(async (client) => {
      chaud = await semerProspect(client, `Inscrit ${suffixe}`, 'Awa', teleconseiller.id);
      froid = await semerProspect(client, `Visiteur ${suffixe}`, 'Moussa', teleconseiller.id);
      await client.query(
        `UPDATE prospects SET "plateformeDepuis" = now() WHERE id = ANY($1::text[])`,
        [[chaud.id, froid.id]],
      );
      await client.query(`UPDATE prospects SET "remarqueImport" = $2 WHERE id = $1`, [
        froid.id,
        `Rappeler après 18 h ${suffixe}`,
      ]);
      await client.query(
        `INSERT INTO inscriptions_plateforme (id, projet, "identifiantDistant", nom, prenom, "phoneE164",
           "statutDistant", "prospectId", "chargeUtile", "dernierTirageAt", "updatedAt")
         VALUES ($1, 'CHUES', $1, 'Inscrit', 'Awa', $2, 'etape-2', $3, '{}'::jsonb, now(), now())`,
        [identifiant, chaud.phoneE164, chaud.id],
      );
    });
    if (chaud === null || froid === null) throw new Error('fiches non semées');
    const ficheChaude = chaud as FicheSemee;
    const ficheFroide = froid as FicheSemee;

    const contexteCcp = await browser.newContext({ storageState: ccp.etat });
    const console = await contexteCcp.newPage();
    try {
      await console.goto('/teleconseil/plateforme');
      const ligneChaude = console.getByRole('row').filter({ hasText: ficheChaude.nom });
      const ligneFroide = console.getByRole('row').filter({ hasText: ficheFroide.nom });
      await expect(ligneChaude.getByRole('img', { name: 'Inscription confirmée' })).toBeVisible();
      await expect(ligneFroide.getByRole('img', { name: 'Inscription confirmée' })).toHaveCount(0);
      await expect(ligneFroide.getByText('A commencé sur le site')).toBeVisible();

      await ligneFroide.getByRole('button', { name: ficheFroide.nom }).click();
      await console.getByRole('button', { name: 'Ouvrir', exact: true }).click();
      await expect(console.getByText(`Rappeler après 18 h ${suffixe}`)).toBeVisible();
    } finally {
      await contexteCcp.close();
      await avecBase(async (client) => {
        await client.query('DELETE FROM inscriptions_plateforme WHERE id = $1', [identifiant]);
        await client.query('DELETE FROM ouvertures_fiche WHERE "prospectId" = ANY($1::text[])', [
          [ficheChaude.id, ficheFroide.id],
        ]);
      });
    }
  });
});
