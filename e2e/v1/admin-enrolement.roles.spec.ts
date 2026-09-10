import { expect, test, type Page } from '@playwright/test';

/**
 * ENR-01 : `/admin/enrolement` est réservé à la cellule pilotage, qui tient le
 * rôle ADMIN.
 *
 * Deux preuves par cellule interdite, comme ROL-17 à ROL-22 :
 *
 * 1. le refus est LISIBLE : titre « Accès refusé », le rôle en cours est nommé ;
 * 2. AUCUNE donnée de plateforme n'a été lue en chemin, prouvé par le réseau.
 *
 * Le second point distingue « l'écran est interdit » de « l'écran a lu les
 * inscriptions puis a posé un refus par-dessus ».
 *
 * La barre latérale est vérifiée dans la foulée : masquer une entrée ne protège
 * rien, mais la laisser proposerait un écran qui répond 403.
 *
 * Aucune donnée créée.
 */

const ROUTE = '/admin/enrolement';

/** Les lectures d'enrôlement qui ont ABOUTI : un 403 relayé n'est pas une fuite. */
function surveillerLEnrolement(page: Page): string[] {
  const lues: string[] = [];
  // L'écouteur est posé AVANT le `goto` : une réponse arrivée pendant la
  // navigation ne doit pas passer inaperçue.
  page.on('response', (reponse) => {
    const chemin = new URL(reponse.url()).pathname;
    if (!chemin.startsWith('/api/v1/enrolement')) return;
    if (reponse.status() >= 400) return;
    lues.push(chemin);
  });
  return lues;
}

test.describe('session superviseur', () => {
  test.use({ storageState: 'v1/.auth/superviseur.json' });

  test('ENR-01 · un superviseur reçoit un refus, et rien n’a été lu', async ({ page }) => {
    const lues = surveillerLEnrolement(page);

    await page.goto(ROUTE);

    await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Supervision');
    await expect(page.getByRole('button', { name: 'Tirer maintenant' })).toHaveCount(0);
    expect(lues, 'des inscriptions ont été lues malgré le refus').toEqual([]);
  });

  test('ENR-02 · la barre latérale ne propose pas les plateformes d’enrôlement', async ({
    page,
  }) => {
    await page.goto('/chues/statistiques');

    await expect(
      page.getByRole('link', { name: 'Plateformes d’enrôlement' }),
      'l’entrée de menu est offerte à un rôle qui reçoit 403 dessus',
    ).toHaveCount(0);
  });
});

test.describe('session administrateur', () => {
  test.use({ storageState: 'v1/.auth/admin.json' });

  test('ENR-03 · l’ADMIN ouvre l’écran, un onglet par projet', async ({ page }) => {
    await page.goto(ROUTE);

    await expect(page.getByRole('heading', { name: 'Accès refusé' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'CHUES' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Grand Public' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tirer maintenant' }).first()).toBeVisible();
  });

  test('ENR-04 · l’onglet Grand Public se retient dans l’adresse', async ({ page }) => {
    await page.goto(ROUTE);
    await page.getByRole('tab', { name: 'Grand Public' }).click();

    await page.waitForURL((url) => url.searchParams.get('onglet') === 'grand-public');
    expect(new URL(page.url()).searchParams.get('onglet')).toBe('grand-public');
  });
});
