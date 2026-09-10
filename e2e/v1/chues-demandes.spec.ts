import { expect, test } from '@playwright/test';

/**
 * Demandes de création de client, côté arbitrage.
 *
 * Ce fichier n'écrit RIEN : il n'a ni préfixe de données ni plage de
 * téléphones réservée. Il lit la file telle que les autres parcours la
 * laissent, et n'affirme jamais un nombre absolu.
 */

test.use({ storageState: 'v1/.auth/admin.json' });

/** Un terme qu'aucun nom ni prénom ne peut contenir. */
const INTROUVABLE = 'ZZZ-AUCUNE-DEMANDE-E2E';

test('CHU-DMC-05 · file vide et filtre trop étroit ne se disent pas de la même façon', async ({
  page,
}) => {
  await page.goto('/chues/demandes-clients');
  await expect(
    page.getByRole('heading', { name: 'Créations de client à valider', level: 1 }),
  ).toBeVisible();

  // Sans filtre, l'écran s'ouvre sur les demandes EN ATTENTE : le vide s'y lit
  // comme une file traitée.
  await expect(
    page.getByRole('heading', { name: 'Aucune demande en attente', level: 2 }),
  ).toBeVisible();

  await page.getByLabel('Recherche').fill(INTROUVABLE);
  await expect(page).toHaveURL(new RegExp(`search=${INTROUVABLE}`));

  // Le même vide, mais dû au critère : la phrase change, sinon l'administrateur
  // croit la file traitée alors qu'il ne regarde qu'un coin de la liste.
  await expect(
    page.getByRole('heading', { name: 'Aucune demande ne correspond à ces filtres', level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Aucune demande en attente', level: 2 }),
  ).toHaveCount(0);
});

test('CHU-DMC-06 · le décompte est annoncé et la pagination reste en butée', async ({ page }) => {
  await page.goto('/chues/demandes-clients');
  await page.getByRole('button', { name: 'Toutes' }).click();
  await expect(page).toHaveURL(/statut=tous/);

  const cartes = page.getByRole('main').getByRole('listitem');
  await expect(
    cartes,
    'aucune demande en base : `chues-demandes.banque.spec.ts` en dépose une et doit tourner avant',
  ).not.toHaveCount(0);

  // Le décompte est le seul élément qui dit si l'on voit tout : il vit dans une
  // région `status`, son intitulé restant réservé aux lecteurs d'écran.
  const decompte = page.getByRole('status').filter({ hasText: 'Demandes affichées' });
  await expect(decompte).toHaveText(/^Demandes affichées\s:\s\d+\sdemandes?$/u);

  // Vingt-cinq demandes par page, et la base en compte moins : la seule page
  // existante verrouille les deux sens.
  await expect(page.getByText('1 / 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Page précédente' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Page suivante' })).toBeDisabled();
});
