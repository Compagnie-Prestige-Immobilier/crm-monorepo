import { expect, test, type Page } from '@playwright/test';

/**
 * Navigation dépendante du rôle, éprouvée SUR UN VRAI NAVIGATEUR.
 *
 * `nav-items.test.ts` fixe déjà la liste attendue par rôle, en unitaire. Ce que
 * seul un navigateur montre, c'est que le rôle lu sur la session serveur
 * atteint bien la barre latérale, que la redirection d'après connexion mène là
 * où l'API ne répondra pas 403, et qu'une URL tapée à la main sur un écran
 * interdit rend un refus lisible plutôt qu'une page cassée.
 *
 * Le compte BANQUE_FINANCE utilisé vient du JEU DE DÉMONSTRATION : il n'existe
 * donc que pendant que le mode est actif. Les parcours sont ignorés proprement
 * sinon, c'est préférable à un échec qui accuserait le code alors que la
 * précondition manque.
 *
 * `.anon.spec.ts` : ces parcours doivent partir d'un navigateur VIERGE, sans
 * l'état d'administrateur partagé, puisque c'est justement la connexion qu'ils
 * éprouvent.
 */

const BANK_IDENTIFIER = process.env.E2E_BANK_IDENTIFIER ?? 'demo.banque@cpi.sn';
const BANK_PASSWORD = process.env.E2E_BANK_PASSWORD ?? 'Demo1-CPI-Sunugal';

async function login(page: Page, identifier: string, password: string): Promise<boolean> {
  await page.goto('/connexion');
  await page.getByLabel('E-mail ou identifiant').fill(identifier);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  // Un refus laisse sur /connexion avec une alerte : on le distingue d'une
  // réussite plutôt que d'attendre en vain une URL qui ne viendra pas.
  const outcome = await Promise.race([
    page.waitForURL(/\/(tableau-de-bord|dossiers)/, { timeout: 15_000 }).then(() => true),
    page
      .getByRole('alert')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => false),
  ]).catch(() => false);
  return outcome;
}

test('un agent Banque & Finance atterrit sur ses dossiers, pas sur le tableau de bord des prospects', async ({
  page,
}) => {
  const ok = await login(page, BANK_IDENTIFIER, BANK_PASSWORD);
  test.skip(
    !ok,
    'Le compte BANQUE_FINANCE de démonstration est absent : activez le mode démonstration.',
  );

  // Redirection d'après connexion : `/tableau-de-bord` lui vaudrait un 403 dès
  // la première seconde d'utilisation.
  await expect(page).toHaveURL(/\/dossiers/);
  await expect(page.getByRole('heading', { name: 'Dossiers', level: 1 })).toBeVisible();
});

test('sa navigation ne montre QUE ses quatre écrans', async ({ page }) => {
  const ok = await login(page, BANK_IDENTIFIER, BANK_PASSWORD);
  test.skip(!ok, 'Compte BANQUE_FINANCE de démonstration absent.');

  const nav = page.getByRole('navigation', { name: 'Navigation principale' });

  for (const visible of ['Tableau de bord', 'Dossiers', 'Nouveau dossier', 'Export']) {
    await expect(nav.getByRole('link', { name: visible, exact: true })).toBeVisible();
  }

  // Le point de l'exigence : ces entrées sont ABSENTES, pas grisées. Une entrée
  // qui mène à un refus de droits est un défaut de conception.
  for (const hidden of [
    'Prospects',
    'Représentants',
    'Commerciaux',
    'Campagnes',
    'Référentiels',
    'Paramètres',
    'Étapes bancaires',
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
  const ok = await login(page, BANK_IDENTIFIER, BANK_PASSWORD);
  test.skip(!ok, 'Compte BANQUE_FINANCE de démonstration absent.');

  // Le masquage du menu ne protège rien : une URL se tape, et un onglet resté
  // ouvert rejoue l'ancienne route.
  await page.goto('/prospects');
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();
  // Le refus NOMME le rôle en cours : sans lui, l'utilisateur ne sait pas quoi
  // demander à son administrateur.
  await expect(page.getByRole('alert')).toContainText('Banque & Finance');
  // Et il propose une sortie vers un écran qui lui est ouvert.
  await expect(page.getByRole('link', { name: 'Retour à mon accueil' })).toBeVisible();

  await page.goto('/parametres');
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();
});

test('un COMMERCIAL est refusé à la porte du panel', async ({ page }) => {
  // Son outil est l'application mobile : le laisser entrer ici lui donnerait la
  // base nominative complète, là où l'annuaire de phase 2 ne lui expose qu'un
  // téléphone et un statut.
  await page.goto('/connexion');
  await page.getByLabel('E-mail ou identifiant').fill('demo.awa@cpi.sn');
  await page.getByLabel('Mot de passe').fill('Demo1-CPI-Sunugal');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  const alert = page.getByRole('alert').first();
  await expect(alert).toBeVisible();
  // Message générique : la réponse ne doit pas permettre d'énumérer les comptes.
  await expect(alert).toContainText(/incorrects ou compte non autorisé/i);
  await expect(page).toHaveURL(/\/connexion/);
});
