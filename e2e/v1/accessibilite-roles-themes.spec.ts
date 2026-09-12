import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * TRA-16, TRA-17, TRA-18 : ce qu'`accessibility.spec.ts` ne peut pas voir.
 *
 * Ce fichier existant balaie ses routes en ADMIN, en thème CLAIR et à la
 * largeur d'un écran de bureau. Trois angles morts en découlent : les écrans
 * d'un autre rôle (tuiles grisées du hub, page de refus), le thème sombre, et
 * la largeur téléphone.
 */
async function analyser(page: Page, ou: string): Promise<void> {
  // Le serveur de développement compile la route à la demande : sans cette
  // attente, axe auditerait le document intermédiaire.
  await expect(page).toHaveTitle(/\S/);
  await page.addStyleTag({
    content: '* { animation: none !important; transition: none !important; }',
  });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, `${ou} : ${JSON.stringify(results.violations)}`).toEqual([]);
}

test.describe('TRA-16 · les écrans des autres rôles', () => {
  test.describe('hub d’un compte ACCUEIL', () => {
    test.use({ storageState: 'v1/.auth/accueil.json' });

    test('aucune violation axe sur /espaces et ses tuiles grisées', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/espaces');
      await expect(
        page.getByRole('heading', { name: 'Choisissez un espace', level: 1 }),
      ).toBeVisible();
      // ACCUEIL n'ouvre que la coque Accueil : les trois autres tuiles sont
      // grisées, et c'est le contraste de ce gris qui est en jeu.
      await expect(page.getByText('Réservé à d’autres profils')).toHaveCount(3);

      await analyser(page, '/espaces (session ACCUEIL)');
    });
  });

  test.describe('refus opposé à un téléconseiller', () => {
    test.use({ storageState: 'v1/.auth/commercial.json' });

    test('aucune violation axe sur la page « Accès refusé »', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/admin/parametres');
      await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
      await expect(
        page.getByRole('alert').filter({ hasText: 'Rôle en cours : Téléconseiller.' }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Retour à l’accueil' })).toBeVisible();

      await analyser(page, '/admin/parametres (refus, session COMMERCIAL)');
    });
  });
});

/**
 * Les trois écrans rejoués. La barre latérale CHUES passe au noir en sombre et
 * bascule sur `accent-on-dark` : c'est le risque nommé par TRA-17.
 */
const ECRANS_SOMBRES: readonly { chemin: string; titre: string; repere: string }[] = [
  { chemin: '/chues', titre: 'Projet CHUES · CPI GO', repere: 'Trois étapes, dans l’ordre' },
  {
    chemin: '/grand-public',
    titre: 'Prospects · Projet Grand Public · CPI GO',
    repere: 'Les particuliers démarchés hors syndicat. Les fiches CHUES ne figurent pas ici.',
  },
  {
    chemin: '/admin/parametres',
    titre: 'Paramètres · Admin · CPI GO',
    repere: 'Ces actions portent sur les données de tous les utilisateurs.',
  },
];

test.describe('TRA-17 · thème sombre', () => {
  test.use({ storageState: 'v1/.auth/admin.json' });

  for (const { chemin, titre, repere } of ECRANS_SOMBRES) {
    test(`aucune violation axe sur ${chemin} en thème sombre`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(chemin);
      await expect(page).toHaveTitle(titre);
      await expect(page.getByText(repere).first()).toBeVisible();

      // `defaultTheme="light"` : la préférence du système ne suffit pas, le
      // thème se choisit dans la barre supérieure. Le réglage ne vit que dans
      // ce contexte de navigateur, jeté à la fin du test.
      await page.getByRole('button', { name: 'Changer de thème' }).click();
      await page.getByRole('menuitem', { name: 'Sombre' }).click();
      await expect(page.locator('html.dark')).toHaveCount(1);

      await analyser(page, `${chemin} (thème sombre)`);
    });
  }
});

/**
 * Les trois écrans de TRA-12, à la même largeur : cibles tactiles et ordre de
 * lecture une fois la barre latérale repliée.
 */
const ECRANS_MOBILES: readonly { chemin: string; titre: string; repere: string }[] = [
  {
    chemin: '/grand-public',
    titre: 'Prospects · Projet Grand Public · CPI GO',
    repere: 'Les particuliers démarchés hors syndicat. Les fiches CHUES ne figurent pas ici.',
  },
  {
    chemin: '/admin/parametres',
    titre: 'Paramètres · Admin · CPI GO',
    repere: 'Ces actions portent sur les données de tous les utilisateurs.',
  },
  {
    chemin: '/grand-public/statistiques',
    titre: 'Tableau de bord · Projet Grand Public · CPI GO',
    repere: 'Composer l’écran',
  },
];

test.describe('TRA-18 · largeur téléphone', () => {
  test.use({ storageState: 'v1/.auth/admin.json', viewport: { width: 375, height: 812 } });

  for (const { chemin, titre, repere } of ECRANS_MOBILES) {
    test(`aucune violation axe sur ${chemin} à 375 px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(chemin);
      await expect(page).toHaveTitle(titre);
      await expect(page.getByText(repere).first()).toBeVisible();

      await analyser(page, `${chemin} (375 px)`);
    });
  }
});
