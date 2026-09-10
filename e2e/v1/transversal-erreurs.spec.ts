import { expect, test } from '@playwright/test';

/**
 * TRA-09 et TRA-10 : le 404 profond et la frontière d'erreur de rendu.
 *
 * `/comptabilite` est déjà couvert par `e2e/redirections.spec.ts` (racine
 * inconnue) : ce qui manque est le chemin PROFOND, celui qu'un segment
 * dynamique pourrait absorber en silence.
 *
 * TRA-10 n'éprouve pas `/grand-public` : cette page précharge ses prospects
 * CÔTÉ SERVEUR et hydrate TanStack Query, si bien qu'aucun `page.route` du
 * navigateur ne peut lui servir une charge dégradée (voir
 * `transversal-pannes.spec.ts`). Le déclencheur retenu est
 * `/admin/referentiels/issues-appel`, dont la liste est lue côté navigateur :
 * `call-outcome-reasons-view.tsx` rend `query.data.map(...)` sans vérifier la
 * forme, donc `{"items":{}}` — accepté par `fetchCallOutcomeReasons`, qui ne
 * lit que `.items` — lève l'exception PENDANT LE RENDU et non dans la requête.
 * C'est exactement la frontière que le scénario vise.
 */

test('TRA-09 un chemin profond inconnu rend la page introuvable', async ({ page }) => {
  await page.goto('/admin/inexistant/profond');

  await expect(page.getByRole('heading', { name: 'Page introuvable', level: 1 })).toBeVisible();
  await expect(page.getByText('Cette adresse ne correspond à aucun écran du panel.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Revenir aux espaces' })).toHaveAttribute(
    'href',
    '/espaces',
  );
});

test('TRA-10 une exception de rendu laisse la coque debout et propose une sortie', async ({
  page,
}) => {
  await page.route('**/api/v1/call-outcome-reasons/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":{}}' }),
  );

  await page.goto('/admin/referentiels/issues-appel');

  const frontiere = page.getByRole('alert').filter({ hasText: 'Cet écran n’a pas pu s’afficher' });
  await expect(
    frontiere.getByRole('heading', { name: 'Cet écran n’a pas pu s’afficher', level: 2 }),
  ).toBeVisible();
  await expect(frontiere).toContainText('Rien n’a été perdu et le reste du panneau fonctionne.');
  await expect(frontiere.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  await expect(frontiere.getByRole('link', { name: 'Revenir aux espaces' })).toHaveAttribute(
    'href',
    '/espaces',
  );

  // La frontière est posée SOUS `layout.tsx` : seul le contenu est remplacé.
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('heading', { level: 1 })).toHaveText(
    'Listes de référence',
  );
});
