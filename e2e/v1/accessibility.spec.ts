import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Tous les écrans panel accessibles à un ADMIN depuis la navigation actuelle.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Trois colonnes, et la troisième n'est pas décorative.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le titre de niveau 1 est celui de la barre supérieure, DÉRIVÉ DE LA ROUTE par
 * `navTitle` et non rendu par la page. Plusieurs écrans héritent donc d'un
 * titre qui n'est pas le leur : `/chues/representants/import` affiche
 * « Importer des représentants », `/chues/console` affiche « Convertir un
 * prospect ». S'arrêter à ce titre reviendrait à analyser une coquille montée
 * par le layout alors que la page, elle, n'a peut-être rien affiché : axe ne
 * trouverait aucune violation, et pour cause.
 *
 * Le troisième élément nomme donc un repère PROPRE à l'écran, quand le titre
 * ne suffit pas à prouver qu'on est bien arrivé.
 *
 * Les adresses sont celles des QUATRE COQUES. Les anciennes racines
 * (`/prospects`, `/console`, `/campagnes`…) ne sont plus que des renvois tenus
 * par `app/moved-routes.ts` : les balayer auditait la page d'arrivée après une
 * redirection, et sous le titre de niveau 1 d'AVANT le découpage.
 */
const PANEL_ROUTES: readonly (readonly [path: string, heading: string, marker: string | null])[] = [
  // Le hub, atterrissage de tous les rôles. Son titre est celui de la PAGE et
  // non de la barre supérieure, qu'il ne porte pas : aucun repère à ajouter.
  ['/espaces', 'Choisissez un espace', null],
  ['/chues', 'Projet CHUES', 'Trois étapes, dans l’ordre'],
  // Une seule adresse pour un seul écran : `/tableau-de-bord` et
  // `/statistiques` menaient déjà tous deux ici, et `/chues/tableau-de-bord`
  // n'est plus qu'un `permanentRedirect`. Les auditer séparément analysait
  // deux fois la même page pour le prix de deux minutes de quota.
  ['/chues/statistiques', 'Tableau de bord', 'Composer l’écran'],
  ['/chues/prospects', 'Prospects', null],
  ['/chues/prospects/nouveau', 'Ajouter un prospect', 'Enregistrer ce prospect'],
  // « Organiser les graphiques » ici, « Composer l’écran » sur les écrans de
  // chiffres : `BarreEdition` porte deux intitulés, un par écran.
  ['/accueil/tableau-de-bord', 'Tableau de bord', 'Organiser les graphiques'],
  // Les campagnes sont un onglet du pilotage : le titre de l'écran est celui du tableau de bord.
  ['/chues/campagnes', 'Tableau de bord', 'Une campagne répartit des fiches'],
  /**
   * L'écran des campagnes de représentants a été SUPPRIMÉ (`Plan.md`), mais son
   * adresse n'est pas devenue une 404 : le segment dynamique
   * `chues/campagnes/[id]` la capte avec `id = "representants"` et
   * l'API refuse l'identifiant et l'écran dit « Requête refusée ». La ligne
   * reste : c'est cet écran-là que le terrain voit, et c'est lui qu'on audite.
   */
  ['/chues/campagnes/representants', 'Tableau de bord', 'Requête refusée'],
  // `ConsoleView` a été vidé : plus de file d'appels ni de carte clavier, un
  // titre de page et un lien vers l'annuaire.
  [
    '/chues/console',
    'Convertir un prospect',
    'Vos fiches et celles que vos campagnes vous ont confiées.',
  ],
  // `RepScript` s'ouvre désormais sur un ANNUAIRE cherchable ; la carte clavier
  // n'apparaît qu'une fois un représentant choisi.
  ['/chues/appels-representants', 'Qualifier un représentant', null],
  ['/chues/rappels', 'Rappels', 'En retard'],
  ['/chues/suggestions', 'Contacts recommandés', 'Numéros donnés par un représentant'],
  ['/chues/dossiers', 'Dossiers bancaires', null],
  ['/chues/dossiers/nouveau', 'Nouveau dossier', null],
  ['/chues/dossiers/export', 'Exporter les dossiers', null],
  ['/chues/dossiers/etapes', 'Étapes des dossiers', null],
  ['/chues/demandes-clients', 'Créations de client à valider', null],
  ['/chues/representants', 'Représentants', null],
  ['/chues/representants/import', 'Importer des représentants', 'Partir du modèle'],
  ['/admin/commerciaux', 'Utilisateurs', null],
  ['/chues/supervision', 'Tableau de bord', 'Activité'],
  ['/admin/referentiels', 'Listes de référence', null],
  ['/admin/imports', 'Importer un fichier Excel', 'Déposer un classeur'],
  ['/admin/parametres', 'Paramètres', null],
  // `/notifications` renvoie l'ADMIN sur le COMPOSEUR, qui porte le même
  // onglet « Boîte de réception » : c'est le composeur qu'on audite.
  ['/admin/notifications', 'Envoyer une notification', 'Boîte de réception'],
  // Pour l'ADMIN, `/chues/banque` est l'onglet « Banque » du tableau de bord.
  ['/chues/banque', 'Tableau de bord', 'Banque'],
];

async function analyze(page: Page, where: string): Promise<void> {
  // Le serveur de developpement compile la route a la demande: sans cette
  // attente, axe audite parfois le document intermediaire, qui n'a ni titre ni
  // contenu. Le defaut rapporte serait alors celui de l'outillage, pas du produit.
  await expect(page).toHaveTitle(/\S/);
  await page.addStyleTag({
    content: '* { animation: none !important; transition: none !important; }',
  });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, `${where}: ${JSON.stringify(results.violations)}`).toEqual([]);
}

/**
 * UN TEST PAR ÉCRAN, et non plus une seule boucle.
 *
 * La boucle unique s'arrêtait sur le premier écran fautif : les vingt suivants
 * n'étaient jamais audités, et le rapport ne nommait qu'un défaut. Elle passait
 * en outre les soixante secondes de `timeout` dès que toutes les routes
 * répondaient, ce qui rendait le fichier rouge sans nommer quoi que ce soit.
 * Aucun écran n'est retiré : chacun a désormais sa ligne dans le rapport.
 */
test.describe('aucune violation axe sur tous les écrans panel', () => {
  for (const [path, heading, marker] of PANEL_ROUTES) {
    test(path, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
      if (marker !== null) {
        await expect(page.getByText(marker).first()).toBeVisible();
      }
      await expect(page.locator('html.light')).toHaveCount(1);

      await analyze(page, path);
    });
  }
});

/**
 * Les deux écrans que la table ne peut pas atteindre.
 *
 * La fiche d'un représentant n'a pas d'URL fixe, et le second volet de la
 * supervision n'est monté qu'une fois son onglet choisi : l'analyser depuis
 * `/supervision` reviendrait à balayer l'onglet d'activité une seconde fois.
 */
test('aucune violation axe sur la fiche représentant et le volet des comptes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });

  await page.goto('/chues/representants');
  // Depuis le TABLEAU : « Import Excel » pointe lui aussi sous
  // `/chues/representants/`.
  const premier = page.getByRole('table').locator('a[href^="/chues/representants/"]').first();
  await expect(premier).toBeVisible();
  await premier.click();
  await page.waitForURL(/\/chues\/representants\/[0-9a-f-]+$/);
  await expect(page.getByText('Histoire de la relation').first()).toBeVisible();
  await analyze(page, '/chues/representants/<id>');

  await page.goto('/chues/supervision');
  await page.getByRole('tab', { name: 'Présence' }).click();
  await expect(page.getByText('Présence observée par l’application.')).toBeVisible();
  await analyze(page, '/chues/supervision?volet=comptes');
});

/**
 * Les poignées de glisser-déposer sont la source classique de violations
 * `aria-*` : ce passage n'est couvert qu'ici, pas dans la boucle du dessus.
 */
test('aucune violation axe sur le mode Organiser du tableau de bord des visites', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });

  await page.goto('/accueil/tableau-de-bord');
  await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Organiser les graphiques', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
  await analyze(page, '/accueil/tableau-de-bord (Organiser)');
});
