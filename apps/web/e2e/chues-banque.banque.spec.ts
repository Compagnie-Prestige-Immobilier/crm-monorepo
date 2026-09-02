import { expect, test, type Page } from '@playwright/test';

/**
 * Tableau de bord bancaire, vu par l'agent BANQUE_FINANCE.
 *
 * `workspaces.spec.ts` couvre déjà cet écran sous session ADMIN. Ce qu'il ne
 * couvre pas, et qui est éprouvé ici : le rôle auquel l'écran est destiné, les
 * états vides nommés de chaque graphique, le repli des montants et la largeur
 * téléphone.
 */

test.use({ storageState: 'e2e/.auth/banque.json' });

/** 2031 : aucun dossier ne peut y être né, le filtre vide donc l'écran. */
const ANNEE_SANS_DOSSIER = '2031';
const PERIODE_VIDE = '/chues/banque?dateFrom=2031-01-01';

/**
 * Légende de la tuile « Dossiers ». La classe accepte les trois espaces que
 * `formatNumber` peut poser entre les milliers : fine insécable, insécable et
 * ordinaire, selon la version d'ICU du navigateur.
 */
const LEGENDE_DOSSIERS = new RegExp(`^[\\d   ]+ à traiter · [\\d   ]+ en cours$`, 'u');

/**
 * Les titres que `QueryErrorState` peut rendre, plus celui du refus de droits.
 * Chacun est nommé : une expression ouverte laisserait passer un état d'erreur
 * ajouté plus tard.
 */
async function expectNoErrorState(page: Page): Promise<void> {
  for (const titre of [
    'Accès refusé',
    'Erreur serveur',
    'Serveur injoignable',
    'Chargement impossible',
    'Configuration incomplète',
  ]) {
    await expect(
      page.getByRole('heading', { name: titre, exact: true }),
      `${titre} ne devrait pas être rendu sur /chues/banque`,
    ).toHaveCount(0);
  }
}

test('CHU-BQ-01 · un agent bancaire atterrit sur le tableau de bord bancaire', async ({ page }) => {
  await page.goto('/chues/banque');

  // Le titre de niveau 1 vient de la barre supérieure et se dérive de la route :
  // il serait correct même sur une coquille vide. C'est le titre du DOCUMENT,
  // posé par la page, qui prouve que c'est bien cet écran qui a rendu.
  await expect(page).toHaveTitle('Tableau de bord bancaire · CPI GO');

  await expect(page.getByText('Taux de rejet', { exact: true })).toBeVisible();
  await expect(page.getByText('Délai moyen', { exact: true })).toBeVisible();
  await expectNoErrorState(page);
});

test('CHU-BQ-02 · chaque graphique vide nomme son absence de données', async ({ page }) => {
  await page.goto('/chues/banque');
  await expect(page.getByText('Taux de rejet', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Créé à partir du' }).click();
  await page.getByRole('combobox', { name: 'Année affichée' }).click();
  await page.getByRole('option', { name: ANNEE_SANS_DOSSIER, exact: true }).click();
  await page.getByRole('combobox', { name: 'Mois affiché' }).click();
  await page.getByRole('option', { name: 'janvier', exact: true }).click();
  await page.getByRole('gridcell', { name: '01 janvier 2031' }).click();

  await expect(page).toHaveURL(/[?&]dateFrom=2031-01-01(&|$)/);

  await expect(
    page.getByText('Aucun dossier rejeté sur la période filtrée.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Aucune activité d’agent sur la période filtrée.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Aucun dossier clos.', { exact: true })).toBeVisible();
});

test('CHU-BQ-03 · un montant nul se lit « 0 FCFA » et non une case vide', async ({ page }) => {
  await page.goto(PERIODE_VIDE);

  // Le tableau des montants annonce d'abord que la période filtrée est vide :
  // sans lui, « 0 FCFA » pourrait n'être qu'un écran resté au squelette.
  await expect(
    page.getByText('Aucun dossier sur la période filtrée.', { exact: true }),
  ).toBeVisible();

  await expect(page.getByText('0 FCFA', { exact: true })).toBeVisible();
});

test.describe('sur un écran de 375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('CHU-BQ-05 · les indicateurs de tête tiennent sans défilement horizontal', async ({
    page,
  }) => {
    await page.goto('/chues/banque');

    // La tuile « Dossiers » se désigne par sa légende : son libellé est aussi
    // celui d'un en-tête de colonne du tableau des montants.
    await expect(page.getByText(LEGENDE_DOSSIERS)).toBeVisible();
    await expect(page.getByText('Taux de rejet', { exact: true })).toBeVisible();
    await expect(page.getByText('Délai moyen', { exact: true })).toBeVisible();

    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(
      debordement,
      `la page déborde de ${String(debordement)} px à 375 px de large`,
    ).toBeLessThanOrEqual(0);
  });
});
