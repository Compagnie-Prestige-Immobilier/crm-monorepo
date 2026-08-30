import { expect, test, type Page, type Response } from '@playwright/test';

/**
 * `/admin` et `/admin/parametres`, hors publication Android.
 * ADM-ROOT-01, ADM-PAR-01 à ADM-PAR-05.
 *
 * Ce que seul un navigateur éprouve : la racine de la coque est une
 * REDIRECTION serveur, et l'écran des paramètres compose des cartes rendues par
 * quatre requêtes indépendantes — l'ordre dans lequel elles arrivent à l'écran
 * n'existe nulle part dans le code, il ne se constate qu'au rendu.
 *
 * AUCUN GESTE DESTRUCTIF. La réinitialisation de la démo appartient à
 * `demo-isolement.spec.ts` (§4.3.5), la purge ne se clique jamais (§4.3.8), et
 * l'export intégral non plus. Aucun APK n'est envoyé ni retiré ici : la carte
 * « Version Android » appartient à `android-release.spec.ts`.
 * Ce fichier n'écrit rien en base.
 */

const PARAMETRES = '/admin/parametres';

/**
 * Les titres de carte sont des `<div data-slot="card-title">`, pas des
 * `heading` : `getByRole('heading')` ne rend que « Paramètres », le titre de la
 * barre supérieure. C'est le seul repère ordonné disponible.
 */
const TITRES_DE_CARTE = '[data-slot="card-title"]';

/** Les requêtes qui portent les données propres à cet écran. */
const FAMILLE_PARAMETRES = [
  '/api/v1/admin/demo',
  '/api/v1/admin/purge',
  '/api/v1/admin/database-dump',
  '/api/v1/app-updates/android/releases',
];

/**
 * Les trois requêtes que le NAVIGATEUR émet sur cet écran.
 *
 * `/api/v1/admin/demo` n'y figure pas : la page la précharge côté serveur et la
 * réhydrate, si bien qu'aucun appel ne part du navigateur. L'attendre ferait
 * patienter jusqu'au délai du test.
 */
const ROUTES_CLIENTES = [
  '/api/v1/admin/purge',
  '/api/v1/admin/database-dump',
  '/api/v1/app-updates/android/releases',
];

/**
 * Ouvre l'écran et attend que ses trois requêtes aient RÉPONDU.
 *
 * Le catalogue de purge compte les lignes de vingt-trois tables : sur une base
 * chargée il met plusieurs dizaines de secondes. Attendre la réponse plutôt que
 * le rendu évite d'allonger un délai d'assertion, ce qui est interdit (§4.4.4),
 * et garde l'échec sur le contenu de la carte, jamais sur sa lenteur.
 */
async function ouvrirParametres(page: Page): Promise<void> {
  const reponses = ROUTES_CLIENTES.map((route) =>
    page.waitForResponse((response) => new URL(response.url()).pathname.startsWith(route)),
  );
  await page.goto(PARAMETRES);
  await Promise.all(reponses);
}

function watchSettingsData(page: Page): string[] {
  const servies: string[] = [];
  page.on('response', (response: Response) => {
    const { pathname } = new URL(response.url());
    if (response.status() >= 400) return;
    if (FAMILLE_PARAMETRES.some((route) => pathname.startsWith(route))) servies.push(pathname);
  });
  return servies;
}

test('ADM-ROOT-01 · /admin mène à la première entrée de la barre Admin', async ({ page }) => {
  await page.goto('/admin');

  await page.waitForURL(/\/admin\/commerciaux$/);
  await expect(page).toHaveTitle(/Téléconseillers/);
});

test('ADM-PAR-01 · l’écran compose ses cartes dans l’ordre', async ({ page }) => {
  await ouvrirParametres(page);
  await expect(page).toHaveTitle(/Paramètres/);
  await expect(page.getByText('Ces actions portent sur les données de tous les utilisateurs.')).toBeVisible();

  const titres = page.locator(TITRES_DE_CARTE);
  // Attente ancrée sur le NOMBRE de cartes : sans elle, l'ordre serait relevé
  // avant que la dernière requête ait répondu.
  await expect(titres.nth(3)).toBeVisible();

  // L'ordre, et pas la simple présence : mettre la purge en avant est un défaut
  // en soi. La cinquième carte, l'export intégral, relève d'ADM-PAR-04.
  expect((await titres.allTextContents()).slice(0, 4)).toEqual([
    'Espace démo',
    'Version Android',
    'Historique des versions',
    'Suppression des données',
  ]);
});

test('ADM-PAR-02 · la carte « Espace démo » chiffre son contenu', async ({ page }) => {
  await ouvrirParametres(page);

  const carte = page
    .locator('[data-slot="card"]')
    .filter({ hasText: 'Le jeu est reconstruit par la factory' });
  await expect(
    carte.getByText(
      'Le jeu est reconstruit par la factory à partir des référentiels et comptes actuels.',
    ),
  ).toBeVisible();

  await expect(carte.getByRole('term')).toHaveText([
    'comptes',
    'représentants',
    'prospects',
    'dossiers bancaires',
  ]);

  // Un compteur en squelette ou à « — » ne dit pas ce que contient la démo :
  // chaque valeur porte un nombre, séparateur de milliers compris (U+202F).
  const valeurs = await carte.getByRole('definition').allTextContents();
  expect(valeurs).toHaveLength(4);
  for (const valeur of valeurs) {
    expect(valeur, 'un compteur de l’espace démo doit porter un nombre').toMatch(
      /^\d[\d ]*$/u,
    );
  }

  // Présent, jamais cliqué : la réinitialisation appartient à un autre fichier.
  await expect(carte.getByRole('button', { name: 'Réinitialiser l’espace démo' })).toBeVisible();
});

test('ADM-PAR-03 · la carte « Suppression des données » s’annonce comme irréversible', async ({
  page,
}) => {
  await ouvrirParametres(page);

  const carte = page
    .locator('[data-slot="card"]')
    .filter({ hasText: 'Sélection par domaine. La suppression est définitive.' });

  await expect(carte.locator(TITRES_DE_CARTE)).toHaveText('Suppression des données');
  await expect(
    carte.getByText('Irréversible', { exact: true }),
    'un geste définitif ne doit jamais se présenter comme ordinaire',
  ).toBeVisible();

  // Aucun clic sur un geste de purge, jamais.
});

test('ADM-PAR-04 · la carte « Export intégral de la base » suit la configuration du serveur', async ({
  page,
}) => {
  // `DB_DUMP_ENABLED` est posé sur cet environnement : `GET
  // /api/v1/admin/database-dump` répond 200 et la carte doit donc être rendue.
  // Elle serait absente sur un déploiement où la variable ne l'est pas (§8, Q-16).
  await ouvrirParametres(page);

  const carte = page
    .locator('[data-slot="card"]')
    .filter({ hasText: 'Structure et contenu complets' });

  await expect(carte.locator(TITRES_DE_CARTE)).toHaveText('Export intégral de la base');
  await expect(
    carte.getByText(
      'Structure et contenu complets, dans une archive compressée. Réservé aux sauvegardes et aux migrations.',
    ),
  ).toBeVisible();

  // La commande existe et reste inerte : l'export n'est jamais déclenché ici.
  await expect(carte.getByRole('button', { name: 'Demander un export' })).toBeVisible();
});

/**
 * ADM-PAR-05 : les cinq autres rôles.
 *
 * Deux assertions par rôle, jamais une (§6.5) : le refus est LISIBLE, et
 * AUCUNE donnée de l'écran n'a été servie. Le second point distingue « l'écran
 * affiche un refus » de « l'écran a chargé la démo, la purge et les versions
 * Android, puis a posé un refus par-dessus ».
 */
const AUTRES_ROLES = [
  { session: 'direction', libelle: 'Direction' },
  { session: 'superviseur', libelle: 'Supervision' },
  { session: 'commercial', libelle: 'Téléconseiller' },
  { session: 'accueil', libelle: 'Accueil' },
  { session: 'banque', libelle: 'Banque & Finance' },
] as const;

for (const role of AUTRES_ROLES) {
  test.describe(`ADM-PAR-05 · ${role.session}`, () => {
    test.use({ storageState: `e2e/.auth/${role.session}.json` });

    test(`ADM-PAR-05 · les paramètres sont refusés à ${role.libelle}`, async ({ page }) => {
      const servies = watchSettingsData(page);
      await page.goto(PARAMETRES);

      const refus = page.getByRole('alert').filter({ hasText: 'Accès refusé' });
      await expect(refus.getByRole('heading', { level: 2, name: 'Accès refusé' })).toBeVisible();
      await expect(refus).toContainText(
        'Les paramètres de la plateforme est réservé à un autre rôle.',
      );
      await expect(refus, `le rôle en cours doit être nommé pour ${role.session}`).toContainText(
        `Rôle en cours : ${role.libelle}.`,
      );
      await expect(refus.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute(
        'href',
        '/espaces',
      );

      expect(
        servies,
        `${role.libelle} ne doit charger aucune donnée des paramètres`,
      ).toEqual([]);
    });
  });
}
