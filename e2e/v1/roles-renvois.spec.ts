import { expect, test, type Page } from '@playwright/test';

/**
 * ROL-23 à ROL-27 : les routes qui RENVOIENT au lieu de refuser.
 *
 * Un renvoi n'est pas un refus adouci : c'est une promesse d'arriver
 * ailleurs. Les trois défauts qu'il peut porter sont ici, chacun dans son
 * parcours — le renvoi devenu refus, le renvoi qui boucle (le `waitForURL`
 * expire), et le renvoi qui perd son paramètre en chemin.
 */

const SESSIONS = {
  admin: 'v1/.auth/admin.json',
  direction: 'v1/.auth/direction.json',
  superviseur: 'v1/.auth/superviseur.json',
  accueil: 'v1/.auth/accueil.json',
  banque: 'v1/.auth/banque.json',
  commercial: 'v1/.auth/commercial.json',
} as const;

async function aucunRefus(page: Page, ou: string): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'Accès refusé', level: 2 }),
    `${ou} : le renvoi est devenu un refus`,
  ).toHaveCount(0);
}

/**
 * ROL-23 : `/admin/notifications` renvoie vers la boîte de réception les rôles
 * qui en ont une. Un refus ici couperait un rôle de ses propres notifications.
 */
for (const [role, session] of [
  ['DIRECTION', SESSIONS.direction],
  ['SUPERVISEUR', SESSIONS.superviseur],
  ['ACCUEIL', SESSIONS.accueil],
  ['BANQUE_FINANCE', SESSIONS.banque],
] as const) {
  test.describe(`ROL-23 · ${role}`, () => {
    test.use({ storageState: session });

    test(`ROL-23 · /admin/notifications renvoie ${role} vers sa boîte`, async ({ page }) => {
      await page.goto('/admin/notifications');

      // Le chemin est comparé EN ENTIER : `**/notifications` serait aussi
      // satisfait par `/admin/notifications`, c'est-à-dire par l'absence de
      // renvoi.
      await page.waitForURL((url) => url.pathname === '/notifications');
      expect(new URL(page.url()).pathname).toBe('/notifications');

      await expect(page.getByRole('tab', { name: 'Boîte de réception' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(
        page.getByRole('group', { name: 'Filtrer la boîte de réception' }),
      ).toBeVisible();
      await aucunRefus(page, `/admin/notifications pour ${role}`);
    });
  });
}

test.describe('ROL-24', () => {
  test.use({ storageState: SESSIONS.admin });

  test('ROL-24 · /notifications renvoie l’administrateur vers le composeur, onglet réception', async ({
    page,
  }) => {
    await page.goto('/notifications');

    // Le paramètre fait partie de la promesse : sans lui, l'administrateur
    // arrive sur le composeur et non sur sa boîte.
    await page.waitForURL(/\/admin\/notifications\?onglet=reception$/);
    await expect(page).toHaveURL(/\/admin\/notifications\?onglet=reception$/);

    await expect(page.getByRole('tab', { name: 'Boîte de réception' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await aucunRefus(page, '/notifications pour un administrateur');
  });
});

test.describe('ROL-25', () => {
  test.use({ storageState: SESSIONS.banque });

  test('ROL-25 · un agent Banque & Finance est renvoyé de /chues vers son tableau de bord', async ({
    page,
  }) => {
    await page.goto('/chues');

    await page.waitForURL('**/chues/banque');
    await expect(page).toHaveURL(/\/chues\/banque$/);
    // Le titre du DOCUMENT, posé par la page : le titre de niveau 1 vient de
    // la barre supérieure et vaudrait aussi pour une page qui n'a rien rendu.
    await expect(page).toHaveTitle(/Tableau de bord bancaire/);
    await aucunRefus(page, '/chues pour un agent bancaire');
  });
});

/**
 * ROL-26 : les deux anciennes adresses de tableau de bord. Des notifications
 * déjà enregistrées en base les portent encore ; un renvoi retiré les ferait
 * toutes tomber en 404.
 */
test.describe('ROL-26', () => {
  test.use({ storageState: SESSIONS.superviseur });

  test('ROL-26 · /chues/tableau-de-bord renvoie en permanence vers /chues/statistiques', async ({
    page,
  }) => {
    await page.goto('/chues/tableau-de-bord');
    await expect(page).toHaveURL(/\/chues\/statistiques$/);

    await expect(page.getByText('Par téléconseiller', { exact: true })).toBeVisible();
  });

  test('ROL-26 · /grand-public/tableau-de-bord renvoie en permanence vers /grand-public/statistiques', async ({
    page,
  }) => {
    await page.goto('/grand-public/tableau-de-bord');
    await expect(page).toHaveURL(/\/grand-public\/statistiques$/);

    await expect(page.getByRole('button', { name: 'Composer l’écran' })).toBeVisible();
  });
});

/**
 * ROL-27 : un téléconseiller sur une route de lot d'export est renvoyé vers
 * `/chues`, SANS UN MOT.
 *
 * INCOHÉRENCE ASSUMÉE PAR LE CODE : `campagnes/page.tsx` et
 * `campagnes/[id]/page.tsx` écrivent `redirect('/chues')` là où tous les
 * autres écrans rendent `PermissionDenied`. Le rôle refusé n'apprend rien de
 * ce qui vient de se passer. Ce parcours FIGE le comportement actuel ; le
 * traitement du refus est à trancher par le propriétaire produit.
 *
 * L'identifiant employé n'existe pas, et c'est sans conséquence : la garde
 * tranche AVANT toute lecture du lot. Aucun lot n'est d'ailleurs ouvrable sur
 * cette base — `GET /api/v1/lots-export` répond 500 (§8, Q-15).
 */
test.describe('ROL-27', () => {
  test.use({ storageState: SESSIONS.commercial });

  const LOT = '00000000-0000-4000-8000-000000000000';

  for (const route of [
    '/chues/campagnes',
    `/chues/campagnes/${LOT}`,
    `/grand-public/campagnes/${LOT}`,
  ]) {
    test(`ROL-27 · ${route} renvoie un téléconseiller vers /chues`, async ({ page }) => {
      await page.goto(route);

      await page.waitForURL('**/chues');
      await expect(page, `${route} devrait renvoyer vers /chues`).toHaveURL(/\/chues$/);
      await expect(page.getByText('Trois étapes, dans l’ordre.')).toBeVisible();
    });
  }
});
