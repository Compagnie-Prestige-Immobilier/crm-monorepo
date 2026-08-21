import { expect, test } from '@playwright/test';

/**
 * Les adresses d'AVANT le découpage en quatre espaces mènent toujours quelque
 * part.
 *
 * Les notifications déjà envoyées les portent en base, un signet les rejoue, un
 * onglet resté ouvert aussi : sans l'attrape-tout, chacune tombe en 404 le jour
 * du déploiement.
 *
 * La table des renvois est fixée en unitaire par `src/app/moved-routes.test.ts`.
 * Ce qui se joue ICI est le CÂBLAGE : que la route dynamique de premier niveau
 * soit bien atteinte par un vrai navigateur, qu'elle ne prenne pas le pas sur
 * les segments statiques, et que l'écran d'arrivée se rende au lieu de se
 * plaindre. Un balayage des dix-sept racines n'apprendrait rien de plus et
 * coûterait cent soixante-dix appels d'API sur un point d'entrée limité à trois
 * cents par minute.
 */

test('une ancienne adresse filtrée arrive filtrée', async ({ page }) => {
  await page.goto('/prospects?statut=NOUVEAU&page=2');

  const arrivee = new URL(page.url());
  expect(arrivee.pathname).toBe('/chues/prospects');
  // L'URL EST l'état du tableau : une requête perdue en chemin ramène le lien
  // partagé à la liste entière, sans rien signaler.
  expect(arrivee.searchParams.get('statut')).toBe('NOUVEAU');
  expect(arrivee.searchParams.get('page')).toBe('2');

  // Le titre du DOCUMENT est posé par la PAGE : un renvoi qui aurait abouti
  // sur la seule coquille du layout ne le porterait pas.
  await expect(page).toHaveTitle(/Prospects/);
  await expect(page.getByRole('heading', { name: 'Prospects', level: 1 })).toBeVisible();
});

test('une ancienne adresse profonde garde le reste de son chemin', async ({ page }) => {
  await page.goto('/campagnes/representants');
  expect(new URL(page.url()).pathname).toBe('/chues/campagnes/representants');
  await expect(page.getByText('Appels représentants').first()).toBeVisible();

  // Deux niveaux sous une coque, et sous l'AUTRE coque : le titre de niveau 1
  // est celui du parent « Référentiels », c'est donc le titre du DOCUMENT qui
  // dit qu'on est arrivé sur la page et non sur sa coquille.
  await page.goto('/referentiels/issues-appel');
  expect(new URL(page.url()).pathname).toBe('/admin/referentiels/issues-appel');
  await expect(page).toHaveTitle(/Issues d’appel/);
});

test('une racine qui n’a jamais existé reste introuvable', async ({ page }) => {
  // L'attrape-tout ne doit pas absorber le reste du site : sans ce refus, une
  // faute de frappe rendrait une page vide au lieu de le dire.
  await page.goto('/comptabilite');
  await expect(page.getByRole('heading', { name: 'Page introuvable', level: 1 })).toBeVisible();
  // Et la sortie proposée est le hub, seul point de départ commun aux rôles.
  await expect(page.getByRole('link', { name: 'Revenir aux espaces' })).toHaveAttribute(
    'href',
    '/espaces',
  );
});
