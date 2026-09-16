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
    await repondre(page, 'Avez-vous eu la personne au téléphone ?', 'Oui, elle a répondu');
    await repondre(page, 'L’école de la fiche est-elle la bonne ?', 'Oui');
    await repondre(page, 'A-t-il déjà été contacté par CPI ?', 'Non');
    await repondre(page, 'Connaît-il l’UES ?', 'Non');
    await page.getByRole('button', { name: 'Sans syndicat' }).click();
    await repondre(page, 'Accepte-t-il d’être représentant CHUES ?', 'Non');

    // Le sous-statut ne se propose qu'apres son parent, jamais au premier palier.
    const statuts = page.getByRole('group', { name: 'Quel statut de qualification ?' });
    await expect(statuts.getByRole('button', { name: SOUS_STATUT })).toHaveCount(0);
    await repondre(page, 'Quel statut de qualification ?', 'Retraité');
    await repondre(page, 'Quelle précision ?', SOUS_STATUT);

    // Il a refusé : le script demande quelqu'un d'autre, on n'a personne.
    await page.getByRole('button', { name: 'Personne à proposer' }).click();
    await page.getByRole('button', { name: 'Enregistrer l’appel' }).click();
    await expect(appelEnregistre(page, semee.nom)).toBeVisible();

    await expect.poll(() => statutConsigne(semee.id)).toBe(sousStatutId);
  });
});
