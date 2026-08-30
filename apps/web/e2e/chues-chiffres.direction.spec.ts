import { expect, test, type Page } from '@playwright/test';

/**
 * Les chiffres du projet CHUES, vus par la DIRECTION : les huit cartes de la
 * supervision, plus les deux cartes de montants que `VOIT_LES_MONTANTS` lui
 * réserve.
 *
 * Même dépendance que le fichier superviseur : `GET /api/v1/supervision/activite`
 * répond 500 (virgule de trop dans `supervision.service.ts`). Ce test est donc
 * ATTENDU ROUGE, et c'est ce qu'il doit prouver.
 */

test.use({ storageState: 'e2e/.auth/direction.json' });

/** Le seul repère unique d'une carte : la région du graphique (§ ChartCard). */
function carte(page: Page, titre: string) {
  return page.getByRole('group', { name: `${titre} graphique` });
}

const CARTES_USINE = [
  'Taux de contact',
  'Taux de rendez-vous',
  'Taux de qualification',
  'Adhésions',
  'Par téléconseiller',
] as const;

test('CHU-CHF-02 · la direction voit en plus les cartes de résultat', async ({ page }) => {
  // La disposition dit QUELLES cartes poser : tant qu'elle n'est pas arrivée,
  // l'écran n'a lancé aucune requête de chiffres. On attend la réponse, pas un
  // délai, et l'écran est alors soit posé, soit en erreur.
  const disposition = page.waitForResponse(
    (reponse) =>
      reponse.url().includes('/api/v1/tableaux-de-bord/chues/disposition') &&
      reponse.request().method() === 'GET',
  );
  await page.goto('/chues/statistiques');
  await disposition;

  for (const titre of CARTES_USINE) {
    await expect(carte(page, titre), `la carte « ${titre} » doit être posée`).toBeVisible();
  }

  await expect(carte(page, 'Encaissé')).toBeVisible();
  await expect(carte(page, 'De l’appel à l’encaissement')).toBeVisible();
  await expect(carte(page, 'Rendement par département')).toBeVisible();
  await expect(carte(page, 'Encaissé')).toContainText('FCFA');
});
