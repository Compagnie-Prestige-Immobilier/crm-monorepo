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
 * `navTitle` et non rendu par la page. Trois écrans héritent donc de celui de
 * leur parent : `/campagnes/representants` affiche « Campagnes »,
 * `/representants/import` affiche « Représentants ». S'arrêter à ce titre
 * reviendrait à analyser une coquille montée par le layout alors que la page,
 * elle, n'a peut-être rien affiché : axe ne trouverait aucune violation, et
 * pour cause.
 *
 * Le troisième élément nomme donc un repère PROPRE à l'écran, quand le titre
 * ne suffit pas à prouver qu'on est bien arrivé.
 */
const PANEL_ROUTES: readonly (readonly [path: string, heading: string, marker: string | null])[] = [
  // Le hub, atterrissage de tous les rôles. Son titre est celui de la PAGE et
  // non de la barre supérieure, qu'il ne porte pas : aucun repère à ajouter.
  ['/espaces', 'Choisissez un espace', null],
  ['/tableau-de-bord', 'Tableau de bord', null],
  ['/statistiques', 'Statistiques', null],
  ['/prospects', 'Prospects', null],
  ['/prospects/nouveau', 'Nouveau prospect', 'Enregistrer et suivant'],
  ['/accueil/tableau-de-bord', 'Tableau de bord', 'Organiser'],
  ['/campagnes', 'Campagnes', 'Appels prospects'],
  ['/campagnes/representants', 'Campagnes', 'Appels représentants'],
  ['/console', 'Console d’appel', 'Carte clavier'],
  ['/rappels', 'Rappels', 'En retard'],
  ['/suggestions', 'Numéros suggérés', 'Numéros donnés par un représentant'],
  ['/dossiers', 'Dossiers', null],
  ['/dossiers/nouveau', 'Nouveau dossier', null],
  ['/dossiers/export', 'Export', null],
  ['/dossiers/etapes', 'Étapes bancaires', null],
  ['/demandes-clients', 'Demandes clients', null],
  ['/representants', 'Représentants', null],
  ['/representants/import', 'Représentants', 'Partir du modèle'],
  ['/commerciaux', 'Utilisateurs', null],
  ['/supervision', 'Supervision', 'Activité'],
  ['/referentiels', 'Référentiels', null],
  ['/imports', 'Imports', 'Déposer un classeur'],
  ['/parametres', 'Paramètres', null],
  ['/notifications', 'Notifications', null],
  // `/banque` n'appartient pas à la navigation d'un ADMIN : `navTitle` ne
  // trouve donc aucune entrée et retombe sur le nom du produit.
  ['/banque', 'CPI GO', null],
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

test('aucune violation axe sur tous les écrans panel', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  for (const [path, heading, marker] of PANEL_ROUTES) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    if (marker !== null) {
      await expect(page.getByText(marker).first()).toBeVisible();
    }
    await expect(page.locator('html.light')).toHaveCount(1);

    await analyze(page, path);
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

  await page.goto('/representants');
  // Depuis le TABLEAU : « Import Excel » pointe lui aussi sous `/representants/`.
  const premier = page.getByRole('table').locator('a[href^="/representants/"]').first();
  await expect(premier).toBeVisible();
  await premier.click();
  await page.waitForURL(/\/representants\/[0-9a-f-]+$/);
  await expect(page.getByText('Histoire de la relation').first()).toBeVisible();
  await analyze(page, '/representants/<id>');

  await page.goto('/supervision');
  await page.getByRole('tab', { name: 'Comptes' }).click();
  await expect(page.getByText('Présence et dernière activité des comptes.')).toBeVisible();
  await analyze(page, '/supervision?volet=comptes');
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
  await page.getByRole('button', { name: 'Organiser' }).click();
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
  await analyze(page, '/accueil/tableau-de-bord (Organiser)');
});
