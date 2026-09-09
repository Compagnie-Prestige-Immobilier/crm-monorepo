import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * TRA-14 et TRA-15 : les états qui n'existent qu'après un geste.
 *
 * `accessibility.spec.ts` balaie des routes : il n'ouvre aucune boîte de
 * dialogue, et n'analyse que le mode « Organiser » du tableau de bord des
 * visites. Une boîte sans nom accessible, ou qui ne rend pas le fond inerte,
 * ne peut être vue que dans cet état ouvert.
 *
 * Aucun de ces gestes n'écrit : la création est ANNULÉE, la désactivation est
 * ANNULÉE, l'envoi n'est jamais confirmé, la composition n'est jamais
 * enregistrée.
 */
async function analyser(page: Page, ou: string): Promise<void> {
  await page.addStyleTag({
    content: '* { animation: none !important; transition: none !important; }',
  });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, `${ou} : ${JSON.stringify(results.violations)}`).toEqual([]);
}

test.describe('boîtes de dialogue de l’espace Admin', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('aucune violation axe sur la boîte « Nouvel utilisateur »', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/admin/commerciaux');
    await expect(page).toHaveTitle('Téléconseillers · CPI GO');

    await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
    const boite = page.getByRole('dialog').filter({ hasText: 'Nouvel utilisateur' });
    await expect(boite).toBeVisible();

    await analyser(page, '/admin/commerciaux (Nouvel utilisateur)');

    await boite.getByRole('button', { name: 'Annuler' }).click();
    await expect(boite).toHaveCount(0);
  });

  test('aucune violation axe sur la boîte de désactivation d’un référentiel', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/admin/referentiels');
    await expect(page).toHaveTitle('Référentiels · CPI GO');

    // CBAO est posée par `e2e/fixtures.ts` : elle est toujours là, et la boîte
    // est refermée par « Annuler » — un référentiel partagé ne se désactive pas
    // depuis un test (§4.3.6).
    await page.getByRole('button', { name: 'Désactiver CBAO' }).click();
    const boite = page.getByRole('dialog').filter({ hasText: 'Désactiver « CBAO » ?' });
    await expect(boite).toBeVisible();

    await analyser(page, '/admin/referentiels (Désactiver CBAO)');

    await boite.getByRole('button', { name: 'Annuler' }).click();
    await expect(boite).toHaveCount(0);
  });

  test('aucune violation axe sur le composeur « Nouvelle notification »', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/admin/notifications');
    await expect(page).toHaveTitle('Notifications · CPI GO');

    await page.getByRole('button', { name: 'Nouvelle notification' }).click();
    const boite = page
      .getByRole('dialog')
      .filter({ hasText: 'Envoi push aux destinataires choisis.' });
    await expect(boite).toBeVisible();

    await analyser(page, '/admin/notifications (Nouvelle notification)');

    await boite.getByRole('button', { name: 'Annuler' }).click();
    await expect(boite).toHaveCount(0);
  });
});

test.describe('mode composition des chiffres Grand Public', () => {
  test.use({ storageState: 'e2e/.auth/superviseur.json' });

  test('aucune violation axe sur « Composer l’écran » de /grand-public/statistiques', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });

    // « Composer l'écran » est rendu par le serveur, mais son geste ne fait
    // rien tant que la disposition n'est pas revenue : un clic posé avant
    // l'hydratation et la réponse est PERDU, sans trace.
    const disposition = page.waitForResponse((response) =>
      response.url().includes('/api/v1/tableaux-de-bord/grand-public/disposition'),
    );
    const activite = page.waitForResponse((response) =>
      response.url().includes('/api/v1/supervision/activite'),
    );
    await page.goto('/grand-public/statistiques');
    await expect(page).toHaveTitle('Tableau de bord Grand Public · CPI GO');
    await disposition;
    await activite;

    await page.getByRole('button', { name: 'Composer l’écran' }).click();
    await expect(page.getByText('Mode organisation')).toBeVisible();

    // Les poignées de réorganisation SONT l'objet du scénario : sans carte
    // posée, aucun attribut `aria-*` de glisser-déposer n'est rendu et
    // l'analyse ne prouverait rien.
    await expect(
      page.getByRole('button', { name: /^Réordonner .+ par glisser-déposer$/ }).first(),
    ).toBeVisible();

    await analyser(page, '/grand-public/statistiques (Composer l’écran)');

    // La disposition du compte est un état partagé (§4.4.6) : rien n'a bougé,
    // « Quitter » sort sans confirmation ni enregistrement.
    await page.getByRole('button', { name: 'Quitter', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Composer l’écran' })).toBeVisible();
  });
});
