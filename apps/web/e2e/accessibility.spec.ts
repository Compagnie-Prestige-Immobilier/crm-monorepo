import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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
  ['/tableau-de-bord', 'Tableau de bord', null],
  ['/statistiques', 'Statistiques', null],
  ['/prospects', 'Prospects', null],
  ['/campagnes', 'Campagnes', 'Appels prospects'],
  ['/campagnes/representants', 'Campagnes', 'Appels représentants'],
  ['/dossiers', 'Dossiers', null],
  ['/dossiers/nouveau', 'Nouveau dossier', null],
  ['/dossiers/export', 'Export', null],
  ['/dossiers/etapes', 'Étapes bancaires', null],
  ['/demandes-clients', 'Demandes clients', null],
  ['/representants', 'Représentants', null],
  ['/representants/import', 'Représentants', 'Partir du modèle'],
  ['/commerciaux', 'Utilisateurs', null],
  ['/supervision', 'Supervision', null],
  ['/referentiels', 'Référentiels', null],
  ['/parametres', 'Paramètres', null],
  ['/notifications', 'Notifications', null],
  // `/banque` n'appartient pas à la navigation d'un ADMIN : `navTitle` ne
  // trouve donc aucune entrée et retombe sur le nom du produit.
  ['/banque', 'CPI GO', null],
];

test('aucune violation axe sur tous les écrans panel', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  for (const [path, heading, marker] of PANEL_ROUTES) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    if (marker !== null) {
      await expect(page.getByText(marker).first()).toBeVisible();
    }
    await expect(page.locator('html.light')).toHaveCount(1);
    await page.addStyleTag({
      content: '* { animation: none !important; transition: none !important; }',
    });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `${path}: ${JSON.stringify(results.violations)}`).toEqual([]);
  }
});
