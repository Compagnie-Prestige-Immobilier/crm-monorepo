import { expect, test } from '@playwright/test';

/**
 * TRA-01 à TRA-03 : la boîte de réception hors coque et la cloche par rôle.
 *
 * `INBOX_ROLES` (`src/components/layout/nav-items.ts`) ouvre `/notifications` à
 * cinq rôles et l'ADMIN y est renvoyé vers son composeur. Le téléconseiller en
 * est exclu : ses notifications visent l'application mobile. Ce qui se joue ici
 * est la CONCORDANCE entre la cloche et la boîte : une cloche montrée à un rôle
 * sans boîte mène droit sur un refus, et un rôle sans droit de composition à qui
 * l'on propose « Nouvelle notification » écrit un envoi que l'API refusera.
 *
 * Aucune donnée créée : ce fichier lit six sessions déjà posées sur disque.
 */

/** `bellLabel` (`src/lib/data/inbox.ts`) compose le nom avec le nombre de non-lues. */
const CLOCHE = /^Notifications, (aucune|\d+) non lues?$/;

test.describe('TRA-01 · un rôle à boîte ne voit que sa boîte', () => {
  test.use({ storageState: 'e2e/.auth/superviseur.json' });

  test('TRA-01 la supervision n’a ni historique, ni gabarits, ni composition', async ({ page }) => {
    await page.goto('/notifications');

    // Le titre du DOCUMENT est posé par la page : la coque seule ne le porte pas.
    await expect(page).toHaveTitle('Notifications · CPI GO');
    await expect(page.getByRole('tab', { name: 'Boîte de réception' })).toBeVisible();

    await expect(page.getByRole('tab', { name: 'Historique' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Gabarits' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nouvelle notification' })).toHaveCount(0);
  });
});

test.describe('TRA-02 · un téléconseiller n’a ni boîte ni cloche', () => {
  test.use({ storageState: 'e2e/.auth/commercial.json' });

  test('TRA-02 le refus est lisible et aucune notification n’est chargée', async ({ page }) => {
    // Posé AVANT le goto : « l'écran affiche un refus » et « l'écran a chargé
    // les données puis affiché un refus par-dessus » ne se distinguent que là.
    const chargees: string[] = [];
    page.on('response', (response) => {
      const { pathname } = new URL(response.url());
      if (pathname.startsWith('/api/v1/notifications') && response.status() < 400) {
        chargees.push(pathname);
      }
    });

    await page.goto('/notifications');

    const refus = page.getByRole('alert').filter({ hasText: 'Accès refusé' });
    await expect(refus.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
    await expect(refus).toContainText(
      'Les notifications est réservé à un autre rôle. Rôle en cours : Téléconseiller.',
    );
    await expect(page.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute(
      'href',
      '/espaces',
    );

    await expect(page.getByRole('banner').getByRole('button', { name: CLOCHE })).toHaveCount(0);
    expect(
      chargees,
      'aucune notification ne doit être lue pour un rôle qui n’a pas de boîte',
    ).toEqual([]);
  });
});

const ROLES_A_BOITE = [
  { role: 'ADMIN', session: 'admin', boite: '/admin/notifications?onglet=reception' },
  { role: 'DIRECTION', session: 'direction', boite: '/notifications' },
  { role: 'SUPERVISEUR', session: 'superviseur', boite: '/notifications' },
  { role: 'BANQUE_FINANCE', session: 'banque', boite: '/notifications' },
  { role: 'ACCUEIL', session: 'accueil', boite: '/notifications' },
] as const;

for (const { role, session, boite } of ROLES_A_BOITE) {
  test.describe(`TRA-03 · la cloche de ${role}`, () => {
    test.use({ storageState: `e2e/.auth/${session}.json` });

    test(`TRA-03 ${role} porte une cloche qui mène à sa boîte`, async ({ page }) => {
      await page.goto('/notifications');

      const cloche = page.getByRole('banner').getByRole('button', { name: CLOCHE });
      await expect(cloche, `${role} devrait porter exactement une cloche`).toHaveCount(1);

      await cloche.click();
      await expect(
        page.getByRole('link', { name: 'Tout voir' }),
        `la cloche de ${role} devrait mener à ${boite}`,
      ).toHaveAttribute('href', boite);
    });
  });
}

test.describe('TRA-03 · contre-épreuve du téléconseiller', () => {
  test.use({ storageState: 'e2e/.auth/commercial.json' });

  test('TRA-03 COMMERCIAL ne porte aucune cloche sur son propre espace', async ({ page }) => {
    await page.goto('/chues');
    await expect(page).toHaveTitle('Projet CHUES · CPI GO');

    await expect(
      page.getByRole('banner').getByRole('button', { name: CLOCHE }),
      'COMMERCIAL n’a pas de boîte : la cloche ne doit pas exister',
    ).toHaveCount(0);
  });
});
