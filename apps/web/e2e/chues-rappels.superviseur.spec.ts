import { expect, test } from '@playwright/test';

/**
 * Moitié SUPERVISEUR de CHU-RAP-07 : l'encadrement filtre par téléconseiller
 * et lit la colonne qui nomme l'auteur du rappel. La moitié COMMERCIAL, qui
 * prouve l'absence des deux, vit dans `chues-rappels.commercial.spec.ts`.
 *
 * La file est interceptée : ce fichier ne possède aucune plage de téléphones
 * (§5.5) et la colonne « Téléconseiller » n'existe que sur un tableau, donc
 * que sur une ligne. La réponse posée porte la forme exacte de `CallbackDto`.
 */

test.use({ storageState: 'e2e/.auth/superviseur.json' });

const RAPPEL = {
  id: '00000000-0000-4000-8000-0000000007a1',
  prospectId: '00000000-0000-4000-8000-0000000007a2',
  shortCode: 'E2ERA7',
  phoneE164: '+221781004607',
  comment: 'E2E-CHUES-RAP filtre encadrement',
  assignedToId: '00000000-0000-4000-8000-0000000007a3',
  assignedToName: 'Awa Fixture',
  overdue: true,
};

test('CHU-RAP-07 le filtre par téléconseiller n’existe que pour l’encadrement', async ({
  page,
}) => {
  const serverTime = new Date();
  await page.route('**/api/v1/phase2/callbacks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            ...RAPPEL,
            scheduledAt: new Date(serverTime.getTime() - 3_600_000).toISOString(),
          },
        ],
        serverTime: serverTime.toISOString(),
      }),
    });
  });

  await page.goto('/chues/rappels');
  await expect(page).toHaveTitle('Rappels · CPI GO');

  const filtre = page.getByRole('combobox', { name: 'Téléconseiller Tous les téléconseillers' });
  await expect(filtre, 'l’encadrement perd le filtre dont il vit').toHaveCount(1);

  const tableau = page.getByRole('table');
  await expect(tableau.getByRole('columnheader', { name: 'Téléconseiller' })).toHaveCount(1);

  const ligne = tableau.getByRole('row').filter({ hasText: '+221 78 100 46 07' });
  await expect(ligne).toHaveCount(1);
  await expect(ligne).toContainText('Awa Fixture');
});
