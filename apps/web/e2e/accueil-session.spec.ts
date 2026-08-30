import { expect, test } from '@playwright/test';

/**
 * ACC-CNX-10 à ACC-CNX-14 : ce que devient une session DÉJÀ posée.
 *
 * Aucune connexion par formulaire ici : les états de session viennent du
 * disque (`e2e/.auth/*.json`, projet `setup`). Le seul geste qui touche des
 * cookies — la déconnexion d'ACC-CNX-11 — se joue dans un contexte JETABLE :
 * vider les cookies de la page partagée ferait tomber tout ce qui suit.
 */

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

test.describe('session ADMIN', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('ACC-CNX-10 · la connexion est refusée à qui a déjà une session', async ({ page }) => {
    await page.goto('/connexion');

    await expect(page).toHaveURL(/\/espaces$/);
    await expect(
      page.getByRole('heading', { name: 'Choisissez un espace', level: 1 }),
    ).toBeVisible();
  });

  test('ACC-CNX-11 · la déconnexion depuis le hub reverrouille tout l’accueil', async ({
    browser,
  }) => {
    // `browser.newContext` n'hérite d'aucune option de `use` : la base d'URL
    // est reposée ici.
    const jetable = await browser.newContext({
      baseURL: WEB_URL,
      storageState: 'e2e/.auth/admin.json',
    });
    try {
      const page = await jetable.newPage();
      await page.goto('/espaces');

      await page.getByRole('button', { name: 'Compte de Administrateur CPI' }).click();
      await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
      await page.waitForURL(/\/connexion$/);

      const noms = (await jetable.cookies()).map((cookie) => cookie.name);
      expect(noms).not.toContain('cpi_at');
      expect(noms).not.toContain('cpi_rt');

      await page.goto('/accueil');
      await expect(page).toHaveURL(/\/connexion$/);
      await expect(page.getByRole('button', { name: 'Ajouter une visite' })).toHaveCount(0);
    } finally {
      await jetable.close();
    }
  });

  test('ACC-CNX-12 · les cookies de session restent hors de portée du JavaScript', async ({
    page,
    context,
  }) => {
    await page.goto('/accueil');
    await expect(page.getByRole('button', { name: 'Ajouter une visite' })).toBeVisible();

    const lisibles = await page.evaluate(() => document.cookie);
    expect(lisibles).not.toContain('cpi_at');
    expect(lisibles).not.toContain('cpi_rt');

    const session = (await context.cookies()).filter(
      (cookie) => cookie.name === 'cpi_at' || cookie.name === 'cpi_rt',
    );
    expect(session.map((cookie) => cookie.name).sort()).toEqual(['cpi_at', 'cpi_rt']);
    for (const cookie of session) {
      expect(cookie.httpOnly, `${cookie.name} doit rester httpOnly`).toBe(true);
    }
  });

  test('ACC-CNX-14 · une adresse qui n’a jamais existé reste introuvable', async ({ page }) => {
    // `/accueils` frôle le segment statique `/accueil` sans être une racine
    // connue de `MOVED_ROUTES`.
    await page.goto('/accueils');

    await expect(page.getByRole('heading', { name: 'Page introuvable', level: 1 })).toBeVisible();
    await expect(
      page.getByText('Cette adresse ne correspond à aucun écran du panel.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Revenir aux espaces' })).toHaveAttribute(
      'href',
      '/espaces',
    );
  });
});

test.describe('session ACCUEIL', () => {
  test.use({ storageState: 'e2e/.auth/accueil.json' });

  test('ACC-CNX-13 · /notifications est un écran, pas une ancienne adresse', async ({ page }) => {
    await page.goto('/notifications');

    // Le segment STATIQUE doit gagner sur l'attrape-tout `[ancien]`, qui
    // renverrait le comptoir sur le composeur d'administration.
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(
      page.getByRole('heading', { name: 'Notifications', level: 1, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toHaveCount(0);
  });
});
