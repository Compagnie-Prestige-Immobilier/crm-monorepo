import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * GP-01 à GP-12 : la liste des prospects Grand Public (`/grand-public`).
 *
 * Écran : `apps/web/src/components/grand-public/prospects-view.tsx`.
 * Plage de téléphones réservée : `+221781002000` à `+221781002019` (E2E.md §5.2).
 * Préfixe de données : `E2E-GP-LST-`, porté par le PRÉNOM des fiches, seul champ
 * que la recherche du serveur inspecte avec le nom et le téléphone.
 *
 * La base est partagée avec d'autres suites qui écrivent en même temps : aucune
 * assertion de comptage ne porte sur le total de l'écran, toutes passent par une
 * recherche sur ce préfixe ou sur un numéro de la plage.
 */

test.use({ storageState: 'v1/.auth/admin.json' });

const PREFIXE = 'E2E-GP-LST';
/** Douze fiches : au-delà de la plus petite pagination (10), donc deux pages. */
const TEMOINS = Array.from({ length: 12 }, (_, index) => ({
  prenom: PREFIXE,
  nom: `Temoin${String(index + 1).padStart(2, '0')}`,
  phone: `+22178100${String(2001 + index)}`,
}));

const PREMIER = TEMOINS[0]!;

interface Fiche {
  id: string;
  phoneE164: string;
  prenom: string;
  nom: string;
}

async function lire<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(
    response.ok(),
    `${response.url()} a répondu ${String(response.status())} : ${await response.text()}`,
  ).toBe(true);
  return (await response.json()) as T;
}

/**
 * Le nettoyage se fait EN DÉBUT de parcours (E2E.md §5.1) : un `afterAll` ne
 * tourne pas après un échec dur, et le reliquat sert alors au diagnostic.
 * La suppression est logique et l'index d'unicité du téléphone est partiel :
 * les numéros de la plage redeviennent ressaisissables.
 *
 * Chaque `test.use` de session ou de fenêtre redémarre le worker, donc rejoue ce
 * hook : il RELIT d'abord, et ne réécrit que si la plage n'est pas déjà en état.
 */
test.beforeAll(async () => {
  const api = await adminApi();
  try {
    const trouves = await lire<{ items: Fiche[] }>(
      await api.get('/api/v1/prospects', {
        params: { search: PREFIXE, projet: 'GRAND_PUBLIC', pageSize: '100' },
      }),
    );
    const miennes = trouves.items.filter((fiche) => fiche.prenom.startsWith(PREFIXE));
    const enPlace = TEMOINS.every((temoin) =>
      miennes.some((fiche) => fiche.phoneE164 === temoin.phone),
    );
    if (enPlace && miennes.length === TEMOINS.length) return;

    for (const fiche of miennes) await api.delete(`/api/v1/prospects/${fiche.id}`);
    for (const temoin of TEMOINS) {
      await lire<{ id: string }>(
        await api.post('/api/v1/prospects', { data: { ...temoin, projet: 'GRAND_PUBLIC' } }),
      );
    }
  } finally {
    await api.dispose();
  }
});

function compteur(page: Page) {
  return page.getByRole('status').filter({ hasText: 'Prospects affichés' });
}

function lignes(page: Page) {
  // §1.13 : plusieurs listes du panel sont rendues deux fois (cartes puis
  // tableau). On borne au tableau, et la première ligne est celle des en-têtes.
  return page.getByRole('table').getByRole('row');
}

async function chercher(page: Page, terme: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Rechercher' }).fill(terme);
  await expect(page).toHaveURL(
    new RegExp(`search=${encodeURIComponent(terme).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}`),
  );
}

test('GP-01 la liste rend sa page, pas seulement la coque du panel', async ({ page }) => {
  await page.goto('/grand-public');

  await expect(page).toHaveTitle(/Prospects Grand Public/);
  await expect(
    page.getByText(
      'Les particuliers démarchés hors syndicat. Les fiches CHUES ne figurent pas ici.',
    ),
  ).toBeVisible();

  for (const colonne of [
    'Nom',
    'Statut',
    'Situation',
    'Profession',
    'Canal',
    'Banque',
    'Segment',
    'Téléconseiller',
    'Saisi le',
  ]) {
    await expect(
      page.getByRole('columnheader', { name: colonne, exact: true }),
      `la colonne ${colonne} devrait être rendue`,
    ).toBeVisible();
  }

  await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*\d+–\d+ sur \d+$/u);
  await expect(
    page.getByText('La liste des prospects Grand Public n’a pas pu être chargée.'),
  ).toHaveCount(0);
});

test('GP-02 le filtre de statut vit dans l’URL et survit au rechargement', async ({ page }) => {
  await page.goto('/grand-public');
  await page.getByRole('button', { name: 'Filtres', exact: true }).click();

  const nouveau = page
    .getByRole('group', { name: 'Statut' })
    .getByRole('button', { name: 'Nouveau', exact: true });
  await nouveau.click();

  await expect(page).toHaveURL(/\/grand-public\?statut=NOUVEAU$/);
  await expect(nouveau).toHaveAttribute('aria-pressed', 'true');
  await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*\d+–\d+ sur \d+$/u);

  // Preuve que le filtre a FILTRÉ : hors la ligne d'en-têtes, aucune ligne ne
  // porte un autre statut que « Nouveau ».
  await expect(lignes(page).filter({ hasNotText: 'Nouveau' })).toHaveCount(1);

  const filtre = (await compteur(page).textContent())?.trim() ?? '';
  expect(filtre.length).toBeGreaterThan(0);

  await page.reload();
  await expect(page).toHaveURL(/\/grand-public\?statut=NOUVEAU$/);
  await expect(compteur(page)).toHaveText(filtre);
  await expect(
    page
      .getByRole('group', { name: 'Statut' })
      .getByRole('button', { name: 'Nouveau', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('GP-03 le bouton « Filtres » compte les critères actifs', async ({ page }) => {
  await page.goto('/grand-public');
  await page.getByRole('button', { name: 'Filtres', exact: true }).click();

  await page
    .getByRole('group', { name: 'Statut' })
    .getByRole('button', { name: 'Nouveau', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Filtres (1)' })).toBeVisible();

  await page.getByRole('button', { name: 'Saisi à partir du' }).click();
  await page.getByRole('button', { name: 'Aujourd’hui' }).click();

  await expect(page).toHaveURL(/dateFrom=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole('button', { name: 'Filtres (2)' })).toBeVisible();
});

test('GP-04 « Tout effacer » retire tous les critères', async ({ page }) => {
  await page.goto('/grand-public');
  await page.getByRole('button', { name: 'Filtres', exact: true }).click();
  await page
    .getByRole('group', { name: 'Statut' })
    .getByRole('button', { name: 'Nouveau', exact: true })
    .click();
  // Le second critère n'est posé qu'une fois le premier inscrit dans l'URL :
  // `setFilters` part des filtres lus dans `useSearchParams`, et deux gestes
  // enchaînés avant la navigation en perdraient un.
  await expect(page.getByRole('button', { name: 'Filtres (1)' })).toBeVisible();
  await page.getByRole('button', { name: 'Saisi à partir du' }).click();
  await page.getByRole('button', { name: 'Aujourd’hui' }).click();
  await expect(page.getByRole('button', { name: 'Filtres (2)' })).toBeVisible();

  await page.getByRole('button', { name: 'Tout effacer' }).click();

  // Le compteur global n'est PAS comparé : la base est partagée et grossit
  // pendant l'exécution (E2E.md §4.3.2). Ce qui prouve la remise à zéro, c'est
  // que chacun des deux critères a disparu de l'URL ET de son contrôle.
  await expect(page).toHaveURL(/\/grand-public$/);
  await expect(
    page
      .getByRole('group', { name: 'Statut' })
      .getByRole('button', { name: 'Nouveau', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Saisi à partir du' })).toHaveText('dd-mm-yyyy');
  await expect(page.getByRole('button', { name: 'Filtres', exact: true })).toBeVisible();
  await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*1–\d+ sur \d+$/u);
});

test('GP-05 la recherche par téléphone atteint le numéro normalisé', async ({ page }) => {
  await page.goto('/grand-public');
  await chercher(page, PREMIER.phone);

  await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*1–1 sur 1$/u);
  await expect(lignes(page)).toHaveCount(2);
  await expect(
    page
      .getByRole('table')
      .getByRole('link', { name: `${PREFIXE} ${PREMIER.nom} +221 78 100 20 01` }),
  ).toBeVisible();
});

test('GP-06 l’état vide filtré ne se confond pas avec l’état vide initial', async ({ page }) => {
  await page.goto('/grand-public');
  await chercher(page, 'E2E-GP-inexistant-zzz');

  await expect(page.getByText('Aucun prospect ne correspond à ces filtres.')).toBeVisible();
  await expect(page.getByText('Élargissez la période ou retirez un critère.')).toBeVisible();
  await expect(page.getByText('Aucun prospect Grand Public n’a encore été saisi.')).toHaveCount(0);
});

test('GP-07 la pagination sert la page annoncée et garde ses butées', async ({ page }) => {
  await page.goto('/grand-public');
  await chercher(page, PREFIXE);
  await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*1–12 sur 12$/u);

  await page.getByRole('combobox', { name: 'Lignes' }).click();
  await page.getByRole('option', { name: '10', exact: true }).click();

  await expect(page).toHaveURL(/pageSize=10/);
  await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*1–10 sur 12$/u);
  await expect(page.getByRole('button', { name: 'Page précédente' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Page suivante' })).toBeEnabled();
  await expect(lignes(page)).toHaveCount(11);

  await page.getByRole('button', { name: 'Page suivante' }).click();

  await expect(page).toHaveURL(/page=2/);
  await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*11–12 sur 12$/u);
  await expect(lignes(page)).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Page suivante' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Page précédente' })).toBeEnabled();
});

test.describe('GP-09 rôle lecteur : SUPERVISEUR', () => {
  test.use({ storageState: 'v1/.auth/superviseur.json' });

  test('GP-09 SUPERVISEUR lit la liste sans se voir proposer la création', async ({ page }) => {
    await page.goto('/grand-public');

    await expect(page).toHaveTitle(/Prospects Grand Public/);
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Prospects Grand Public', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nouveau prospect' })).toHaveCount(0);
  });
});

test.describe('GP-09 rôle lecteur : DIRECTION', () => {
  test.use({ storageState: 'v1/.auth/direction.json' });

  test('GP-09 DIRECTION lit la liste sans se voir proposer la création', async ({ page }) => {
    await page.goto('/grand-public');

    await expect(page).toHaveTitle(/Prospects Grand Public/);
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Prospects Grand Public', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nouveau prospect' })).toHaveCount(0);
  });
});

test('GP-10 une panne du référentiel des canaux ne fait pas tomber la liste', async ({ page }) => {
  await page.route('**/api/v1/referentiels/canaux-provenance*', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'panne simulée' }),
    }),
  );

  await page.goto('/grand-public');

  await expect(page.getByRole('table')).toBeVisible();
  await expect(compteur(page)).toHaveText(/^Prospects affichés\s*:\s*\d+–\d+ sur \d+$/u);
  await expect(
    page.getByText(
      'La liste des canaux de provenance n’a pas pu être chargée. Les autres filtres restent utilisables.',
    ),
  ).toBeVisible();
});

test.describe('GP-11 largeur 375 px', () => {
  test.use({ viewport: { width: 375, height: 780 } });

  test('GP-11 le tableau défile seul, la page ne défile pas latéralement', async ({ page }) => {
    await page.goto('/grand-public');
    await expect(page.getByRole('table')).toBeVisible();

    const cadre = await page.getByRole('table').evaluate((table) => {
      const conteneur = table.parentElement as HTMLElement;
      return {
        deborde: conteneur.scrollWidth > conteneur.clientWidth,
        overflowX: getComputedStyle(conteneur).overflowX,
      };
    });
    expect(cadre.overflowX, 'le cadre du tableau doit porter le défilement').toBe('auto');
    expect(cadre.deborde, 'le tableau doit déborder de son cadre à 375 px').toBe(true);

    const document375 = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(document375, 'la page entière ne doit pas défiler latéralement').toBe(true);

    await expect(compteur(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Page suivante' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nouveau prospect' })).toBeVisible();
  });
});

test('GP-12 « Appeler » sur une ligne ouvre l’appel du prospect', async ({ page }) => {
  await page.goto('/grand-public');
  await chercher(page, PREMIER.phone);

  await page
    .getByRole('table')
    .getByRole('link', { name: `Appeler ${PREFIXE} ${PREMIER.nom}` })
    .click();

  await page.waitForURL(/\/grand-public\/appel\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole('main').getByRole('heading', { name: `${PREFIXE} ${PREMIER.nom}`, level: 1 }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Joignable', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /Statut de qualification/ })).toBeVisible();
});
