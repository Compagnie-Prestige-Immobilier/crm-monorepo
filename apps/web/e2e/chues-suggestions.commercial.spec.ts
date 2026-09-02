import { expect, request, test } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * `/chues/suggestions` : les numéros qu'un représentant qui refuse donne à
 * appeler à sa place.
 *
 * `serial` : les cinq parcours vivent sur LA carte posée par la préparation, et
 * CHU-SUG-03 la fait changer de statut.
 *
 * Un `RepresentantSuggestion` ne se supprime par aucune route de l'API — seule
 * la purge intégrale, interdite ici, l'efface. La convention du §5.1 s'applique
 * donc : identifiant d'exécution dans le nom, pour que deux exécutions ne se
 * voient jamais et que « la carte de ce spec » reste une carte unique.
 *
 * La tentative part de la session COMMERCIAL : un téléconseiller ne lit que les
 * numéros qu'on lui a donnés (`suggestions.service.ts`, `suggestedById`).
 */

test.describe.configure({ mode: 'serial' });
test.use({ storageState: 'e2e/.auth/commercial.json' });

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const COMMERCIAL_STORAGE_STATE = 'e2e/.auth/commercial.json';
const COMMERCIAL2_STORAGE_STATE = 'e2e/.auth/commercial2.json';

const RUN = String(Date.now()).slice(-8);

/** Plage réservée à ce fichier : +221 78 100 45 0x. */
const REPRESENTANT = { fullName: 'E2E-CHUES-SUG Refus', phone: '+221781004501' };

/** Le numéro dicté par le représentant, tel que le scénario CHU-SUG-02 le fixe. */
const SUGGESTION = {
  saisie: '77 123 45 90',
  affiche: '+221 77 123 45 90',
  nom: `E2E-CHUES-SUG ${RUN} Contact`,
};

let codeSource = '';

test.beforeAll(async () => {
  test.setTimeout(120_000);

  const api = await adminApi();
  const commercial = await request.newContext({
    baseURL: WEB_URL,
    storageState: COMMERCIAL_STORAGE_STATE,
  });

  try {
    const trouves = (await (
      await api.get('/api/v1/representants', {
        params: { search: REPRESENTANT.phone, pageSize: '50' },
      })
    ).json()) as { items: { id: string; phoneE164: string }[] };
    let representantId = trouves.items.find((row) => row.phoneE164 === REPRESENTANT.phone)?.id;

    if (representantId === undefined) {
      const departements = (await (
        await api.get('/api/v1/referentiels/departements', { params: { activeOnly: 'false' } })
      ).json()) as { id: string }[];
      const departement = departements[0];
      expect(departement, 'aucun département dans le référentiel').toBeDefined();

      const cree = await api.post('/api/v1/representants', {
        data: {
          fullName: REPRESENTANT.fullName,
          phone: REPRESENTANT.phone,
          departementId: departement?.id,
        },
      });
      expect(cree.ok(), `création du représentant : ${await cree.text()}`).toBe(true);
      representantId = ((await cree.json()) as { id: string }).id;
    }

    const attemptId = crypto.randomUUID();
    const tentative = await commercial.post('/api/v1/rep-campaigns/attempts', {
      data: {
        id: attemptId,
        representantId,
        outcome: 'REFUSED',
        suggestedPhone: SUGGESTION.saisie,
        suggestedName: SUGGESTION.nom,
        clientCreatedAt: new Date().toISOString(),
      },
    });
    expect(tentative.ok(), `tentative REFUSED : ${await tentative.text()}`).toBe(true);

    const liste = (await (
      await commercial.get('/api/v1/suggestions', { params: { pageSize: '100' } })
    ).json()) as { items: { suggestedName: string | null; sourceRepresentantShortCode: string }[] };
    const posee = liste.items.find((row) => row.suggestedName === SUGGESTION.nom);
    expect(posee, 'la suggestion n’est pas remontée après la tentative').toBeDefined();
    codeSource = posee?.sourceRepresentantShortCode ?? '';
  } finally {
    await api.dispose();
    await commercial.dispose();
  }
});

test('CHU-SUG-01 l’écran explique d’où viennent les numéros', async ({ page }) => {
  await page.goto('/chues/suggestions');
  await expect(page).toHaveTitle('Numéros suggérés · CPI GO');

  await expect(
    page.getByText(
      'Numéros donnés par un représentant qui décline, pour qu’un collègue soit appelé à sa place.',
      { exact: true },
    ),
  ).toBeVisible();

  const filtres = page.getByRole('group', { name: 'Filtrer par statut' });
  await expect(filtres).toHaveCount(1);
  await expect(filtres.getByRole('button', { name: 'Tous', exact: true })).toHaveCount(1);
});

test('CHU-SUG-02 une suggestion posée à l’étape 1 arrive ici', async ({ page }) => {
  await page.goto('/chues/suggestions');

  const carte = page
    .getByRole('list', { name: 'Numéros suggérés' })
    .getByRole('listitem')
    .filter({ hasText: SUGGESTION.nom });
  await expect(carte).toHaveCount(1);
  await expect(carte).toContainText(SUGGESTION.affiche);
  await expect(carte).toContainText(`Donné par le représentant ${codeSource}`);
  await expect(carte).toContainText('recueilli par Awa Fixture');
});

test('CHU-SUG-03 marquer appelé change le statut et le dit', async ({ page }) => {
  await page.goto('/chues/suggestions');

  const carte = page
    .getByRole('list', { name: 'Numéros suggérés' })
    .getByRole('listitem')
    .filter({ hasText: SUGGESTION.nom });
  await expect(carte.getByText('À appeler', { exact: true })).toHaveCount(1);

  await carte.getByRole('button', { name: 'Marquer appelé' }).click();

  await expect(page.getByText('Numéro marqué « Appelé ».', { exact: true })).toBeVisible();
  await expect(carte.getByText('Appelé', { exact: true })).toHaveCount(1);
  await expect(
    carte.getByRole('button', { name: 'Marquer appelé' }),
    'la liste n’a pas été invalidée : le geste se rejoue',
  ).toHaveCount(0);
  await expect(carte.getByRole('button', { name: 'Abandonner' })).toHaveCount(0);
});

test('CHU-SUG-04 chaque filtre a son propre état vide', async ({ page, browser }) => {
  // La réponse du STATUT filtré est posée : ce compte porte les numéros des
  // exécutions précédentes, et « aucun abandonné » ne se décrète pas. Le
  // filtrage lui-même reste éprouvé — sans le paramètre `status`, la route ne
  // répond pas et l'état vide attendu n'apparaît jamais.
  await page.route('**/api/v1/suggestions?**', async (route) => {
    const statut = new URL(route.request().url()).searchParams.get('status');
    if (statut !== 'ABANDONNE') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
        meta: { total: 0, page: 1, pageSize: 100, pageCount: 1 },
      }),
    });
  });

  await page.goto('/chues/suggestions');
  await page.getByRole('button', { name: 'Abandonné', exact: true }).click();

  await expect(page.getByText('Aucun numéro « Abandonné ».', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Retirez le filtre pour voir les autres numéros.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Aucun numéro suggéré pour l’instant.')).toHaveCount(0);

  // Sans filtre ET sans donnée : un second téléconseiller, à qui aucun
  // représentant n'a jamais rien dicté. Une suggestion ne se supprimant pas,
  // c'est le seul état vide non filtré qui reste reproductible.
  const contexte = await browser.newContext({ storageState: COMMERCIAL2_STORAGE_STATE });
  try {
    const vierge = await contexte.newPage();
    await vierge.goto(`${WEB_URL}/chues/suggestions`);
    await expect(
      vierge.getByText('Aucun numéro suggéré pour l’instant.', { exact: true }),
    ).toBeVisible();
    await expect(
      vierge.getByText(
        'Un numéro arrive ici quand un représentant en décline un autre depuis la console d’appel ou le mobile.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(vierge.getByText('Retirez le filtre pour voir les autres numéros.')).toHaveCount(
      0,
    );
  } finally {
    await contexte.close();
  }
});

test('CHU-SUG-05 « Créer la fiche » pré-remplit avec le numéro suggéré', async ({ page }) => {
  await page.goto('/chues/suggestions');

  const carte = page
    .getByRole('list', { name: 'Numéros suggérés' })
    .getByRole('listitem')
    .filter({ hasText: SUGGESTION.nom });
  await carte.getByRole('button', { name: 'Créer la fiche' }).click();

  const dialogue = page.getByRole('dialog');
  await expect(dialogue.getByRole('heading', { name: 'Nouveau représentant' })).toBeVisible();
  await expect(dialogue.getByLabel('Nom complet')).toHaveValue(SUGGESTION.nom);
  await expect(dialogue.getByLabel('Téléphone')).toHaveValue(SUGGESTION.affiche);

  // La fiche n'est PAS créée : le scénario s'arrête au pré-remplissage.
  await page.keyboard.press('Escape');
  await expect(dialogue).toHaveCount(0);
});
