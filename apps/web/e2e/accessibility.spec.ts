import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Tous les écrans panel accessibles à un ADMIN depuis la navigation actuelle. */
const PANEL_ROUTES = [
  ['/tableau-de-bord', 'Tableau de bord'],
  ['/statistiques', 'Statistiques'],
  ['/prospects', 'Prospects'],
  ['/campagnes', 'Campagnes'],
  ['/dossiers', 'Dossiers'],
  ['/dossiers/nouveau', 'Nouveau dossier'],
  ['/dossiers/export', 'Export'],
  ['/dossiers/etapes', 'Étapes bancaires'],
  ['/representants', 'Représentants'],
  ['/commerciaux', 'Téléconseillers'],
  ['/supervision', 'Supervision'],
  ['/referentiels', 'Référentiels'],
  ['/parametres', 'Paramètres'],
  ['/notifications', 'CPI GO'],
  ['/banque', 'CPI GO'],
] as const;

test('aucune violation axe sur tous les écrans panel', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  for (const [path, heading] of PANEL_ROUTES) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    await expect(page.locator('html.light')).toHaveCount(1);
    await page.addStyleTag({
      content: '* { animation: none !important; transition: none !important; }',
    });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `${path}: ${JSON.stringify(results.violations)}`).toEqual([]);
  }
});
