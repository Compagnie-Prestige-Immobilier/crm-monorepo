import { expect, test } from '@playwright/test';

/**
 * GP-29 et GP-30 : `/grand-public/console`, le même écran de conversion que
 * CHUES (`ConsoleView`), sur les prospects Grand Public.
 */

test.use({ storageState: 'v1/.auth/commercial.json' });

const CHAMP = 'Quel prospect avez-vous appelé ?';

test('GP-29 · la console Grand Public ouvre sur la recherche, sans file', async ({ page }) => {
  await page.goto('/grand-public/console');

  await expect(page).toHaveTitle(/^Appeler les prospects · CPI GO$/u);
  await expect(page.getByLabel(CHAMP)).toBeFocused();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Fiche courante' })).toHaveCount(0);
  await expect(page.getByText('Carte clavier')).toHaveCount(0);
});

test('GP-29b · sans résultat, « Ajouter un prospect » mène à la saisie Grand Public', async ({
  page,
}) => {
  await page.goto('/grand-public/console');
  await page.getByLabel(CHAMP).fill('zzz-personne-ne-porte-ce-nom');

  await expect(page.getByText('Aucun résultat. Vérifiez le nom ou le numéro.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ajouter un prospect' })).toHaveAttribute(
    'href',
    '/grand-public/nouveau',
  );
});

const ENCADREMENT = [
  { role: 'superviseur', etat: 'v1/.auth/superviseur.json', libelle: 'Supervision' },
  { role: 'direction', etat: 'v1/.auth/direction.json', libelle: 'Direction' },
] as const;

for (const cas of ENCADREMENT) {
  test.describe(`GP-30 · ${cas.role}`, () => {
    test.use({ storageState: cas.etat });

    test(`la console Grand Public est refusée à ${cas.role}`, async ({ page }) => {
      await page.goto('/grand-public/console');

      const refus = page.getByRole('alert').filter({ hasText: 'Accès refusé' });
      await expect(refus.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
      await expect(refus).toContainText(
        `La consignation des appels Grand Public est réservé à un autre rôle. Rôle en cours : ${cas.libelle}.`,
      );
      await expect(refus.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute(
        'href',
        '/espaces',
      );

      await expect(page.getByLabel(CHAMP)).toHaveCount(0);
    });
  });
}
