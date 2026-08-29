import { expect, test, type Page } from '@playwright/test';

/**
 * ROL-28 à ROL-30 : les trous relevés en lecture du code.
 *
 * ROL-30 n'est PAS ÉCRIT : il demande le détail d'un lot d'export ouvrable par
 * son identifiant, et aucun n'existe sur cette base — `GET /api/v1/lots-export`
 * répond 500 à un administrateur, tout comme `GET /api/v1/lots-export/{id}`.
 * La question Q-15 du §8 est adressée au mainteneur central ; ces parcours ne
 * créent aucune donnée et ne fabriquent donc pas le lot manquant.
 */

const LIBELLE_DU_ROLE = {
  commercial: 'Téléconseiller',
  banque: 'Banque & Finance',
} as const;

/** Les chemins `/api/v1/…` aboutis, collectés depuis AVANT la navigation. */
function surveillerLApi(page: Page): { chemins: string[] } {
  const releve = { chemins: [] as string[] };
  page.on('response', (response) => {
    const chemin = new URL(response.url()).pathname;
    if (chemin.startsWith('/api/v1/') && response.status() < 400) releve.chemins.push(chemin);
  });
  return releve;
}

/**
 * ROL-28 : `/accueil` refuse les rôles sans droit sur le registre.
 *
 * E2E.md §1.4 annonce ce parcours ATTENDU ROUGE, `accueil/page.tsx` ne posant
 * aucun `guardRoles`. La garde existe pourtant : elle est montée un cran plus
 * haut, dans `apps/web/src/app/(panel)/accueil/layout.tsx`, et couvre du même
 * coup les trois onglets du registre. Le refus est donc éprouvé DANS LES DEUX
 * SENS (§6.5) : c'est ce qui distingue un vrai refus d'un écran qui aurait
 * chargé ses visites avant d'afficher une erreur par-dessus.
 */
for (const [role, session] of [
  ['commercial', 'e2e/.auth/commercial.json'],
  ['banque', 'e2e/.auth/banque.json'],
] as const) {
  test.describe(`ROL-28 · ${role}`, () => {
    test.use({ storageState: session });

    test(`ROL-28 · /accueil refuse ${role}, sans charger une seule visite`, async ({ page }) => {
      const releve = surveillerLApi(page);
      await page.goto('/accueil');

      await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
      await expect(page.getByRole('alert').filter({ hasText: 'Accès refusé' })).toContainText(
        LIBELLE_DU_ROLE[role],
      );
      await expect(
        page.getByRole('link', { name: 'Retour à l’accueil', exact: true }),
      ).toHaveAttribute('href', '/espaces');

      const visites = releve.chemins.filter((chemin) => chemin.startsWith('/api/v1/visites'));
      expect(visites, `/accueil a chargé le registre malgré le refus à ${role}`).toEqual([]);
    });
  });
}

/**
 * ROL-29 : « Ouvrir l’annuaire » doit mener à la liste Grand Public.
 *
 * ATTENDU ROUGE. `apps/web/src/components/console/console-view.tsx` ligne 9
 * calcule `'/grand-public/prospects'`, route qui n'existe pas : elle est
 * captée par le segment dynamique `/grand-public/[id]` avec `id="prospects"`,
 * le `ParseUUIDPipe` de l'API refuse, et l'écran rend « Cette fiche n’a pas pu
 * être chargée. ». La liste vit à `/grand-public`.
 */
test.describe('ROL-29', () => {
  test.use({ storageState: 'e2e/.auth/commercial.json' });

  test('ROL-29 · « Ouvrir l’annuaire » mène à la liste Grand Public', async ({ page }) => {
    await page.goto('/grand-public/console');
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Rechercher une fiche', level: 1 }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Ouvrir l’annuaire', exact: true }).click();

    // Le routeur d'App Router ne change l'adresse qu'une fois la réponse du
    // serveur reçue : on attend d'avoir QUITTÉ la console, sinon l'échec dit
    // « toujours sur /grand-public/console » au lieu de nommer la destination
    // réellement atteinte.
    await page.waitForURL((url) => url.pathname !== '/grand-public/console', { timeout: 25_000 });

    await expect(page).toHaveURL(/\/grand-public$/);
  });
});
