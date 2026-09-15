import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import {
  appelEnregistre,
  effacerFiches,
  marque,
  ouvrirFicheDepuisAnnuaire,
  repondre,
  semerRepresentant,
  type FicheSemee,
} from './donnees-chues';

const compte = compteDe('COMMERCIAL');
const ANNUAIRE = '/teleconseil/appels-representants';
const cle = marque();
const sousStatutId = randomUUID();
const SOUS_STATUT = `Retraité depuis peu ${cle}`;

const telephones: string[] = [];

async function statutConsigne(representantId: string): Promise<string | null> {
  let statut: string | null = null;
  await avecBase(async (client) => {
    const { rows } = await client.query<{ statutQualificationId: string | null }>(
      `SELECT "statutQualificationId" FROM rep_call_attempts WHERE "representantId" = $1`,
      [representantId],
    );
    statut = rows[0]?.statutQualificationId ?? null;
  });
  return statut;
}

test.use({ storageState: compte.etat });

test.beforeAll(async () => {
  await avecBase(async (client) => {
    await client.query(
      `INSERT INTO statuts_qualification ("id", "code", "label", "effect", "parentId", "updatedAt")
       SELECT $1, $2, $3, p.effect, p.id, now()
         FROM statuts_qualification p WHERE p.code = 'RETRAITE'`,
      [sousStatutId, `RETRAITE_${cle.toUpperCase()}`, SOUS_STATUT],
    );
  });
});

test.afterAll(async () => {
  await effacerFiches(telephones);
  await avecBase(async (client) => {
    await client.query('DELETE FROM statuts_qualification WHERE id = $1', [sousStatutId]);
  });
});

test.describe('parcours 5, qualification des representants', () => {
  test('le sous-statut se choisit apres son parent et se consigne', async ({ page }) => {
    let fiche: FicheSemee | null = null;
    await avecBase(async (client) => {
      fiche = await semerRepresentant(client, `Ndiaye ${cle}`, compte.id);
    });
    if (fiche === null) throw new Error('representant non seme');
    const semee = fiche as FicheSemee;
    telephones.push(semee.phoneE164);

    await page.goto(ANNUAIRE);
    await ouvrirFicheDepuisAnnuaire(page, semee);
    await repondre(page, 'Comment s’est passé l’appel ?', 'Joignable');
    await repondre(page, 'L’établissement de la fiche est-il confirmé ?', 'Oui');
    await repondre(page, 'A-t-il déjà été contacté ?', 'Non');
    await repondre(page, 'Connaît-il l’UES ?', 'Non');
    await repondre(page, 'Souhaite-t-il être représentant CHUES ?', 'Non');

    await expect(page.getByRole('combobox', { name: 'Précision' })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Statut de qualification' }).click();
    await expect(page.getByRole('option', { name: SOUS_STATUT, exact: true })).toHaveCount(0);
    await page.getByRole('option', { name: 'Retraité', exact: true }).click();
    await page.getByRole('combobox', { name: 'Précision' }).click();
    await page.getByRole('option', { name: SOUS_STATUT, exact: true }).click();

    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(appelEnregistre(page, semee.nom)).toBeVisible();

    await expect.poll(() => statutConsigne(semee.id)).toBe(sousStatutId);
  });
});
