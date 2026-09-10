import { expect, test } from '@playwright/test';

/**
 * TRA-04 à TRA-08 : session expirée et codes d'erreur du relais.
 *
 * Les pannes sont simulées UNIQUEMENT dans le navigateur (`page.route`,
 * `context.clearCookies`) : l'API, PostgreSQL et le serveur Next sont partagés
 * avec les autres parcours, et les éteindre pour éprouver un message d'erreur
 * ferait tomber tout le reste.
 *
 * L'ÉCRAN D'ÉPREUVE n'est pas `/grand-public` comme l'annonçait le plan.
 * `app/(panel)/grand-public/page.tsx` précharge `GET /api/v1/prospects` CÔTÉ
 * SERVEUR et hydrate TanStack Query (`staleTime` de 30 s) : le navigateur
 * n'émet jamais cette requête, et aucun `page.route` ne peut donc l'atteindre.
 * Constaté au navigateur : sur `/grand-public`, seul `/api/v1/notifications/mine`
 * (la cloche) part du navigateur, au chargement comme après un changement de
 * filtre. `/admin/referentiels/issues-appel` est le plus proche équivalent
 * réellement interceptable : réservé à l'ADMIN, une seule requête cliente,
 * `GET /api/v1/call-outcome-reasons/administration`, rendue par le même
 * `QueryErrorState` que la liste Grand Public.
 *
 * Aucune donnée créée, aucune donnée lue en propre : tout passe par la réponse
 * falsifiée.
 */

test.describe.configure({ mode: 'serial' });

const ECRAN = '/admin/referentiels/issues-appel';
const DONNEES_DE_L_ECRAN = '**/api/v1/call-outcome-reasons/**';

test('TRA-05 une API injoignable rend « Serveur injoignable », coque comprise', async ({
  page,
}) => {
  await page.route('**/api/v1/**', (route) => route.abort('connectionrefused'));

  await page.goto(ECRAN);

  const panne = page.getByRole('alert').filter({ hasText: 'Serveur injoignable' });
  await expect(panne.getByRole('heading', { name: 'Serveur injoignable', level: 2 })).toBeVisible();
  await expect(panne).toContainText('Serveur injoignable. Vérifiez la connexion, puis réessayez.');
  await expect(panne.getByRole('button', { name: 'Réessayer' })).toBeVisible();

  // La coque survit à la panne : la frontière d'erreur est sous `layout.tsx`.
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('heading', { level: 1 })).toHaveText(
    'Listes de référence',
  );
});

test('TRA-06 un 429 invite à patienter au lieu d’annoncer une panne', async ({ page }) => {
  // Jamais un vrai 429 : le limiteur est partagé, et le marteler ferait tomber
  // les autres parcours pour une minute.
  await page.route(DONNEES_DE_L_ECRAN, (route) =>
    route.fulfill({ status: 429, contentType: 'application/json', body: '{}' }),
  );

  await page.goto(ECRAN);

  const alerte = page.getByRole('alert').filter({ hasText: 'Chargement impossible' });
  await expect(alerte.getByRole('heading', { level: 2 })).toHaveText('Chargement impossible');
  await expect(alerte).toContainText('Trop de requêtes. Patientez quelques secondes.');
});

test('TRA-07 un 500 est réessayable et le dit', async ({ page }) => {
  await page.route(DONNEES_DE_L_ECRAN, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );

  await page.goto(ECRAN);

  const alerte = page.getByRole('alert').filter({ hasText: 'Erreur serveur' });
  await expect(alerte.getByRole('heading', { name: 'Erreur serveur', level: 2 })).toBeVisible();
  await expect(alerte).toContainText('Erreur serveur (500). Réessayez.');
  await expect(alerte.getByRole('button', { name: 'Réessayer' })).toBeVisible();
});

test('TRA-08 un 403 ne propose pas de nouvel essai', async ({ page }) => {
  await page.route(DONNEES_DE_L_ECRAN, (route) =>
    route.fulfill({ status: 403, contentType: 'application/json', body: '{}' }),
  );

  await page.goto(ECRAN);

  const alerte = page.getByRole('alert').filter({ hasText: 'Accès refusé' });
  await expect(alerte.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
  await expect(alerte).toContainText('Cette action est réservée à un autre rôle.');
  await expect(
    alerte.getByRole('button', { name: 'Réessayer' }),
    'un refus ne se résout pas par un nouvel essai',
  ).toHaveCount(0);
});

/**
 * EN DERNIER, et dans un contexte jetable : effacer les cookies d'une session
 * partagée ferait échouer tout ce qui suit, ici comme dans un autre fichier.
 */
test('TRA-04 une session expirée renvoie à la connexion', async ({ browser }) => {
  const context = await browser.newContext({ storageState: 'v1/.auth/admin.json' });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:4000/grand-public');
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Prospects Grand Public', level: 1 }),
    ).toBeVisible();

    await context.clearCookies();

    // Ce que le relais rend RÉELLEMENT au navigateur une fois les cookies
    // effacés. `app/api/v1/[...path]/route.ts` sort dès la ligne 88, avant la
    // branche qui porte `code: 'SESSION_EXPIRED'` : le plan attendait ce code,
    // il n'est pas là. Le contexte de requête partage le pot à cookies de la
    // page, donc c'est bien la session du navigateur qui est éprouvée.
    const expiration = await context.request.get(
      'http://localhost:4000/api/v1/notifications/mine',
      { params: { pageSize: '20' } },
    );
    expect(expiration.status()).toBe(401);
    expect(await expiration.json()).toEqual({ error: 'Session expirée.' });

    await page.getByRole('button', { name: /^Filtres/ }).click();
    await page.getByRole('button', { name: 'Fonctionnaire', exact: true }).click();

    // Le layout du panel est `force-dynamic` : le rendu serveur du changement de
    // filtre ne trouve plus de session et renvoie lui-même à la connexion.
    await page.waitForURL('**/connexion');
    await expect(page.getByRole('heading', { name: 'Connexion', level: 1 })).toBeVisible();
    await expect(
      page.getByText('Session expirée. Rechargez la page.'),
      'le message du relais n’a aucune chance d’être vu : la page a déjà changé',
    ).toHaveCount(0);

    await page.reload();
    await expect(page).toHaveURL(/\/connexion$/);
  } finally {
    await context.close();
  }
});
