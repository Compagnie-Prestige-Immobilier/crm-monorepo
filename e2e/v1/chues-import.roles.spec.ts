import { expect, test, type Page } from '@playwright/test';

/**
 * `/chues/representants/import` est réservé à l'ADMIN : CHU-IMP-01.
 *
 * Quatre sessions, un `test` par rôle (§3.3). Aucune donnée créée.
 *
 * Deux assertions par cellule interdite, jamais une (§6.5) : le refus doit être
 * LISIBLE, et l'écran ne doit avoir chargé AUCUNE donnée de représentant. Le
 * second point distingue « l'écran affiche un refus » de « l'écran a chargé les
 * données puis posé un refus par-dessus ».
 */

const CHEMIN = '/chues/representants/import';
const PHRASE = 'L’import de représentants est réservé à un autre rôle.';

/** Le refus, distingué du route-announcer de Next et de la région de Sonner (§6.3). */
const refus = (page: Page) => page.getByRole('alert').filter({ hasText: 'Accès refusé' });

async function ouvrirRefus(page: Page): Promise<string[]> {
  const charges: string[] = [];
  // L'écouteur est posé AVANT le `goto` : une réponse arrivée pendant la
  // navigation ne doit pas passer inaperçue.
  page.on('response', (response) => {
    const chemin = new URL(response.url()).pathname;
    if (!chemin.startsWith('/api/v1/representants')) return;
    if (response.status() >= 400) return;
    charges.push(chemin);
  });

  await page.goto(CHEMIN);
  await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
  return charges;
}

const ROLES = [
  { session: 'commercial', libelle: 'Téléconseiller' },
  { session: 'superviseur', libelle: 'Supervision' },
  { session: 'direction', libelle: 'Direction' },
  { session: 'banque', libelle: 'Banque & Finance' },
] as const;

for (const role of ROLES) {
  test.describe(`session ${role.session}`, () => {
    test.use({ storageState: `v1/.auth/${role.session}.json` });

    test(`CHU-IMP-01 l’import est refusé à ${role.libelle}`, async ({ page }) => {
      const charges = await ouvrirRefus(page);

      await expect(refus(page), `le refus doit nommer l’écran pour ${role.libelle}`).toContainText(
        PHRASE,
      );
      await expect(refus(page), 'le refus doit nommer le rôle en cours').toContainText(
        `Rôle en cours : ${role.libelle}.`,
      );
      expect(
        charges,
        `${role.libelle} ne doit charger aucune donnée de représentant sur ${CHEMIN}`,
      ).toEqual([]);
    });
  });
}
