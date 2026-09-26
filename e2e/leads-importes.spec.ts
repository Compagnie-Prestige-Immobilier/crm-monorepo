import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { avecBase, compteDe } from './comptes';
import { effacerFiches, marque, numeroUnique } from './donnees-chues';

const direction = compteDe('DIRECTION');
const teleconseiller = compteDe('COMMERCIAL');
const cle = marque();
const importId = randomUUID();
const FICHIER = `Leads e2e ${cle}.xlsx`;
const interesse = { id: randomUUID(), phoneE164: numeroUnique(), nom: `Sarr ${cle}` };
const jamaisAppele = { id: randomUUID(), phoneE164: numeroUnique(), nom: `Fall ${cle}` };
const COMMENTAIRE = `Veut recevoir la brochure ${cle}`;

test.use({ storageState: direction.etat });

test.beforeAll(async () => {
  await avecBase(async (client) => {
    await client.query(
      `INSERT INTO import_jobs (id, kind, status, mode, "requestedById", "fileName", "fileBytes",
                                "storagePath", "createdRows", "expiresAt", "updatedAt")
       VALUES ($1, 'PROSPECTS_GRAND_PUBLIC', 'succeeded', 'APPLY', $2, $3, 1, 'e2e', 2,
               now() + interval '1 day', now())`,
      [importId, teleconseiller.id, FICHIER],
    );
    for (const fiche of [interesse, jamaisAppele]) {
      await client.query(
        `INSERT INTO prospects (id, nom, prenom, "phoneE164", "createdById", projet, "importJobId",
                                "importFeuille", "clientCreatedAt", "updatedAt")
         VALUES ($1, $2, 'Awa', $3, $4, 'GRAND_PUBLIC', $5, '10 sept', now(), now())`,
        [fiche.id, fiche.nom, fiche.phoneE164, teleconseiller.id, importId],
      );
      await client.query(
        `INSERT INTO prospect_journeys (id, "prospectId", projet, "updatedAt")
         VALUES ($1, $2, 'GRAND_PUBLIC', now())`,
        [randomUUID(), fiche.id],
      );
    }
    await client.query(
      `INSERT INTO call_attempts (id, "prospectId", "performedById", comment,
                                  "clientCreatedAt", "reasonId")
       SELECT $1, $2, $3, $4, now(), r.id
         FROM call_outcome_reasons r WHERE r.code = 'DEMANDE_INFORMATION'`,
      [randomUUID(), interesse.id, teleconseiller.id, COMMENTAIRE],
    );
    await client.query(
      `UPDATE prospects SET "lastCallAt" = now(), "lastCallById" = $2,
              "lastReasonId" = (SELECT id FROM call_outcome_reasons WHERE code = 'DEMANDE_INFORMATION')
        WHERE id = $1`,
      [interesse.id, teleconseiller.id],
    );
  });
});

test.afterAll(async () => {
  await effacerFiches([interesse.phoneE164, jamaisAppele.phoneE164]);
  await avecBase(async (client) => {
    await client.query('DELETE FROM import_jobs WHERE id = $1', [importId]);
  });
});

test.describe('parcours 17, leads importes lus par la direction', () => {
  test('la direction lit le classeur et ouvre la fiche', async ({ page }) => {
    await page.goto('/teleconseil/leads-importes');

    const classeur = page.getByRole('table').first().getByRole('row').filter({ hasText: FICHIER });
    await expect(classeur).toHaveCount(1);
    const cellules = classeur.getByRole('cell');
    await expect(cellules.nth(2)).toHaveText('2');
    await expect(cellules.nth(3)).toHaveText('1');
    await expect(cellules.nth(4)).toHaveText('1');
    await expect(cellules.nth(5)).toHaveText('1');
    await expect(cellules.nth(6)).toHaveText('50 %');

    const fiches = page.getByRole('table').nth(1);
    await expect(fiches.getByRole('row').filter({ hasText: jamaisAppele.nom })).toHaveCount(0);
    const fiche = fiches.getByRole('row').filter({ hasText: interesse.nom });
    await expect(fiche).toContainText('Demande d’information');
    await expect(fiche).toContainText(COMMENTAIRE);
    await expect(fiche).toContainText(teleconseiller.nom);

    await fiche.getByRole('link', { name: `Awa ${interesse.nom}` }).click();
    await expect(page).toHaveURL(new RegExp(`/teleconseil/prospects/${interesse.id}$`, 'u'));
  });
});
