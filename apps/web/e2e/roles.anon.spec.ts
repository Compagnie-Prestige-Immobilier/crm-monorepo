import { expect, test, type Page } from '@playwright/test';
import { BANQUIER, ensureWorkspaceFixtures, FIXTURE_PASSWORD, TELECONSEILLERS } from './fixtures';

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
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX connexions pour cinq parcours.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Chaque `test` ouvrait sa propre session : cinq connexions sur un point
 * d'entrée limité à DIX par minute et par IP, partagé avec tout ce qui tourne
 * en même temps. Les parcours d'un même rôle se suivent désormais en série sur
 * un contexte ouvert une fois : une connexion par rôle, et le navigateur reste
 * vierge au démarrage, ce que ces parcours éprouvent.
 */

const BANK_IDENTIFIER = process.env.E2E_BANK_IDENTIFIER ?? BANQUIER.email;
const BANK_PASSWORD = process.env.E2E_BANK_PASSWORD ?? FIXTURE_PASSWORD;

const TELECONSEILLER_IDENTIFIER =
  process.env.E2E_TELECONSEILLER_IDENTIFIER ?? TELECONSEILLERS[0].email;
const TELECONSEILLER_PASSWORD = process.env.E2E_TELECONSEILLER_PASSWORD ?? FIXTURE_PASSWORD;

/**
 * Recopié plutôt qu'importé de `auth.setup.ts`.
 *
 * Importer ce module l'exécuterait, et son appel de premier niveau à `setup()`
 * enregistrerait le parcours d'authentification DANS ce fichier-ci, donc dans
 * le projet anonyme. Le chemin est déjà écrit deux fois (ici et dans
 * `playwright.config.ts`) : c'est le prix d'une constante qui ne peut pas
 * voyager sans traîner un effet de bord.
 */
test.beforeAll(async () => {
  test.setTimeout(180_000);
  await ensureWorkspaceFixtures();
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

test.describe('Agent Banque & Finance', () => {
  // Une seule connexion pour les trois parcours : ils se suivent sur le même
  // contexte, et l'ordre compte.
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, BANK_IDENTIFIER, BANK_PASSWORD);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('un agent Banque & Finance atterrit sur le hub, dont une seule tuile lui est ouverte', async () => {
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

  test('sa navigation ne montre QUE ses écrans', async () => {
    await page.goto('/espaces');
    await ouvrirEspace(page, 'Projet CHUES');

    const nav = page.getByRole('navigation', { name: 'Navigation principale' });

    for (const visible of [
      'Vue d’ensemble',
      'Dossiers bancaires',
      'Ouvrir un dossier',
      // Le suivi de SES demandes de création de client : sans cette entrée, la
      // notification qui lui annonce un refus était le seul chemin vers l'écran.
      'Mes demandes de création',
    ]) {
      await expect(nav.getByRole('link', { name: visible, exact: true })).toBeVisible();
    }

    // L'export est rangé sous « Plus », replié : présent, mais après un clic.
    await nav.getByText('Plus', { exact: true }).click();
    await expect(
      nav.getByRole('link', { name: 'Exporter les dossiers', exact: true }),
    ).toBeVisible();

    /**
     * Le point de l'exigence : ces entrées sont ABSENTES, pas grisées. Une entrée
     * qui mène à un refus de droits est un défaut de conception.
     *
     * Les libellés sont ceux que `nav-items.ts` écrit RÉELLEMENT. « Commerciaux »
     * figurait ici alors qu'aucune entrée n'a jamais porté ce nom : l'assertion
     * passait à vide, et aurait continué de passer si le lien était devenu
     * visible. C'est le même défaut que les ignorés ci-dessus, sous une autre
     * forme. « Campagnes » y était pour la même raison : l'entrée s'appelle
     * « Lots d’export » depuis le retrait des listes d'appel.
     */
    for (const hidden of [
      'Prospects',
      'Représentants',
      'Utilisateurs',
      'Lots d’export',
      'Listes de référence',
      'Paramètres',
      'Étapes des dossiers',
      'Équipes',
      'Notifications',
      'Créations de client à valider',
    ]) {
      await expect(nav.getByRole('link', { name: hidden, exact: true })).toHaveCount(0);
    }

    // Et sa « Vue d'ensemble » est bien le tableau de bord BANCAIRE. L'adresse
    // est vérifiée EN ENTIER : `/banque` seul se satisferait de n'importe quelle
    // route qui contient le mot.
    await nav.getByRole('link', { name: 'Vue d’ensemble', exact: true }).click();
    await expect(page).toHaveURL(/\/chues\/banque$/);
  });

  test('une URL interdite tapée à la main rend un refus lisible, pas une page cassée', async () => {
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
    await expect(
      page.getByRole('link', { name: 'Retour à l’accueil', exact: true }),
    ).toHaveAttribute('href', '/espaces');

    await page.goto('/admin/parametres');
    await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();

    await page.goto('/chues/representants/import');
    await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();

    /**
     * `/chues/campagnes/representants` ne rend plus un refus LISIBLE : l'écran
     * a été supprimé (`Plan.md`, retrait des listes d'appel) et l'adresse est
     * captée par le segment `chues/campagnes/[id]`, dont la garde
     * (`ADMIN`, `SUPERVISEUR`, `DIRECTION`) fait `redirect('/chues')` au lieu
     * de rendre `PermissionDenied`. Pour un agent bancaire, `/chues` renvoie à
     * son tour sur son propre tableau de bord. L'écran reste hors de portée,
     * mais sans un mot : c'est ce qu'on constate, pas un contrat.
     */
    await page.goto('/chues/campagnes/representants');
    await expect(page).toHaveURL(/\/chues\/banque$/);

    // `/chues/demandes-clients` lui est en revanche OUVERT, et c'est le point :
    // l'API y restreint la liste à ses propres demandes, l'écran ne lui propose
    // aucun geste d'arbitrage. Un refus ici casserait la notification qui l'y
    // envoie.
    await page.goto('/chues/demandes-clients');
    await expect(page.getByRole('heading', { name: 'Accès refusé' })).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Mes demandes de création', level: 1 }),
    ).toBeVisible();
  });
});

/**
 * Le panel est OUVERT au téléconseiller depuis « ouvrir le panneau aux
 * teleconseillers, avec une section Terrain ». Ce fichier éprouvait l'inverse,
 * et c'est la seule couverture du nouvel atterrissage.
 */
test.describe('Téléconseiller', () => {
  // Une seule connexion pour les deux parcours, comme ci-dessus.
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page, TELECONSEILLER_IDENTIFIER, TELECONSEILLER_PASSWORD);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('un téléconseiller ouvre CHUES sur ses trois étapes, sans boucle de redirection', async () => {
    await expect(page).toHaveURL(/\/espaces$/);
    await attendreTuilesFermees(page, ['Accueil', 'Admin']);

    await ouvrirEspace(page, 'Projet CHUES');
    await page.waitForURL('**/chues');
    // Le titre du DOCUMENT, posé par la page et non par la barre supérieure : il
    // ne dépend pas de ce que la file d'appels contient ce jour-là.
    await expect(page).toHaveTitle(/Projet CHUES/);
    await expect(page.getByText('Trois étapes, dans l’ordre.')).toBeVisible();

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

  test('sa navigation compte ses étapes, et le pilotage lui reste fermé', async () => {
    await page.goto('/espaces');
    await ouvrirEspace(page, 'Projet CHUES');

    const nav = page.getByRole('navigation', { name: 'Navigation principale' });

    /**
     * Cinq entrées, dans l'ordre du travail : le hub, les trois étapes, les
     * rappels. Les intitulés sont ceux de `nav-items.ts` : les trois étapes ont
     * perdu leur numérotation et disent maintenant le GESTE
     * (« Qualifier un représentant ») et non l'objet appelé
     * (« 1 · Appeler les représentants »).
     */
    for (const visible of [
      'Mon travail',
      'Qualifier un représentant',
      'Ajouter un prospect',
      'Convertir un prospect',
      'Rappels promis',
    ]) {
      await expect(nav.getByRole('link', { name: visible, exact: true })).toBeVisible();
    }

    // Ce qui sert moins souvent est REPLIÉ, pas retiré. « Mes représentants » et
    // « Mes prospects » ont perdu leur possessif : l'API borne déjà la liste au
    // périmètre de qui la demande.
    await expect(nav.getByRole('link', { name: 'Prospects', exact: true })).toHaveCount(0);
    await nav.getByText('Plus', { exact: true }).click();
    for (const replie of ['Contacts recommandés', 'Représentants', 'Prospects']) {
      await expect(nav.getByRole('link', { name: replie, exact: true })).toBeVisible();
    }

    /**
     * `exact` : sans lui, « Équipes » matcherait aussi une entrée dont le
     * libellé la contient. Les entrées d'administration relèvent maintenant
     * d'une AUTRE coque : ce qui les tient hors de portée est la tuile grisée du
     * hub, éprouvée dans le parcours d'atterrissage.
     *
     * « Chiffres » et « Campagnes » n'existent plus nulle part : l'écran de
     * pilotage s'appelle « Tableau de bord », les listes d'appel sont devenues
     * des « Lots d’export », et l'activité de l'équipe « Mon équipe » pour
     * l'encadrement. Les trois sont nommés ici sous leur intitulé réel, sans
     * quoi l'assertion passait à vide.
     */
    for (const hidden of [
      'Tableau de bord',
      'Lots d’export',
      'Mon équipe',
      'Équipes',
      'Utilisateurs',
      'Listes de référence',
      'Importer un fichier Excel',
      'Paramètres',
      'Dossiers bancaires',
      'Étapes des dossiers',
      'Créations de client à valider',
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

    /**
     * Les deux adresses des listes d'appel, sorties de la boucle : elles ne
     * rendent plus un refus lisible.
     *
     * Les deux font `redirect('/chues')` au lieu de rendre `PermissionDenied`
     * (`app/(panel)/chues/campagnes/page.tsx` et `campagnes/[id]/page.tsx`) :
     * le téléconseiller est renvoyé sans savoir pourquoi. L'écran des
     * campagnes de représentants a en outre été supprimé, et son adresse est
     * captée par le segment `[id]`. Écrans en réécriture.
     */
    for (const renvoi of ['/chues/campagnes', '/chues/campagnes/representants']) {
      await page.goto(renvoi);
      await expect(page, `${renvoi} devrait renvoyer un téléconseiller sur /chues`).toHaveURL(
        /\/chues$/,
      );
    }

    // Le dernier refus lisible de la boucle, à relire pour le rôle nommé.
    await page.goto('/chues/dossiers');

    // Le refus NOMME le rôle en cours, et propose une sortie vers le hub.
    await expect(page.getByRole('alert').filter({ hasText: 'Accès refusé' })).toContainText(
      'Téléconseiller',
    );
    await expect(
      page.getByRole('link', { name: 'Retour à l’accueil', exact: true }),
    ).toHaveAttribute('href', '/espaces');
  });
});
