import { expect, request, test, type APIRequestContext } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * GP-31 à GP-33 : `/grand-public/rappels`.
 *
 * La page réexporte celle de CHUES et `rappels-view.tsx` lit le projet dans
 * l'URL. Ce qui est éprouvé ici est donc le cloisonnement des deux files, pas
 * la mécanique des échéances, couverte par `chues-rappels.commercial.spec.ts`.
 *
 * Le rappel promis ne se pose par aucun écran de ce périmètre : la console
 * Grand Public a été vidée (§2.1). On emprunte le canal du mobile,
 * `POST /api/v1/sync/push` avec une tentative d'issue CALLBACK, comme
 * `ensureBankEligibleClient` dans `e2e/fixtures.ts`. Le rappel est assigné à
 * l'auteur de la tentative : il est poussé avec la session du téléconseiller.
 */

test.use({ storageState: 'v1/.auth/commercial.json' });

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:4000';
const COMMERCIAL_STATE = 'v1/.auth/commercial.json';
const SUPERVISEUR_STATE = 'v1/.auth/superviseur.json';

/**
 * Plage réservée à ce fichier (§5.2), et suffixe STABLE : ces fiches se
 * suppriment, donc le nettoyage se fait en tête de parcours et sait ce qu'il
 * ramasse (§5.1).
 */
const CIBLE_GP = {
  phone: '+221781002060',
  affiche: '+221 78 100 20 60',
  nom: 'E2E-GP-RAP-grandpublic',
  projet: 'GRAND_PUBLIC',
} as const;

const CIBLE_CHUES = {
  phone: '+221781002061',
  affiche: '+221 78 100 20 61',
  nom: 'E2E-GP-RAP-chues',
  projet: 'CHUES',
} as const;

/** Trois jours : dans « Cette semaine », hors de « En retard » et d'« Aujourd’hui ». */
const DANS_TROIS_JOURS = 3 * 24 * 60 * 60 * 1000;

interface ProspectRow {
  id: string;
  phoneE164: string;
}

async function supprimerParTelephone(api: APIRequestContext, phone: string): Promise<void> {
  const response = await api.get('/api/v1/prospects', {
    params: { search: phone, pageSize: '50' },
  });
  expect(response.ok(), `${response.url()} a répondu ${String(response.status())}`).toBe(true);
  const { items } = (await response.json()) as { items: ProspectRow[] };
  for (const row of items.filter((item) => item.phoneE164 === phone)) {
    await api.delete(`/api/v1/prospects/${row.id}`);
  }
}

async function creerProspect(
  api: APIRequestContext,
  cible: typeof CIBLE_GP | typeof CIBLE_CHUES,
): Promise<string> {
  const created = await api.post('/api/v1/prospects', {
    data: { nom: cible.nom, prenom: 'Rappel', phone: cible.phone, projet: cible.projet },
  });
  expect(
    created.ok(),
    `Création de ${cible.phone} : ${String(created.status())} ${await created.text()}`,
  ).toBe(true);
  const body = (await created.json()) as { id: string };
  return body.id;
}

/** Une tentative d'issue CALLBACK : c'est elle qui inscrit l'échéance. */
async function promettreUnRappel(
  api: APIRequestContext,
  prospectId: string,
  callbackAt: string,
): Promise<void> {
  const opId = crypto.randomUUID();
  const at = new Date().toISOString();
  const response = await api.post('/api/v1/sync/push', {
    headers: { 'Idempotency-Key': opId },
    data: {
      clientBatchId: opId,
      payloadVersion: 1,
      operations: [
        {
          opId,
          seq: 0,
          entity: 'call_attempt',
          op: 'create',
          entityId: opId,
          clientUpdatedAt: at,
          data: { prospectId, outcome: 'CALLBACK', callbackAt, clientCreatedAt: at },
        },
      ],
    },
  });
  expect(
    response.ok(),
    `Remontée de la tentative : ${String(response.status())} ${await response.text()}`,
  ).toBe(true);
  const body = (await response.json()) as {
    results: { status: string; errorCode: string | null }[];
  };
  expect(body.results[0]?.status, `Tentative refusée : ${JSON.stringify(body.results)}`).toBe(
    'applied',
  );
}

test.beforeAll(async () => {
  const admin = await adminApi();
  const commercial = await request.newContext({
    baseURL: WEB_URL,
    storageState: COMMERCIAL_STATE,
  });
  try {
    const callbackAt = new Date(Date.now() + DANS_TROIS_JOURS).toISOString();
    for (const cible of [CIBLE_GP, CIBLE_CHUES]) {
      await supprimerParTelephone(admin, cible.phone);
      const id = await creerProspect(admin, cible);
      await promettreUnRappel(commercial, id, callbackAt);
    }
  } finally {
    await admin.dispose();
    await commercial.dispose();
  }
});

test('GP-31 · la file Grand Public ne demande et ne montre que du Grand Public', async ({
  page,
}) => {
  const interrogations: URL[] = [];
  page.on('request', (requete) => {
    const url = new URL(requete.url());
    if (url.pathname === '/api/v1/phase2/callbacks') interrogations.push(url);
  });

  await page.goto('/grand-public/rappels');
  await expect(page).toHaveTitle(/^Rappels · CPI GO$/u);

  await page.getByRole('tab', { name: 'Cette semaine' }).click();
  const ligne = page.getByRole('row').filter({ hasText: CIBLE_GP.affiche });
  await expect(ligne).toHaveCount(1);

  expect(interrogations.length, 'aucun appel à /api/v1/phase2/callbacks observé').toBeGreaterThan(
    0,
  );
  for (const url of interrogations) {
    expect(
      url.searchParams.get('projet'),
      `${url.pathname}?${url.searchParams.toString()} devrait porter projet=GRAND_PUBLIC`,
    ).toBe('GRAND_PUBLIC');
  }

  // Le rappel CHUES est promis par le MÊME téléconseiller, à la MÊME échéance :
  // seul le projet le distingue. Sa présence ici prouverait que la page
  // réexportée sert l'autre file.
  await expect(page.getByRole('row').filter({ hasText: CIBLE_CHUES.affiche })).toHaveCount(0);
});

test('GP-32 · chaque portée a son propre état vide', async ({ page }) => {
  await page.goto('/grand-public/rappels');

  // « En retard » est la portée d'ouverture ; l'échéance posée est à trois
  // jours, donc ni en retard ni dans la journée.
  await expect(
    page.getByRole('heading', { name: 'Aucun rappel en retard', level: 2 }),
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Aujourd’hui' }).click();
  await expect(
    page.getByRole('heading', { name: 'Aucun rappel aujourd’hui', level: 2 }),
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Cette semaine' }).click();
  const ligne = page.getByRole('row').filter({ hasText: CIBLE_GP.affiche });
  await expect(ligne).toHaveCount(1);

  // L'état vide de la semaine se mérite : on retire sa propre échéance par le
  // geste de l'écran, jamais par un appel qui court-circuiterait le bouton.
  await ligne.getByRole('button', { name: 'Annuler' }).click();
  // Le toast de Sonner est un `<li>` sans rôle : `getByRole('status')` attrape
  // le compteur de retards de l'écran, pas la confirmation.
  await expect(page.getByText('Rappel annulé.', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Aucun rappel cette semaine', level: 2 }),
  ).toBeVisible();
});

test('GP-33 · le filtre par téléconseiller n’existe que pour l’encadrement', async ({
  page,
  browser,
}) => {
  await page.goto('/grand-public/rappels');
  await expect(page.getByRole('tab', { name: 'En retard' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: /^Téléconseiller/u })).toHaveCount(0);

  const encadrement = await browser.newContext({
    storageState: SUPERVISEUR_STATE,
    baseURL: WEB_URL,
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
  });
  try {
    const vue = await encadrement.newPage();
    await vue.goto('/grand-public/rappels');
    await expect(vue.getByRole('combobox', { name: /^Téléconseiller/u })).toBeVisible();
  } finally {
    await encadrement.close();
  }
});
