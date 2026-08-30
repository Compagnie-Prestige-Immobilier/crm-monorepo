import { expect, test, type Page } from '@playwright/test';

import { FIXTURE_PASSWORD } from './fixtures';

/**
 * ACC-CNX-01 à ACC-CNX-09 : le formulaire de connexion et le verrou anonyme.
 *
 * Projet `chromium-anonyme`, navigateur VIERGE : c'est la pose des cookies et
 * le refus des adresses du panel qui se jouent ici.
 *
 * BUDGET DE CONNEXIONS : quatre envois aboutis pour tout le fichier
 * (ACC-CNX-04, ACC-CNX-05, et les deux cas d'ACC-CNX-06), sur un point d'entrée
 * limité à dix par minute et partagé par toute la machine. Aucun autre fichier
 * de spec n'a le droit de remplir ce formulaire.
 *
 * ACC-CNX-03 n'est PAS réécrit ici : `auth.anon.spec.ts` le porte déjà.
 */

const ACCUEIL_IDENTIFIER = 'fixture.accueil@cpi.sn';

async function seConnecter(page: Page, identifier: string, password: string): Promise<void> {
  await page.getByLabel('E-mail ou identifiant').fill(identifier);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test('ACC-CNX-01 · le champ identifiant vide refuse l’envoi et nomme le champ', async ({
  page,
}) => {
  // Posé AVANT la navigation : le quota de dix connexions par minute est
  // partagé, et une validation cliente retirée le brûlerait en silence.
  const envois: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/auth/login') envois.push(request.method());
  });

  await page.goto('/connexion');
  await page.getByLabel('Mot de passe').fill('MotDePasse12');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page.locator('#identifier-error')).toHaveText('E-mail ou identifiant obligatoire.');
  await expect(page.getByLabel('E-mail ou identifiant')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/connexion$/);
  expect(envois, 'aucune tentative ne doit partir vers /api/auth/login').toEqual([]);
});

test('ACC-CNX-02 · un mot de passe trop court est refusé avant l’envoi', async ({ page }) => {
  const envois: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/auth/login') envois.push(request.method());
  });

  await page.goto('/connexion');
  await page.getByLabel('E-mail ou identifiant').fill('admin@cpi.sn');
  await page.getByLabel('Mot de passe').fill('court');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page.locator('#password-error')).toHaveText(
    'Le mot de passe compte au moins 8 caractères.',
  );
  expect(envois, 'la borne min(8) doit économiser la tentative').toEqual([]);
});

test('ACC-CNX-04 · un agent d’accueil se connecte et atterrit sur le hub', async ({ page }) => {
  await page.goto('/connexion');
  await seConnecter(page, ACCUEIL_IDENTIFIER, FIXTURE_PASSWORD);

  await page.waitForURL(/\/espaces$/);
  await expect(page.getByRole('heading', { name: 'Choisissez un espace', level: 1 })).toBeVisible();

  const noms = (await page.context().cookies()).map((cookie) => cookie.name);
  expect(noms).toContain('cpi_at');
  expect(noms).toContain('cpi_rt');

  // Une XSS suffirait à voler la session si l'un des deux devenait lisible.
  const lisibles = await page.evaluate(() => document.cookie);
  expect(lisibles).not.toContain('cpi_at');
  expect(lisibles).not.toContain('cpi_rt');
});

test('ACC-CNX-05 · la connexion respecte la destination demandée', async ({ page }) => {
  await page.goto('/connexion?suite=%2Faccueil%2Ftableau-de-bord');
  await seConnecter(page, ACCUEIL_IDENTIFIER, FIXTURE_PASSWORD);

  await page.waitForURL(/\/accueil\/tableau-de-bord$/);
  await expect(page).toHaveTitle(/Tableau de bord des visites/);
});

test('ACC-CNX-06 · une destination externe déguisée est ignorée', async ({ page }) => {
  const visitees: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) visitees.push(frame.url());
  });

  // `//evil.example.com` commence par « / » et est pourtant absolu.
  await page.goto('/connexion?suite=//evil.example.com');
  await seConnecter(page, ACCUEIL_IDENTIFIER, FIXTURE_PASSWORD);
  await page.waitForURL(/\/espaces$/);
  await expect(page.getByRole('heading', { name: 'Choisissez un espace', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: /^Compte de / }).click();
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
  await page.waitForURL(/\/connexion$/);

  // `/\evil` passe la première barre et porte un antislash : Windows et
  // certains agents le lisent comme `//evil`.
  await page.goto('/connexion?suite=/%5Cevil');
  await seConnecter(page, ACCUEIL_IDENTIFIER, FIXTURE_PASSWORD);
  await page.waitForURL(/\/espaces$/);
  await expect(page.getByRole('heading', { name: 'Choisissez un espace', level: 1 })).toBeVisible();

  const hors = visitees.filter(
    (url) => url !== 'about:blank' && !url.startsWith('http://localhost:3000/'),
  );
  expect(hors, 'le panel ne doit jamais servir de tremplin de redirection').toEqual([]);
});

test('ACC-CNX-07 · une session expirée l’annonce sur l’écran de connexion', async ({ page }) => {
  await page.goto('/connexion?session=expiree');

  // `getByRole('status')` seul attrape aussi la région aria-live de Sonner.
  const annonce = page
    .getByRole('status')
    .filter({ hasText: 'Session expirée. Reconnectez-vous.' });
  await expect(annonce).toHaveCount(1);
  await expect(annonce).toHaveText('Session expirée. Reconnectez-vous.');
});

test('ACC-CNX-08 · la racine anonyme mène à la connexion', async ({ page }) => {
  await page.goto('/');

  await page.waitForURL(/\/connexion$/);
  await expect(page.getByRole('heading', { name: 'Connexion', level: 1 })).toBeVisible();
});

for (const route of ['/accueil', '/accueil/tableau-de-bord', '/accueil/listes', '/accueil/import']) {
  test(`ACC-CNX-09 · ${route} est verrouillé aux anonymes`, async ({ page }) => {
    await page.goto(route);

    await expect(page, `${route} devrait renvoyer vers la connexion`).toHaveURL(/\/connexion$/);
    await expect(page.getByRole('heading', { name: 'Connexion', level: 1 })).toBeVisible();

    // Aucune fuite AVANT la redirection : ni le registre, ni son bouton de
    // saisie ne doivent avoir été rendus.
    await expect(page.locator('body')).not.toContainText('Registre');
    await expect(page.getByRole('button', { name: 'Ajouter une visite' })).toHaveCount(0);
  });
}
