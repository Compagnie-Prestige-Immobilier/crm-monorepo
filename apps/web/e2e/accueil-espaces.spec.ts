import { expect, test } from '@playwright/test';

/**
 * ACC-HUB-01 à ACC-HUB-05 : le comportement PROPRE au hub des espaces.
 *
 * L'atterrissage et la liste des tuiles par rôle appartiennent à
 * `roles-espaces.spec.ts` (ROL-01 à ROL-06) : ce fichier ne couvre que le
 * paramètre `retour`, le rechargement, la boucle de redirection et le clavier.
 */

/** Bouton ou lien selon la primitive : Base UI peut poser `role="button"` sur le `<a>`. */
const nomRetour = { name: 'Retour', exact: true } as const;

test.describe('session ADMIN', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('ACC-HUB-01 · le hub porte l’état de retour et propose de revenir', async ({ page }) => {
    await page.goto('/espaces?retour=%2Faccueil%2Flistes');

    await expect(page.getByRole('heading', { name: 'Changer d’espace', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Choisissez un espace', level: 1 })).toHaveCount(
      0,
    );

    const retour = page.getByRole('button', nomRetour).or(page.getByRole('link', nomRetour));
    await expect(retour).toHaveAttribute('href', '/accueil/listes');

    await retour.click();
    await expect(page).toHaveURL(/\/accueil\/listes$/);
  });

  for (const [cas, requete] of [
    ['une origine externe déguisée', '?retour=//evil.example.com'],
    ['un antislash', '?retour=/%5Cevil'],
    ['le hub lui-même', '?retour=/espaces'],
  ] as const) {
    test(`ACC-HUB-02 · un retour hostile est neutralisé : ${cas}`, async ({ page }) => {
      await page.goto(`/espaces${requete}`);

      await expect(
        page.getByRole('heading', { name: 'Choisissez un espace', level: 1 }),
        `${requete} ne doit pas ouvrir le mode « Changer d’espace »`,
      ).toBeVisible();
      await expect(page.getByRole('button', nomRetour)).toHaveCount(0);
      await expect(page.getByRole('link', nomRetour)).toHaveCount(0);
    });
  }
});

test.describe('session ACCUEIL', () => {
  test.use({ storageState: 'e2e/.auth/accueil.json' });

  test('ACC-HUB-03 · le hub survit à un rechargement dur', async ({ page }) => {
    await page.goto('/espaces');
    await page.reload();

    await expect(
      page.getByRole('heading', { name: 'Choisissez un espace', level: 1 }),
    ).toBeVisible();

    const tuiles = page.getByRole('main');
    await expect(tuiles.getByRole('link', { name: /^Accueil/ })).toHaveAttribute(
      'href',
      '/accueil',
    );
    // Les trois autres projets restent affichés mais GRISÉS : aucun lien.
    for (const ferme of ['Projet CHUES', 'Projet Grand Public', 'Admin']) {
      await expect(
        tuiles.getByRole('link', { name: new RegExp(`^${ferme}`) }),
        `${ferme} ne doit pas être cliquable pour un agent d’accueil`,
      ).toHaveCount(0);
    }
  });

  test('ACC-HUB-04 · aucune boucle de redirection entre /, /connexion et /espaces', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForURL('**/espaces');
    await expect(
      page.getByRole('heading', { name: 'Choisissez un espace', level: 1 }),
    ).toBeVisible();

    await page.goto('/connexion');
    await page.waitForURL('**/espaces');
    await expect(
      page.getByRole('heading', { name: 'Choisissez un espace', level: 1 }),
    ).toBeVisible();
  });

  test('ACC-HUB-05 · le hub reste utilisable au clavier', async ({ page }) => {
    await page.goto('/espaces');

    const tuile = page.getByRole('main').getByRole('link', { name: /^Accueil/ });
    await expect(tuile).toBeVisible();

    // Le lien d'évitement, le thème et le menu de compte précèdent la grille :
    // la borne couvre l'en-tête du hub, elle ne masque pas un échec.
    for (let saut = 0; saut < 10; saut += 1) {
      if (await tuile.evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await expect(tuile).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/accueil$/);
  });
});
