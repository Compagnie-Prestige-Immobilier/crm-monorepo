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
      .waitForURL(/\/(tableau-de-bord|dossiers)/, { timeout: 15_000 })
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

test('un agent Banque & Finance atterrit sur ses dossiers, pas sur le tableau de bord des prospects', async ({
  page,
}) => {
  await login(page, BANK_IDENTIFIER, BANK_PASSWORD);

  // Redirection d'après connexion : `/tableau-de-bord` lui vaudrait un 403 dès
  // la première seconde d'utilisation.
  await expect(page).toHaveURL(/\/dossiers/);
  await expect(page.getByRole('heading', { name: 'Dossiers', level: 1 })).toBeVisible();
});

test('sa navigation ne montre QUE ses écrans', async ({ page }) => {
  await login(page, BANK_IDENTIFIER, BANK_PASSWORD);

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

  // Et son « Tableau de bord » est bien le tableau de bord BANCAIRE.
  await nav.getByRole('link', { name: 'Tableau de bord', exact: true }).click();
  await expect(page).toHaveURL(/\/banque/);
});

test('une URL interdite tapée à la main rend un refus lisible, pas une page cassée', async ({
  page,
}) => {
  await login(page, BANK_IDENTIFIER, BANK_PASSWORD);

  // Le masquage du menu ne protège rien : une URL se tape, et un onglet resté
  // ouvert rejoue l'ancienne route.
  await page.goto('/prospects');
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();
  // Le refus NOMME le rôle en cours : sans lui, l'utilisateur ne sait pas quoi
  // demander à son administrateur.
  // Filtré : `getByRole('alert')` seul attraperait aussi le route-announcer de
  // Next, et le mode strict refuserait les deux correspondances.
  await expect(page.getByRole('alert').filter({ hasText: 'Accès refusé' })).toContainText(
    'Banque & Finance',
  );
  // Et il propose une sortie vers un écran qui lui est ouvert.
  // `exact` : le logo de la barre latérale est nommé « CPI GO, retour à
  // l’accueil » et satisferait une correspondance partielle.
  await expect(page.getByRole('link', { name: 'Retour à l’accueil', exact: true })).toBeVisible();

  await page.goto('/parametres');
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();

  // Les deux écrans ajoutés depuis, fermés au même rôle et par la même garde.
  await page.goto('/campagnes/representants');
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();

  await page.goto('/representants/import');
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();

  // `/demandes-clients` lui est en revanche OUVERT, et c'est le point : l'API
  // y restreint la liste à ses propres demandes, l'écran ne lui propose aucun
  // geste d'arbitrage. Un refus ici casserait la notification qui l'y envoie.
  await page.goto('/demandes-clients');
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Mes demandes', level: 1 })).toBeVisible();
});

test('un TÉLÉCONSEILLER est refusé à la porte du panel', async ({ page }) => {
  // Son outil est l'application mobile : le laisser entrer ici lui donnerait la
  // base nominative complète, là où l'annuaire de phase 2 ne lui expose qu'un
  // téléphone et un statut.
  await page.goto('/connexion');
  await page.getByLabel('E-mail ou identifiant').fill('demo.awa@cpi.sn');
  await page.getByLabel('Mot de passe').fill('Demo1-CPI-Sunugal');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  const alert = page.locator('form').getByRole('alert').first();
  await expect(alert).toBeVisible();
  // Message générique : la réponse ne doit pas permettre d'énumérer les comptes.
  await expect(alert).toContainText(/incorrects ou compte non autorisé/i);
  await expect(page).toHaveURL(/\/connexion/);
});
