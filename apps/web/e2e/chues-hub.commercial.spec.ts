import { expect, test, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * `/chues`, l'écran d'ouverture du projet, vu par un TÉLÉCONSEILLER
 * (`fixture.awa@cpi.sn`). CHU-HUB-01 à 06 et 08, CHU-TRV-01, CHU-TRV-05.
 *
 * Aucune donnée n'est créée : ce fichier n'a ni préfixe ni plage de téléphones
 * réservée (§5.5). Les préconditions se LISENT par l'API d'administration et
 * nomment ce qui manque quand la base n'en fournit pas.
 */
test.use({ storageState: 'e2e/.auth/commercial.json' });

/** Le hub et la barre latérale portent les mêmes intitulés : on borne à la page. */
const contenu = (page: Page) => page.getByRole('main');

const ETAPES = [
  { titre: 'Qualifier un représentant', href: '/chues/appels-representants' },
  { titre: 'Ajouter un prospect', href: '/chues/prospects/nouveau' },
  { titre: 'Convertir un prospect', href: '/chues/console' },
] as const;

test('CHU-HUB-01 l’écran d’ouverture nomme le téléconseiller et ses trois étapes', async ({
  page,
}) => {
  await page.goto('/chues');

  await expect(page.getByRole('heading', { level: 1, name: 'Projet CHUES' })).toBeVisible();
  await expect(page).toHaveTitle(/Projet CHUES/);

  // Le prénom est EXTRAIT du nom complet « Awa Fixture » : « Bonjour Awa
  // Fixture. » serait le défaut que ce scénario attrape.
  await expect(
    contenu(page).getByText('Bonjour Awa. Trois étapes, dans l’ordre.', { exact: true }),
  ).toBeVisible();

  await expect(contenu(page).getByRole('heading', { level: 2 })).toHaveText([
    'Qualifier un représentant',
    'Ajouter un prospect',
    'Convertir un prospect',
  ]);
});

test('CHU-HUB-02 chaque étape mène à sa route', async ({ page }) => {
  for (const etape of ETAPES) {
    await page.goto('/chues');
    await contenu(page).getByRole('link', { name: etape.titre, exact: true }).click();
    await expect(page, `« ${etape.titre} » doit mener à ${etape.href}`).toHaveURL(
      new RegExp(`${etape.href.replaceAll('/', '\\/')}$`),
    );
  }
});

test('CHU-HUB-03 les trois gestes sont des liens, pas des boutons', async ({ page }) => {
  await page.goto('/chues');

  for (const etape of ETAPES) {
    await expect(
      contenu(page).getByRole('link', { name: etape.titre, exact: true }),
    ).toHaveAttribute('href', etape.href);

    // Une primitive Base UI qui reposerait `role="button"` sur le `<a>` retire
    // l'ouverture dans un nouvel onglet et le menu contextuel.
    await expect(
      page.getByRole('button', { name: etape.titre, exact: true }),
      `« ${etape.titre} » ne doit exposer aucun rôle bouton`,
    ).toHaveCount(0);
  }
});

test('CHU-HUB-04 un compteur ne montre jamais un zéro provisoire', async ({ page }) => {
  let interceptions = 0;
  // Le délai est posé sur le RÉSEAU, jamais dans le test (§4.5).
  await page.route('**/api/v1/representants**', async (route) => {
    interceptions += 1;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.continue();
  });

  const ouverture = page.goto('/chues');
  await expect(contenu(page).getByText('0 pas encore appelés', { exact: true })).toHaveCount(0);
  await ouverture;

  await expect(contenu(page).getByText(/^\d+ pas encore appelés$/)).toBeVisible();
  expect(
    interceptions,
    'le compteur « pas encore appelés » n’a émis aucune requête depuis le navigateur : ' +
      'GET /api/v1/representants est résolu côté serveur par le préchargement de ' +
      'app/(panel)/chues/page.tsx, donc l’état d’attente du squelette est hors de portée du test',
  ).toBeGreaterThan(0);
});

test('CHU-HUB-05 un compteur en erreur affiche un tiret, pas un zéro', async ({ page }) => {
  let interceptions = 0;
  await page.route('**/api/v1/representants**', async (route) => {
    interceptions += 1;
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 500, message: 'Panne simulée' }),
    });
  });

  await page.goto('/chues');
  await expect(contenu(page).getByText('pas encore appelés')).toBeVisible();

  expect(
    interceptions,
    'le compteur « pas encore appelés » n’a émis aucune requête depuis le navigateur : ' +
      'GET /api/v1/representants est résolu côté serveur par le préchargement de ' +
      'app/(panel)/chues/page.tsx, donc la branche d’erreur de `Chiffre` est inatteignable',
  ).toBeGreaterThan(0);

  await expect(contenu(page).getByText('– pas encore appelés', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Serveur injoignable' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Chargement impossible' })).toHaveCount(0);
});

test('CHU-HUB-06 la pastille « À faire maintenant » désigne la première étape qui a du travail', async ({
  page,
}) => {
  const api = await adminApi();
  try {
    const reponse = await api.get('/api/v1/representants', {
      params: { relationStatus: 'INCONNU', pageSize: '1' },
    });
    expect(reponse.ok(), `GET /api/v1/representants a répondu ${String(reponse.status())}`).toBe(
      true,
    );
    const page1 = (await reponse.json()) as { meta: { total: number } };
    expect(
      page1.meta.total,
      'précondition absente : aucun représentant en relation INCONNU, la pastille ne peut pas désigner l’étape 1',
    ).toBeGreaterThan(0);
  } finally {
    await api.dispose();
  }

  await page.goto('/chues');

  await expect(contenu(page).getByText('À faire maintenant', { exact: true })).toHaveCount(1);
  await expect(
    contenu(page)
      .getByRole('listitem')
      .filter({ hasText: 'Qualifier un représentant' })
      .getByText('À faire maintenant', { exact: true }),
  ).toBeVisible();
});

test('CHU-HUB-08 l’écran tient sur 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/chues');

  await expect(contenu(page).getByRole('heading', { level: 2 })).toHaveText([
    'Qualifier un représentant',
    'Ajouter un prospect',
    'Convertir un prospect',
  ]);

  for (const etape of ETAPES) {
    await expect(contenu(page).getByRole('link', { name: etape.titre, exact: true })).toBeVisible();
  }

  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeur, 'la grille md:grid-cols-3 fuit horizontalement sous 375 px').toBeLessThanOrEqual(
    375,
  );

  // La dernière carte est la plus basse : la cliquer prouve qu'elle reste
  // atteignable et que le lien n'est pas recouvert.
  await contenu(page).getByRole('link', { name: 'Convertir un prospect', exact: true }).click();
  await expect(page).toHaveURL(/\/chues\/console$/);
});

test('CHU-TRV-01 le jeton de session reste hors de portée du JavaScript sur un écran CHUES', async ({
  page,
}) => {
  await page.goto('/chues');
  await expect(page.getByRole('heading', { level: 1, name: 'Projet CHUES' })).toBeVisible();

  const lisibleParScript = await page.evaluate(() => document.cookie);
  expect(lisibleParScript).not.toContain('cpi_at');
  expect(lisibleParScript).not.toContain('cpi_rt');

  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === 'cpi_at')?.httpOnly).toBe(true);
  expect(cookies.find((cookie) => cookie.name === 'cpi_rt')?.httpOnly).toBe(true);
});

test('CHU-TRV-05 la navigation d’un téléconseiller nomme les trois étapes telles qu’elles s’appellent', async ({
  page,
}) => {
  await page.goto('/chues');
  const navigation = page.getByRole('navigation', { name: 'Navigation principale' });

  for (const label of [
    'Mon travail',
    'Qualifier un représentant',
    'Ajouter un prospect',
    'Convertir un prospect',
    'Rappels promis',
  ]) {
    await expect(
      navigation.getByRole('link', { name: label, exact: true }),
      `« ${label} » doit figurer dans la navigation d’un téléconseiller`,
    ).toBeVisible();
  }

  for (const label of ['Tableau de bord', 'Lots d’export', 'Mon équipe']) {
    await expect(
      navigation.getByRole('link', { name: label, exact: true }),
      `« ${label} » est réservé à l’encadrement`,
    ).toHaveCount(0);
  }
});
