import { expect, test } from '@playwright/test';

/**
 * ACC-COQ-01 à ACC-COQ-12 : le COMPORTEMENT de la coque du panel.
 *
 * La liste des entrées de barre par rôle appartient à `roles-navigation.spec.ts`
 * (ROL-07 à ROL-16). Ici : les onglets du registre, le refus lisible, le repli
 * de la barre, le tiroir mobile, le titre de la barre supérieure, la cloche, et
 * les trois façons dont un écran tombe sans devenir blanc.
 *
 * Aucune donnée créée, aucune donnée lue en écriture. « Proposer par défaut » et
 * la bascule d'espace démo ne sont jamais actionnés.
 *
 * ACC-COQ-12 n'est PAS écrit : voir le retour d'exécution. La charge falsifiée
 * de `/api/v1/tableaux-de-bord/visites/disposition` n'atteint jamais le
 * navigateur, la page la préchargeant côté serveur.
 */

const ONGLETS = { name: 'Visites' } as const;

/** La requête PAGINÉE du registre ; `/api/v1/visites/referentiels` reste servie. */
const COUPURE_REGISTRE = /\/api\/v1\/visites\?/;

/**
 * Le message RÉELLEMENT rendu quand la requête est coupée : `apiErrorText`
 * (`lib/mutation-feedback.ts:16`) répond pour tout ce qui n'est pas une
 * `ApiError` et le `fallback` « Le registre n’a pas pu être chargé. » de
 * `registre-view.tsx:359` ne sert alors pas.
 */
const MESSAGE_COUPURE = 'Serveur injoignable. Vérifiez la connexion, puis réessayez.';

test.describe('session ADMIN', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('ACC-COQ-01 · les onglets du registre sont le seul chemin vers ses trois écrans', async ({
    page,
  }) => {
    await page.goto('/accueil');

    const onglets = page.getByRole('navigation', ONGLETS);
    await expect(onglets.getByRole('link')).toHaveText([
      'Liste',
      'Tableau de bord',
      'Listes',
      'Import',
    ]);

    await expect(onglets.getByRole('link', { name: 'Liste', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await onglets.getByRole('link', { name: 'Tableau de bord', exact: true }).click();
    await expect(page).toHaveURL(/\/accueil\/tableau-de-bord$/);

    await expect(
      onglets.getByRole('link', { name: 'Tableau de bord', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      onglets.getByRole('link', { name: 'Liste', exact: true }),
    ).not.toHaveAttribute('aria-current', 'page');
  });

  test('ACC-COQ-04 · la section « Plus » se déplie et retient son état', async ({ page }) => {
    // La coque Accueil n'a qu'une entrée : elle n'a pas de repli. Le repère est
    // « Contacts recommandés » et JAMAIS « Lots d’export », entrée susceptible
    // de disparaître (E2E.md §2.2).
    await page.goto('/chues/prospects');
    // La barre est rendue par le SERVEUR avec « Plus » replié ; son état réel
    // n'est posé qu'à l'hydratation. Sans cette attente, `toHaveCount(0)`
    // réussirait sur un DOM non encore hydraté. `next-route-announcer` est
    // absent du HTML servi : sa présence prouve que le client a pris la main.
    await page.waitForFunction(() => document.querySelector('next-route-announcer') !== null);

    const barre = page.getByRole('navigation', { name: 'Navigation principale' });
    const repere = barre.getByRole('link', { name: 'Contacts recommandés' });
    const plus = barre.getByText('Plus', { exact: true });

    await expect(repere).toHaveCount(0);

    await plus.click();
    await expect(repere).toBeVisible();

    await page.reload();
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', { name: 'Contacts recommandés' }),
      'le cookie cpi_sidebar_plus doit survivre au rechargement',
    ).toBeVisible();

    await page.getByRole('navigation', { name: 'Navigation principale' })
      .getByText('Plus', { exact: true })
      .click();
    await page.reload();
    await expect(
      page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', { name: 'Contacts recommandés' }),
    ).toHaveCount(0);
  });

  test('ACC-COQ-05 · la barre latérale se réduit et se souvient', async ({ page }) => {
    await page.goto('/accueil');

    await page.getByRole('button', { name: 'Réduire la navigation' }).click();

    const deployer = page.getByRole('button', { name: 'Déployer la navigation' });
    await expect(deployer).toHaveAttribute('aria-expanded', 'false');
    // Le libellé passe en `sr-only` : il doit rester dans l'arbre
    // d'accessibilité, sinon la barre réduite est muette au lecteur d'écran.
    await expect(page.getByRole('link', { name: 'Registre des visites' })).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Déployer la navigation' }),
      'le repli est lu côté serveur : la barre ne doit pas resurgir déployée',
    ).toHaveAttribute('aria-expanded', 'false');

    // Remise en l'état trouvé : le cookie de repli est un état partagé.
    await page.getByRole('button', { name: 'Déployer la navigation' }).click();
    await expect(page.getByRole('button', { name: 'Réduire la navigation' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  test('ACC-COQ-07 · le lien « Espaces » de la barre supérieure porte le retour', async ({
    page,
  }) => {
    await page.goto('/accueil/tableau-de-bord');

    await page.getByRole('link', { name: 'Espaces', exact: true }).click();
    await expect(page).toHaveURL(/\/espaces\?retour=%2Faccueil%2Ftableau-de-bord$/);
    await expect(page.getByRole('heading', { name: 'Changer d’espace', level: 1 })).toBeVisible();

    await page
      .getByRole('button', { name: 'Retour', exact: true })
      .or(page.getByRole('link', { name: 'Retour', exact: true }))
      .click();
    await expect(page).toHaveURL(/\/accueil\/tableau-de-bord$/);
  });

  for (const [route, titre] of [
    ['/accueil', 'Registre des visites'],
    ['/accueil/tableau-de-bord', 'Tableau de bord'],
    ['/accueil/listes', 'Listes'],
    ['/accueil/import', 'Import du registre'],
  ] as const) {
    test(`ACC-COQ-08 · ${route} affiche « ${titre} » dans la barre supérieure`, async ({
      page,
    }) => {
      await page.goto(route);

      await expect(
        page.getByRole('heading', { level: 1, name: titre, exact: true }),
        `${route} doit gagner par le préfixe le plus long`,
      ).toBeVisible();
    });
  }

  test('ACC-COQ-10 · API injoignable : la coque le dit au lieu de blanchir', async ({ page }) => {
    await page.route('**/api/v1/**', (route) => route.abort('failed'));
    await page.goto('/accueil');

    const panne = page
      .getByRole('alert')
      .filter({ hasText: 'Serveur injoignable' })
      .or(
        page
          .getByRole('alert')
          .filter({ hasText: 'Session non vérifiée. Réessayez dans un instant.' }),
      );
    await expect(panne.first()).toBeVisible();
    // La page d'erreur générique de Next est en anglais et sans issue.
    await expect(page.locator('body')).not.toContainText('Application error');

    // Variante : seule la LISTE tombe, la coque doit survivre. Le motif vise la
    // requête paginée et laisse passer `/api/v1/visites/referentiels`, dont la
    // chute masquerait ce qu'on éprouve.
    await page.unroute('**/api/v1/**');
    await page.route(COUPURE_REGISTRE, (route) => route.abort('failed'));
    await page.reload();

    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Registre des visites', exact: true }),
    ).toBeVisible();

    const erreur = page.getByRole('alert').filter({ hasText: MESSAGE_COUPURE });
    await expect(erreur).toBeVisible();
    await expect(erreur.getByRole('heading', { name: 'Serveur injoignable', level: 2 })).toBeVisible();
    await expect(erreur.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  });

  test('ACC-COQ-11 · « Réessayer » relance vraiment la requête', async ({ page }) => {
    const appels: string[] = [];
    page.on('request', (requete) => {
      if (COUPURE_REGISTRE.test(requete.url())) appels.push(requete.url());
    });

    await page.route(COUPURE_REGISTRE, (route) => route.abort('failed'));
    await page.goto('/accueil');

    const erreur = page.getByRole('alert').filter({ hasText: MESSAGE_COUPURE });
    await expect(erreur).toBeVisible();
    const avant = appels.length;

    await page.unroute(COUPURE_REGISTRE);
    // Aucun `page.reload()` ici : c'est le BOUTON qui est éprouvé.
    await erreur.getByRole('button', { name: 'Réessayer' }).click();

    await expect(page.getByRole('alert').filter({ hasText: MESSAGE_COUPURE })).toHaveCount(0);
    await expect(
      page
        .getByRole('table')
        .or(page.getByRole('heading', { name: 'Aucune visite enregistrée aujourd’hui', level: 2 }))
        .first(),
    ).toBeVisible();
    // Un bouton décoratif laisserait le compte d'appels inchangé.
    expect(appels.length, 'le clic doit avoir déclenché un nouvel appel au registre').toBeGreaterThan(
      avant,
    );
  });
});

test.describe('session ACCUEIL', () => {
  test.use({ storageState: 'e2e/.auth/accueil.json' });

  test('ACC-COQ-02 · un agent d’accueil ne voit que deux onglets', async ({ page }) => {
    await page.goto('/accueil');

    const onglets = page.getByRole('navigation', ONGLETS);
    await expect(onglets.getByRole('link')).toHaveText(['Liste', 'Tableau de bord']);
    await expect(onglets.getByRole('link', { name: 'Listes', exact: true })).toHaveCount(0);
    await expect(onglets.getByRole('link', { name: 'Import', exact: true })).toHaveCount(0);
  });

  for (const [route, quoi] of [
    ['/accueil/listes', 'La gestion des listes du registre'],
    ['/accueil/import', 'L’import du registre des visites'],
  ] as const) {
    test(`ACC-COQ-03 · ${route} rend un refus lisible`, async ({ page }) => {
      await page.goto(route);

      await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();

      const refus = page.getByRole('alert').filter({ hasText: 'Accès refusé' });
      await expect(refus).toContainText(quoi);
      await expect(refus).toContainText('Rôle en cours :');
      await expect(refus).toContainText('Accueil');
      await expect(refus.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute(
        'href',
        '/espaces',
      );
    });
  }

  test('ACC-COQ-06 · en 375 px, la navigation passe dans un tiroir', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/accueil');

    const ouvrir = page.getByRole('button', { name: 'Ouvrir la navigation' });
    await expect(ouvrir).toBeVisible();
    await ouvrir.click();

    const tiroir = page.getByRole('dialog', { name: 'Navigation principale' });
    await expect(tiroir).toBeVisible();

    await tiroir.getByRole('link', { name: 'Registre des visites' }).click();

    // Le tiroir se referme : sinon il masque l'écran sur lequel on arrive.
    await expect(page.getByRole('link', { name: 'Registre des visites' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/accueil$/);
  });

  test('ACC-COQ-09 · la cloche s’ouvre et mène à la boîte de réception', async ({ page }) => {
    await page.goto('/accueil');

    // `bellLabel(unreadCount)` : « Notifications, aucune non lue » ou
    // « Notifications, N non lue(s) » selon l'arriéré du compte.
    await page.getByRole('button', { name: /^Notifications, .+ non lues?$/ }).click();

    const panneau = page.getByRole('menu');
    await expect(panneau.getByText('Notifications', { exact: true })).toBeVisible();

    const vide = panneau.getByText('Aucune annonce', { exact: true });
    const explication = panneau.getByText(
      'Les rappels et les demandes à traiter apparaîtront ici.',
      { exact: true },
    );
    const annonces = panneau.getByRole('list');
    await expect(vide.or(annonces).first()).toBeVisible();
    expect(
      await explication.count(),
      'un état vide sans sa phrase d’explication est indistinguable d’un chargement raté',
    ).toBe(await vide.count());

    await panneau.getByRole('link', { name: 'Tout voir' }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(
      page.getByRole('heading', { name: 'Notifications', level: 1, exact: true }),
    ).toBeVisible();
  });
});
