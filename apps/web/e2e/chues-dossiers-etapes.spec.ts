import { expect, test } from '@playwright/test';

/**
 * Configuration du flux bancaire, sous session ADMIN.
 *
 * CHU-DOSE-03 et CHU-DOSE-04. **CHU-DOSE-01 n'est pas écrit** : le référentiel
 * amorcé ne contient que DEUX étapes ouvertes, « À traiter » (initiale,
 * verrouillée) et « En traitement banque ». `move()` interdit tout déplacement
 * qui toucherait l'étape initiale : aucun bouton « Monter » ni « Descendre »
 * n'est actionnable, et le geste du scénario n'existe pas à l'écran. Le
 * réordonnancement demande une troisième étape ouverte, que ce fichier ne
 * fabrique pas : le référentiel des étapes est partagé (§4.3.6 d'`E2E.md`) et
 * une étape ajoutée ne se supprime pas.
 *
 * Aucun test de ce fichier ne modifie le référentiel : il n'y a donc rien à
 * remettre dans son ordre d'origine.
 */

test.describe.configure({ mode: 'serial' });

test('CHU-DOSE-03 · la butée haute et la butée basse sont gardées', async ({ page }) => {
  await page.goto('/chues/dossiers/etapes');
  await expect(page.getByRole('heading', { name: 'Étapes des dossiers', level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Étapes ouvertes', { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  // Les lignes d'étapes terminales n'ont aucun bouton de déplacement : les
  // filtrer par ce bouton isole exactement le flux réordonnançable.
  const etapes = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: /^Monter « / }) });
  await expect(etapes.first()).toBeVisible({ timeout: 30_000 });
  const nombre = await etapes.count();
  expect(nombre, 'Aucune étape ouverte rendue').toBeGreaterThan(0);

  // Un clic en butée partirait en requête que l'API refuse : la butée se dit
  // par un bouton désactivé, pas par un message d'erreur après coup.
  await expect(etapes.first().getByRole('button', { name: /^Monter « / })).toBeDisabled();
  await expect(
    etapes.nth(nombre - 1).getByRole('button', { name: /^Descendre « / }),
  ).toBeDisabled();
});

test('CHU-DOSE-04 · l’écran tient sur 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/chues/dossiers/etapes');
  await expect(page.getByText('Étapes ouvertes', { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  const debordement = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(debordement, 'La page déborde horizontalement à 375 px').toBeLessThanOrEqual(1);

  // Sous 1024 px, les quatre contrôles passent dans un menu : ce sont ses
  // entrées, et non plus les boutons à pictogramme, qui portent le geste.
  await page
    .getByRole('button', { name: /^Actions pour « / })
    .first()
    .click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();

  for (const nom of ['Monter', 'Descendre']) {
    const item = menu.getByRole('menuitem', { name: nom, exact: true });
    await expect(item).toBeVisible();
    const boite = await item.boundingBox();
    expect(boite, `« ${nom} » n’a pas de boîte englobante`).not.toBeNull();
    expect(
      boite?.height ?? 0,
      `« ${nom} » mesure ${String(boite?.height ?? 0)} px de haut : sous la cible du pouce`,
    ).toBeGreaterThanOrEqual(44);
  }

  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 720 });
});
