import { expect, test, type Page } from '@playwright/test';

/**
 * CHU-LOT-02 : `/chues/campagnes` est fermé au téléconseiller et à l'agent
 * bancaire.
 *
 * La garde RENVOIE au lieu de rendre un refus (`campagnes/page.tsx` :
 * `redirect('/chues')`), et l'agent bancaire est renvoyé une seconde fois vers
 * `/chues/banque`. Ce parcours fige ce comportement ; le traitement du refus
 * reste à trancher par le propriétaire produit. Recouvrement assumé avec
 * ROL-27, qui fige le même renvoi dans la matrice des rôles.
 *
 * Deux assertions par cellule interdite : le renvoi ABOUTIT, et AUCUNE donnée
 * de lot n'a été chargée en chemin. Le second point distingue « l'écran est
 * interdit » de « l'écran a lu les lots puis a changé d'adresse ».
 *
 * Aucune donnée créée.
 */

const ROUTE = '/chues/campagnes';

/** Les lectures de lot qui ont ABOUTI : un 403 relayé n'est pas une fuite. */
function surveillerLesLots(page: Page): string[] {
  const charges: string[] = [];
  // L'écouteur est posé AVANT le `goto` : une réponse arrivée pendant la
  // navigation ne doit pas passer inaperçue.
  page.on('response', (reponse) => {
    const chemin = new URL(reponse.url()).pathname;
    if (!chemin.startsWith('/api/v1/lots-export')) return;
    if (reponse.status() >= 400) return;
    charges.push(chemin);
  });
  return charges;
}

test.describe('session commercial', () => {
  test.use({ storageState: 'e2e/.auth/commercial.json' });

  test('CHU-LOT-02 · un téléconseiller est renvoyé de la liste des lots vers /chues', async ({
    page,
  }) => {
    const charges = surveillerLesLots(page);

    await page.goto(ROUTE);

    await page.waitForURL((url) => url.pathname === '/chues');
    expect(new URL(page.url()).pathname).toBe('/chues');
    await expect(page.getByText('Trois étapes, dans l’ordre.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nouveau lot' })).toHaveCount(0);
    expect(charges, 'un téléconseiller ne doit lire aucun lot d’export').toEqual([]);
  });
});

test.describe('session banque', () => {
  test.use({ storageState: 'e2e/.auth/banque.json' });

  test('CHU-LOT-02 · un agent bancaire est renvoyé de la liste des lots vers /chues/banque', async ({
    page,
  }) => {
    const charges = surveillerLesLots(page);

    await page.goto(ROUTE);

    // Double renvoi : `/chues/campagnes` → `/chues` → `/chues/banque`.
    await page.waitForURL((url) => url.pathname === '/chues/banque');
    expect(new URL(page.url()).pathname).toBe('/chues/banque');
    await expect(page).toHaveTitle(/Tableau de bord bancaire/);
    await expect(page.getByRole('button', { name: 'Nouveau lot' })).toHaveCount(0);
    expect(charges, 'un agent bancaire ne doit lire aucun lot d’export').toEqual([]);
  });
});
