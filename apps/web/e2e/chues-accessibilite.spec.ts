import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * CHU-TRV-07 : les deux états CHUES qu'`accessibility.spec.ts` ne peut pas
 * atteindre, parce qu'ils n'existent qu'après un geste.
 *
 * La table de routes existante analyse `/chues/appels-representants` sur sa
 * LISTE, et le mode « Organiser » du tableau de bord des visites. Ni la
 * deuxième étape de la qualification, ni le mode « Composer l'écran » des
 * chiffres CHUES ne sont couverts : ce sont eux, et rien d'autre, qui sont
 * balayés ici (quota d'appels, §4.4.2 du plan).
 */
async function analyser(page: Page, ou: string): Promise<void> {
  // Le serveur de développement compile la route à la demande : sans cette
  // attente, axe auditerait le document intermédiaire.
  await expect(page).toHaveTitle(/\S/);
  await page.addStyleTag({
    content: '* { animation: none !important; transition: none !important; }',
  });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, `${ou} : ${JSON.stringify(results.violations)}`).toEqual([]);
}

test.describe('étape 2 de la qualification d’un représentant', () => {
  test.use({ storageState: 'e2e/.auth/commercial.json' });

  test('aucune violation axe sur la deuxième étape du script représentant', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/chues/appels-representants');
    await expect(page).toHaveTitle('Qualifier un représentant · CPI GO');
    await expect(page.getByText('Choisissez qui vous venez d’appeler.')).toBeVisible();

    // Une relation DÉJÀ TRANCHÉE ouvre d'abord une boîte d'avertissement et non
    // le script : on vise une fiche que personne n'a encore qualifiée.
    const fiche = page
      .getByRole('listitem')
      .filter({ hasText: 'Non qualifié' })
      .first()
      .getByRole('button');
    await expect(fiche).toBeVisible();
    await fiche.click();

    await expect(page.getByText('Étape 1 sur 2 · Comment s’est passé l’appel ?')).toBeVisible();
    await page.getByRole('button', { name: 'Injoignable', exact: true }).click();
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();

    // Rien n'est envoyé au serveur avant « Enregistrer » : cet écran ne laisse
    // aucune donnée derrière lui, et « Enregistrer » n'est jamais cliqué.
    await expect(page.getByText('Étape 2 sur 2 · Quelque chose à ajouter ?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toBeVisible();

    await analyser(page, '/chues/appels-representants (étape 2)');
  });
});

test.describe('mode composition des chiffres CHUES', () => {
  test.use({ storageState: 'e2e/.auth/superviseur.json' });

  test('aucune violation axe sur « Composer l’écran » des chiffres CHUES', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });

    // « Composer l'écran » est rendu par le serveur, mais son geste ne fait
    // rien tant que la disposition n'est pas revenue : un clic posé avant
    // l'hydratation et la réponse est PERDU, sans trace.
    const disposition = page.waitForResponse((response) =>
      response.url().includes('/api/v1/tableaux-de-bord/chues/disposition'),
    );
    const activite = page.waitForResponse((response) =>
      response.url().includes('/api/v1/supervision/activite'),
    );
    await page.goto('/chues/statistiques');
    await expect(page).toHaveTitle('Tableau de bord · CPI GO');
    await disposition;
    await activite;

    await page.getByRole('button', { name: 'Composer l’écran' }).click();
    await expect(page.getByText('Mode organisation')).toBeVisible();

    // Ce sont les POIGNÉES qui sont l'objet du scénario : sans une carte posée,
    // le mode n'expose aucun attribut `aria-*` de glisser-déposer et l'analyse
    // ne prouverait rien.
    await expect(
      page.getByRole('button', { name: /^Réordonner .+ par glisser-déposer$/ }).first(),
    ).toBeVisible();

    await analyser(page, '/chues/statistiques (Composer l’écran)');

    // On ressort sans enregistrer : la disposition du compte SUPERVISEUR est un
    // état partagé (§4.4.6). Rien n'a été modifié, « Quitter » sort directement.
    await page.getByRole('button', { name: 'Quitter', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Composer l’écran' })).toBeVisible();
  });
});
