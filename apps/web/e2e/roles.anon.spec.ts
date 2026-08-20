import { expect, request, test, type Page } from '@playwright/test';

/**
 * Navigation dépendante du rôle, éprouvée SUR UN VRAI NAVIGATEUR.
 *
 * `nav-items.test.ts` fixe déjà la liste attendue par rôle, en unitaire. Ce que
 * seul un navigateur montre, c'est que le rôle lu sur la session serveur
 * atteint bien la barre latérale, que la redirection d'après connexion mène là
 * où l'API ne répondra pas 403, et qu'une URL tapée à la main sur un écran
 * interdit rend un refus lisible plutôt qu'une page cassée.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi une connexion ratée FAIT ÉCHOUER, et n'ignore plus.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ces trois parcours étaient gardés par `test.skip(!ok)`, `ok` venant d'une
 * connexion terminée par `.catch(() => false)`. Trois causes très différentes
 * tombaient donc dans le même seau : compte de démonstration absent, délai
 * dépassé, 429 du limiteur de débit. Toutes rendaient la suite VERTE.
 *
 * Or ce fichier porte la SEULE couverture de la restriction de navigation d'un
 * agent BANQUE_FINANCE et de l'écran « Accès refusé ». Une couverture qui
 * s'efface d'elle-même dès que quelque chose va mal est pire que pas de
 * couverture : elle se lit comme une garantie, et l'ignoré ne se remarque pas
 * dans un rapport de mille lignes.
 *
 * La précondition n'est donc plus ESPÉRÉE, elle est POSÉE : `beforeAll` allume
 * le mode démonstration si besoin (le compte BANQUE_FINANCE n'existe que par
 * lui, voir `packages/database/src/demo/users.ts`), et `afterAll` remet
 * l'environnement dans l'état trouvé. Après cela, un échec de connexion n'a
 * plus d'excuse légitime : il est signalé comme tel.
 *
 * `.anon.spec.ts` : ces parcours doivent partir d'un navigateur VIERGE, sans
 * l'état d'administrateur partagé, puisque c'est justement la connexion qu'ils
 * éprouvent.
 */

const BANK_IDENTIFIER = process.env.E2E_BANK_IDENTIFIER ?? 'demo.banque@cpi.sn';
const BANK_PASSWORD = process.env.E2E_BANK_PASSWORD ?? 'Demo1-CPI-Sunugal';

/** Même provenance que le compte bancaire : le jeu de démonstration semé ci-dessous. */
const TELECONSEILLER_IDENTIFIER = process.env.E2E_TELECONSEILLER_IDENTIFIER ?? 'demo.awa@cpi.sn';
const TELECONSEILLER_PASSWORD = process.env.E2E_TELECONSEILLER_PASSWORD ?? 'Demo1-CPI-Sunugal';

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

/**
 * Recopié plutôt qu'importé de `auth.setup.ts`.
 *
 * Importer ce module l'exécuterait, et son appel de premier niveau à `setup()`
 * enregistrerait le parcours d'authentification DANS ce fichier-ci, donc dans
 * le projet anonyme. Le chemin est déjà écrit deux fois (ici et dans
 * `playwright.config.ts`) : c'est le prix d'une constante qui ne peut pas
 * voyager sans traîner un effet de bord.
 */
const ADMIN_STORAGE_STATE = 'e2e/.auth/admin.json';

/** Vrai si c'est CE fichier qui a allumé le mode démonstration. */
let seededHere = false;

/**
 * Le mode démonstration est posé par l'API, pas par le navigateur.
 *
 * On emprunte le relais `/api/v1/*` de Next avec l'état de session de
 * l'administrateur déjà rangé sur disque : aucune connexion supplémentaire
 * n'est consommée, alors que l'API n'en accepte que dix par minute et par IP,
 * et que le projet anonyme en dépense déjà huit.
 */
test.beforeAll(async () => {
  // L'ensemencement écrit plusieurs milliers de lignes : le délai par défaut
  // d'un crochet est celui d'un test, et il ne suffit pas.
  test.setTimeout(180_000);

  const api = await request.newContext({
    baseURL: WEB_URL,
    storageState: ADMIN_STORAGE_STATE,
  });

  try {
    const status = await api.get('/api/v1/admin/demo');
    expect(
      status.ok(),
      `L’état du mode démonstration n’a pas pu être lu (${String(status.status())}). ` +
        'Vérifiez que la pile est démarrée et que `e2e/.auth/admin.json` est frais.',
    ).toBe(true);

    const { enabled } = (await status.json()) as { enabled: boolean };
    if (enabled) return;

    const enable = await api.post('/api/v1/admin/demo/enable', { timeout: 150_000 });
    expect(
      enable.ok(),
      `Le mode démonstration n’a pas pu être activé (${String(enable.status())}). ` +
        'Sans lui, le compte BANQUE_FINANCE de démonstration n’existe pas et ces ' +
        'parcours n’ont rien à éprouver.',
    ).toBe(true);
    seededHere = true;
  } finally {
    await api.dispose();
  }
});

/**
 * On ne laisse pas derrière soi ce qu'on a semé.
 *
 * `purge` et non `disable` : la désactivation ne fait que masquer les lignes,
 * et une base de développement qui accumule un jeu de démonstration invisible
 * par exécution finit par mentir sur ses compteurs.
 */
test.afterAll(async () => {
  if (!seededHere) return;
  test.setTimeout(180_000);

  const api = await request.newContext({
    baseURL: WEB_URL,
    storageState: ADMIN_STORAGE_STATE,
  });
  try {
    await api.post('/api/v1/admin/demo/purge', { timeout: 150_000 });
  } finally {
    await api.dispose();
  }
});

/**
 * Se connecte, ou fait ÉCHOUER le parcours en nommant ce qui a été rendu.
 *
 * Le `.catch(() => false)` d'origine confondait un refus d'identifiants avec un
 * délai dépassé, et rendait les deux silencieux. Ici, chaque issue porte son
 * message : l'alerte du serveur quand il refuse, la mention du délai sinon.
 */
async function login(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto('/connexion');
  await page.getByLabel('E-mail ou identifiant').fill(identifier);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();

  /**
   * L'alerte est cherchée DANS LE FORMULAIRE, et c'est tout le sujet.
   *
   * `page.getByRole('alert')` attrapait aussi le route-announcer de Next, un
   * élément global qui annonce le titre de la page à chaque navigation cliente.
   * À la connexion réussie il affiche « Dossiers bancaires · CPI GO » — et il
   * gagnait la course contre `waitForURL`. Le parcours concluait donc au refus
   * d'identifiants alors que la session venait d'être posée et que le
   * navigateur était déjà sur `/dossiers`.
   *
   * Le refus du serveur, lui, est rendu à l'intérieur du `<form>`.
   */
  const alert = page.locator('form').getByRole('alert').first();

  // Un refus laisse sur /connexion avec une alerte : on le distingue d'une
  // réussite plutôt que d'attendre en vain une URL qui ne viendra pas.
  const landed = await Promise.race([
    page
      .waitForURL(/\/espaces$/, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false),
    alert
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => false)
      .catch(() => false),
  ]);

  if (landed) return;

  // Le message du serveur, s'il y en a un : « identifiants incorrects » et
  // « aucune réponse en quinze secondes » n'appellent pas la même correction.
  const reason = (await alert.textContent().catch(() => null))?.trim();
  throw new Error(
    `Connexion refusée pour ${identifier}.\n` +
      (reason === undefined || reason === ''
        ? 'Aucune alerte affichée : le panel n’a pas répondu dans les quinze secondes.'
        : `Le panel a répondu : « ${reason} »`) +
      '\nCe compte vient du JEU DE DÉMONSTRATION. Le crochet `beforeAll` de ce ' +
      'fichier l’ensemence : s’il a abouti et que la connexion échoue tout de ' +
      'même, c’est le compte ou le limiteur de débit qu’il faut regarder, pas ' +
      'la précondition.',
  );
}

/**
 * Ouvre une tuile du hub, seul chemin vers un écran depuis la connexion.
 *
 * L'atterrissage est le même pour TOUS les rôles depuis le découpage en
 * quatre espaces : c'est la tuile qui décide de l'écran, et elle ne mène pas
 * au même endroit selon le rôle.
 */
async function ouvrirEspace(page: Page, label: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Choisissez un espace', level: 1 })).toBeVisible();
  await page
    .getByRole('main')
    .getByRole('link', { name: new RegExp(`^${label}`) })
    .click();
}

/** Les tuiles hors de portée sont MONTRÉES et GRISÉES, jamais cliquables. */
async function attendreTuilesFermees(page: Page, labels: readonly string[]): Promise<void> {
  const hub = page.getByRole('main');
  for (const label of labels) {
    const tuile = hub.getByRole('listitem').filter({ hasText: label });
    await expect(tuile, label).toContainText('Réservé à d’autres profils');
    await expect(tuile.getByRole('link'), label).toHaveCount(0);
  }
}

test('un agent Banque & Finance atterrit sur le hub, dont une seule tuile lui est ouverte', async ({
  page,
}) => {
  await login(page, BANK_IDENTIFIER, BANK_PASSWORD);

  await expect(page).toHaveURL(/\/espaces$/);
  await attendreTuilesFermees(page, ['Accueil', 'Projet Grand Public', 'Admin']);

  // Sa tuile CHUES ouvre le tableau de bord BANCAIRE : celui des prospects lui
  // vaudrait un 403 dès la première seconde d'utilisation.
  await ouvrirEspace(page, 'Projet CHUES');
  await page.waitForURL('**/chues/banque');
  // Le titre du DOCUMENT, que seule la page pose : le titre de niveau 1 est
  // dérivé de la route par la barre supérieure et vaudrait aussi pour une page
  // qui n'a rien rendu.
  await expect(page).toHaveTitle(/Tableau de bord bancaire/);
});

test('sa navigation ne montre QUE ses écrans', async ({ page }) => {
  await login(page, BANK_IDENTIFIER, BANK_PASSWORD);
  await ouvrirEspace(page, 'Projet CHUES');

  const nav = page.getByRole('navigation', { name: 'Navigation principale' });

  for (const visible of [
    'Tableau de bord',
    'Dossiers',
    'Nouveau dossier',
    'Export',
    // Le suivi de SES demandes de création de client : sans cette entrée, la
    // notification qui lui annonce un refus était le seul chemin vers l'écran.
    'Mes demandes',
  ]) {
    await expect(nav.getByRole('link', { name: visible, exact: true })).toBeVisible();
  }

  /**
   * Le point de l'exigence : ces entrées sont ABSENTES, pas grisées. Une entrée
   * qui mène à un refus de droits est un défaut de conception.
   *
   * Les libellés sont ceux que `nav-items.ts` écrit RÉELLEMENT. « Commerciaux »
   * figurait ici alors qu'aucune entrée n'a jamais porté ce nom : l'assertion
   * passait à vide, et aurait continué de passer si le lien était devenu
   * visible. C'est le même défaut que les ignorés ci-dessus, sous une autre
   * forme.
   */
  for (const hidden of [
    'Prospects',
    'Représentants',
    'Utilisateurs',
    'Campagnes',
    'Référentiels',
    'Paramètres',
    'Étapes bancaires',
    'Supervision',
    'Notifications',
    'Demandes clients',
  ]) {
    await expect(nav.getByRole('link', { name: hidden, exact: true })).toHaveCount(0);
  }

  // Et son « Tableau de bord » est bien le tableau de bord BANCAIRE. L'adresse
  // est vérifiée EN ENTIER : `/banque` seul se satisferait de n'importe quelle
  // route qui contient le mot.
  await nav.getByRole('link', { name: 'Tableau de bord', exact: true }).click();
  await expect(page).toHaveURL(/\/chues\/banque$/);
});

test('une URL interdite tapée à la main rend un refus lisible, pas une page cassée', async ({
  page,
}) => {
  await login(page, BANK_IDENTIFIER, BANK_PASSWORD);

  // Le masquage du menu ne protège rien : une URL se tape, et un onglet resté
  // ouvert rejoue la route.
  await page.goto('/chues/prospects');
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();
  // Le refus NOMME le rôle en cours : sans lui, l'utilisateur ne sait pas quoi
  // demander à son administrateur.
  // Filtré : `getByRole('alert')` seul attraperait aussi le route-announcer de
  // Next, et le mode strict refuserait les deux correspondances.
  await expect(page.getByRole('alert').filter({ hasText: 'Accès refusé' })).toContainText(
    'Banque & Finance',
  );
  // Et il propose une sortie : le hub, désormais, et non plus un écran de
  // travail. C'est le seul endroit qui vaille pour tous les rôles.
  await expect(page.getByRole('link', { name: 'Retour à l’accueil', exact: true })).toHaveAttribute(
    'href',
    '/espaces',
  );

  await page.goto('/admin/parametres');
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();

  // Les deux écrans ajoutés depuis, fermés au même rôle et par la même garde.
  await page.goto('/chues/campagnes/representants');
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();

  await page.goto('/chues/representants/import');
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();

  // `/chues/demandes-clients` lui est en revanche OUVERT, et c'est le point :
  // l'API y restreint la liste à ses propres demandes, l'écran ne lui propose
  // aucun geste d'arbitrage. Un refus ici casserait la notification qui l'y
  // envoie.
  await page.goto('/chues/demandes-clients');
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Mes demandes', level: 1 })).toBeVisible();
});

/**
 * Le panel est OUVERT au téléconseiller depuis « ouvrir le panneau aux
 * teleconseillers, avec une section Terrain ». Ce fichier éprouvait l'inverse,
 * et c'est la seule couverture du nouvel atterrissage.
 */
test('un téléconseiller ouvre CHUES sur sa console, sans boucle de redirection', async ({
  page,
}) => {
  await login(page, TELECONSEILLER_IDENTIFIER, TELECONSEILLER_PASSWORD);

  await expect(page).toHaveURL(/\/espaces$/);
  await attendreTuilesFermees(page, ['Accueil', 'Admin']);

  await ouvrirEspace(page, 'Projet CHUES');
  await page.waitForURL('**/chues/console');
  // Le titre du DOCUMENT, posé par la page et non par la barre supérieure : il
  // ne dépend pas de ce que la file d'appels contient ce jour-là.
  await expect(page).toHaveTitle(/Console d’appel/);

  /**
   * Les deux routes qui ont déjà bouclé : `/` et `/connexion` renvoient toutes
   * deux vers le hub, et le hub ne doit pas renvoyer ailleurs. Un aller-retour
   * infini se solderait ici par un délai dépassé, pas par une assertion
   * fausse : `waitForURL` est ce qui le nomme.
   */
  for (const entry of ['/', '/connexion']) {
    await page.goto(entry);
    await page.waitForURL('**/espaces');
    await expect(
      page.getByRole('heading', { name: 'Choisissez un espace', level: 1 }),
    ).toBeVisible();
  }
});

test('sa navigation se limite au Terrain, et le pilotage lui reste fermé', async ({ page }) => {
  await login(page, TELECONSEILLER_IDENTIFIER, TELECONSEILLER_PASSWORD);
  await ouvrirEspace(page, 'Projet CHUES');

  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav.getByRole('heading', { name: 'Terrain', level: 2 })).toBeVisible();

  for (const visible of [
    'Console d’appel',
    'Rappels',
    'Représentants',
    'Numéros suggérés',
    'Nouveau prospect',
  ]) {
    await expect(nav.getByRole('link', { name: visible, exact: true })).toBeVisible();
  }

  // `exact` : sans lui, « Supervision » matcherait aussi une entrée dont le
  // libellé la contient. Les entrées d'administration relèvent maintenant
  // d'une AUTRE coque : ce qui les tient hors de portée est la tuile grisée du
  // hub, éprouvée dans le parcours d'atterrissage.
  for (const hidden of [
    'Tableau de bord',
    'Statistiques',
    'Prospects',
    'Campagnes',
    'Supervision',
    'Utilisateurs',
    'Référentiels',
    'Imports',
    'Paramètres',
    'Dossiers',
    'Étapes bancaires',
    'Demandes clients',
  ]) {
    await expect(nav.getByRole('link', { name: hidden, exact: true })).toHaveCount(0);
  }

  /**
   * Le masquage du menu ne protège rien : c'est la garde serveur qui décide.
   * Chaque écran de pilotage est donc redemandé PAR SON URL.
   */
  for (const forbidden of [
    '/chues/tableau-de-bord',
    '/chues/statistiques',
    '/chues/campagnes',
    '/chues/campagnes/representants',
    '/admin/commerciaux',
    '/chues/supervision',
    '/admin/referentiels',
    '/admin/imports',
    '/admin/parametres',
    '/chues/representants/import',
    '/chues/dossiers',
  ]) {
    await page.goto(forbidden);
    await expect(
      page.getByRole('heading', { name: 'Accès refusé', level: 2 }),
      `${forbidden} devrait être refusé à un téléconseiller`,
    ).toBeVisible();
  }

  // Le refus NOMME le rôle en cours, et propose une sortie vers le hub.
  await expect(page.getByRole('alert').filter({ hasText: 'Accès refusé' })).toContainText(
    'Téléconseiller',
  );
  await expect(page.getByRole('link', { name: 'Retour à l’accueil', exact: true })).toHaveAttribute(
    'href',
    '/espaces',
  );
});
