import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * TRA-13 : les écrans du projet Grand Public, et le référentiel des issues
 * d'appel, jamais analysés.
 *
 * La table de routes d'`accessibility.spec.ts` ne connaît que les ANCIENNES
 * racines (`/statistiques`, `/console`, `/campagnes`…), qui arrivent ici par
 * renvoi et n'auditent donc que la file CHUES. Aucune route sous
 * `/grand-public` n'y figure.
 */

test.use({ storageState: 'v1/.auth/admin.json' });

/**
 * Le titre de niveau 1 vient de la barre supérieure et non de la page (§6.1) :
 * le titre du DOCUMENT et un repère propre à l'écran prouvent que la page a
 * rendu autre chose que la coque.
 */
const ROUTES: readonly {
  chemin: string;
  titre: string;
  repere: (page: Page) => Locator;
}[] = [
  {
    chemin: '/grand-public',
    titre: 'Prospects · Projet Grand Public · CPI GO',
    repere: (page) =>
      page.getByText(
        'Les particuliers démarchés hors syndicat. Les fiches CHUES ne figurent pas ici.',
      ),
  },
  {
    chemin: '/grand-public/nouveau',
    titre: 'Nouveau prospect Grand Public · CPI GO',
    repere: (page) =>
      page.getByText(
        'Le nom, le prénom et le téléphone suffisent. Le reste se complète plus tard.',
      ),
  },
  {
    chemin: '/grand-public/console',
    titre: 'Appeler les prospects · CPI GO',
    // Deux `<h1>` sur cette route (§6.1) : celui de la page se vise par son nom.
    repere: (page) => page.getByRole('heading', { name: 'Rechercher une fiche', level: 1 }),
  },
  {
    chemin: '/grand-public/rappels',
    titre: 'Rappels · Projet Grand Public · CPI GO',
    // L'onglet porte un compte quand des rappels sont en retard.
    repere: (page) => page.getByRole('tab', { name: /^En retard/ }),
  },
  {
    chemin: '/grand-public/statistiques',
    titre: 'Tableau de bord · Projet Grand Public · CPI GO',
    repere: (page) => page.getByRole('button', { name: 'Composer l’écran' }),
  },
  {
    chemin: '/admin/referentiels/issues-appel',
    titre: 'Issues d’appel · CPI GO',
    repere: (page) => page.getByText('Issues proposées au téléconseiller à la fin d’un appel.'),
  },
];

async function analyser(page: Page, ou: string): Promise<void> {
  await page.addStyleTag({
    content: '* { animation: none !important; transition: none !important; }',
  });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, `${ou} : ${JSON.stringify(results.violations)}`).toEqual([]);
}

for (const { chemin, titre, repere } of ROUTES) {
  test(`aucune violation axe sur ${chemin}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(chemin);
    await expect(page).toHaveTitle(titre);
    await expect(repere(page)).toBeVisible();
    await expect(page.locator('html.light')).toHaveCount(1);

    await analyser(page, chemin);
  });
}

test('aucune violation axe sur la fiche d’un prospect Grand Public', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });

  // La fiche n'a pas d'URL fixe : on l'ouvre comme un utilisateur, depuis le
  // TABLEAU de la liste.
  await page.goto('/grand-public');
  const premier = page.getByRole('table').locator('a[href^="/grand-public/"]').first();
  await expect(premier).toBeVisible();
  await premier.click();

  await page.waitForURL(/\/grand-public\/[0-9a-f-]+$/);
  await expect(page).toHaveTitle('Fiche Grand Public · CPI GO');
  await expect(page.getByText('Rattachements')).toBeVisible();

  await analyser(page, '/grand-public/<id>');
});
