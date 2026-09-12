import { expect, test } from '@playwright/test';

/**
 * TRA-11 et TRA-12 : le panel à 375 px.
 *
 * En dessous de `md`, `SidebarShell` rend son `<aside>` en `hidden` et toute la
 * navigation passe par le tiroir de la barre supérieure. Si ce tiroir ne
 * s'ouvre pas, le panel n'a plus aucune navigation sur téléphone.
 */

test.use({ viewport: { width: 375, height: 812 } });

test('TRA-11 le tiroir de navigation s’ouvre, navigue et se referme', async ({ page }) => {
  await page.goto('/admin/commerciaux');
  await expect(page).toHaveTitle('Téléconseillers · CPI GO');

  // La barre latérale de bureau n'est pas dans l'arbre d'accessibilité à cette
  // largeur : elle ne peut donc pas servir de navigation de repli.
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Ouvrir la navigation' }).click();

  const tiroir = page.getByRole('dialog', { name: 'Navigation principale' });
  await expect(tiroir).toBeVisible();

  await tiroir.getByRole('link', { name: 'Paramètres', exact: true }).click();

  await expect(page).toHaveURL(/\/admin\/parametres$/);
  await expect(tiroir).toHaveCount(0);
});

const ROUTES = [
  {
    chemin: '/grand-public',
    titre: 'Prospects · Projet Grand Public · CPI GO',
    barre: 'Prospects',
  },
  { chemin: '/admin/parametres', titre: 'Paramètres · Admin · CPI GO', barre: 'Paramètres' },
  {
    chemin: '/grand-public/statistiques',
    titre: 'Tableau de bord · Projet Grand Public · CPI GO',
    barre: 'Tableau de bord',
  },
] as const;

for (const { chemin, titre, barre } of ROUTES) {
  test(`TRA-12 ${chemin} ne déborde pas horizontalement à 375 px`, async ({ page }) => {
    await page.goto(chemin);
    await expect(page).toHaveTitle(titre);

    const titreDeBarre = page.getByRole('banner').getByRole('heading', { level: 1 });
    await expect(titreDeBarre).toHaveText(barre);

    const mesure = await page.evaluate(() => ({
      scrollWidth: document.scrollingElement?.scrollWidth ?? 0,
      innerWidth: window.innerWidth,
    }));
    expect(
      mesure.scrollWidth,
      `${chemin} déborde de ${String(mesure.scrollWidth - mesure.innerWidth)} px à 375 px`,
    ).toBeLessThanOrEqual(mesure.innerWidth + 1);

    // Tronqué, pas superposé : le titre reste entièrement dans le cadre, et il
    // s'arrête avant le premier bouton de la barre.
    const cadreTitre = await titreDeBarre.boundingBox();
    const cadreEspaces = await page.getByRole('banner').getByRole('link').first().boundingBox();
    if (cadreTitre === null || cadreEspaces === null) {
      throw new Error(`${chemin} : la barre supérieure n’a pas été rendue`);
    }
    expect(
      cadreTitre.x + cadreTitre.width,
      `${chemin} : le titre de la barre supérieure passe sous les actions`,
    ).toBeLessThanOrEqual(cadreEspaces.x + 1);
  });
}
