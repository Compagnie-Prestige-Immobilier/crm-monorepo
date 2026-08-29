import { expect, test } from '@playwright/test';

/**
 * GP-29 et GP-30 : `/grand-public/console`, écran devenu un renvoi.
 *
 * `components/console/console-view.tsx` a été vidé (E2E.md §2.1) : plus de file
 * d'appel, plus de carte clavier, un titre et un lien vers l'annuaire. Le
 * troisième parcours éprouve la destination de ce lien, défaut connu §1.5.
 */

test.use({ storageState: 'e2e/.auth/commercial.json' });

const RENVOI =
  'Les fiches sont consultées librement. Ouvrez l’annuaire pour chercher un prospect et consigner l’appel.';

test('GP-29 · la console Grand Public rend son renvoi, sans file ni carte clavier', async ({
  page,
}) => {
  await page.goto('/grand-public/console');

  await expect(page).toHaveTitle(/^Appeler les prospects · CPI GO$/u);

  // Deux `<h1>` sur cette route (§6.1) : celui de la barre supérieure porte le
  // titre de navigation, celui de la page porte le renvoi.
  await expect(page.getByRole('heading', { name: 'Rechercher une fiche', level: 1 })).toBeVisible();
  await expect(page.getByText(RENVOI, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ouvrir l’annuaire' })).toBeVisible();

  // L'ancien poste d'appel : fiche courante, contexte, carte clavier. Aucun de
  // ces trois repères ne doit revenir sur cette route.
  await expect(page.getByRole('region', { name: 'Fiche courante' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Contexte' })).toHaveCount(0);
  await expect(page.getByText('Carte clavier')).toHaveCount(0);
});

/**
 * Défaut §1.5, ATTENDU ROUGE. `console-view.tsx` ligne 9 pointe
 * `/grand-public/prospects`, route qui n'existe pas : le segment dynamique
 * `/grand-public/[id]` la capte avec `id = "prospects"` et rend
 * « Cette fiche n’a pas pu être chargée. ». L'annuaire vit à `/grand-public`.
 */
test('GP-29b · « Ouvrir l’annuaire » mène à l’annuaire Grand Public', async ({ page }) => {
  await page.goto('/grand-public/console');
  await page.getByRole('link', { name: 'Ouvrir l’annuaire' }).click();

  await expect(page).toHaveURL(/\/grand-public$/u);
  await expect(
    page.getByRole('heading', { name: 'Prospects Grand Public', level: 1 }),
  ).toBeVisible();
});

const ENCADREMENT = [
  { role: 'superviseur', etat: 'e2e/.auth/superviseur.json', libelle: 'Supervision' },
  { role: 'direction', etat: 'e2e/.auth/direction.json', libelle: 'Direction' },
] as const;

for (const cas of ENCADREMENT) {
  test.describe(`GP-30 · ${cas.role}`, () => {
    test.use({ storageState: cas.etat });

    test(`la file d’appel Grand Public est refusée à ${cas.role}`, async ({ page }) => {
      await page.goto('/grand-public/console');

      const refus = page.getByRole('alert').filter({ hasText: 'Accès refusé' });
      await expect(refus.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
      await expect(refus).toContainText(
        `La file d’appel Grand Public est réservé à un autre rôle. Rôle en cours : ${cas.libelle}.`,
      );
      await expect(refus.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute(
        'href',
        '/espaces',
      );

      // Le refus remplace l'écran, il ne se pose pas par-dessus : aucun repère
      // de la console ne subsiste dans le document.
      await expect(page.getByRole('heading', { name: 'Rechercher une fiche', level: 1 })).toHaveCount(
        0,
      );
      await expect(page.getByRole('link', { name: 'Ouvrir l’annuaire' })).toHaveCount(0);
    });
  });
}
