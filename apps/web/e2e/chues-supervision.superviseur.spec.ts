import { readFile } from 'node:fs/promises';

import { expect, test, type Request } from '@playwright/test';

/**
 * `/chues/supervision` vue par l'encadrement : volet Activité, volet Comptes.
 *
 * `GET /api/v1/supervision/activite` répond 500 sur cette pile (virgule SQL de
 * `apps/api/src/modules/analytics/supervision.service.ts`). Les scénarios qui
 * ont besoin du tableau d'activité sont donc ATTENDUS ROUGES : c'est le défaut
 * qu'ils existent pour nommer, et aucune assertion n'est assouplie pour le
 * masquer.
 */

test.use({ storageState: 'e2e/.auth/superviseur.json' });

const ACTIVITE = '/api/v1/supervision/activite';

const COLONNES = [
  'Appels',
  'Méthodes',
  'NRP / injoignables',
  'Faux numéros',
  'Refus',
  'À rappeler',
  'Joignabilité',
  'Prospects saisis',
  'Représentants contactés',
] as const;

const CSV_ENTETES =
  'Téléconseiller;Appels;Méthodes obtenues;NRP / injoignables;Faux numéros;Refus;' +
  'À rappeler;Taux de joignabilité (%);Prospects saisis;Représentants contactés';

/** Un corps d'activité VALIDE et vide : le plateau sans aucun compte. */
const ACTIVITE_VIDE = {
  from: null,
  to: null,
  granularity: 'day',
  items: [],
  teleconseillers: [],
  prospectsByTeleconseiller: [],
  prospectsByRepresentant: [],
  totals: {
    calls: 0,
    unreachable: 0,
    wrongNumber: 0,
    refused: 0,
    other: 0,
    methodObtained: 0,
    callback: 0,
    reachRate: null,
    prospectsCreated: 0,
    representantsContacted: 0,
    repCalls: 0,
    repReached: 0,
    repCallback: 0,
    repUnreachable: 0,
    repOther: 0,
    repContactRate: null,
    repCallbackRate: null,
    repQuestioned: 0,
    repQualified: 0,
    repQualificationRate: null,
  },
};

const bornes = (request: Request): { from: string; to: string } => {
  const url = new URL(request.url());
  return { from: url.searchParams.get('actFrom') ?? '', to: url.searchParams.get('actTo') ?? '' };
};

const jour = (decalage: number): string => {
  const at = new Date();
  at.setUTCDate(at.getUTCDate() + decalage);
  return at.toISOString().slice(0, 10);
};

test('CHU-SUP-01 les deux volets existent et l’onglet vit dans l’URL', async ({ page }) => {
  await page.goto('/chues/supervision');
  await expect(page).toHaveTitle('Supervision · CPI GO');

  const activite = page.getByRole('tab', { name: 'Activité' });
  const comptes = page.getByRole('tab', { name: 'Comptes' });
  await expect(activite).toHaveAttribute('aria-selected', 'true');
  await expect(comptes).toHaveAttribute('aria-selected', 'false');
  await expect(page).toHaveURL(/\/chues\/supervision$/);

  await comptes.click();
  await expect(page).toHaveURL(/\/chues\/supervision\?volet=comptes$/);
  await expect(comptes).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Comptes' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Activité' })).toHaveAttribute(
    'aria-selected',
    'false',
  );
});

test('CHU-SUP-02 le tableau d’activité porte ses neuf colonnes', async ({ page }) => {
  await page.goto('/chues/supervision');

  const tableau = page.getByRole('table').first();
  await expect(tableau.getByRole('columnheader', { name: 'Téléconseiller' })).toHaveCount(1);
  for (const colonne of COLONNES) {
    await expect(
      tableau.getByRole('columnheader', { name: colonne, exact: true }),
      `la colonne « ${colonne} » manque au tableau d’activité`,
    ).toHaveCount(1);
  }

  // Les tâches d'appel n'existent plus : leurs colonnes ne doivent pas revenir.
  await expect(tableau.getByRole('columnheader', { name: 'Tâches closes' })).toHaveCount(0);
  await expect(tableau.getByRole('columnheader', { name: 'Reste à faire' })).toHaveCount(0);
});

test('CHU-SUP-03 les trois périodes changent la requête', async ({ page }) => {
  /**
   * Les bornes sont RELEVÉES, pas attendues une par une : la clé de cache porte
   * la plage et `staleTime` vaut 30 s, donc revenir sur une période déjà servie
   * ne repart PAS en réseau. Exiger une requête à chaque clic ferait échouer le
   * retour sur « Aujourd’hui » pour une raison qui n'est pas le défaut cherché.
   */
  const vues = new Map<string, string>();
  page.on('request', (request) => {
    if (!request.url().includes(ACTIVITE)) return;
    const { from, to } = bornes(request);
    vues.set(from, to);
  });

  await page.goto('/chues/supervision');

  const aujourdhui = page.getByRole('button', { name: 'Aujourd’hui' });
  const semaine = page.getByRole('button', { name: 'Cette semaine' });
  const derniers = page.getByRole('button', { name: '7 derniers jours' });

  const debutAujourdhui = `${jour(0)}T00:00:00.000Z`;
  await expect(aujourdhui).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => vues.get(debutAujourdhui), {
      message: 'la période par défaut n’a pas borné sa requête sur la journée',
    })
    .toBe(`${jour(0)}T23:59:59.999Z`);

  await derniers.click();
  await expect(derniers).toHaveAttribute('aria-pressed', 'true');
  await expect(aujourdhui).toHaveAttribute('aria-pressed', 'false');
  await expect
    .poll(() => vues.get(`${jour(-6)}T00:00:00.000Z`), {
      message: 'la clé de cache ignore la plage : « 7 derniers jours » n’a rien redemandé',
    })
    .toBe(`${jour(0)}T23:59:59.999Z`);

  await semaine.click();
  await expect(semaine).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(
      () =>
        [...vues.keys()].some(
          (from) => new Date(from).getUTCDay() === 1 && from <= debutAujourdhui,
        ),
      { message: '« Cette semaine » n’a pas demandé de plage partant d’un lundi' },
    )
    .toBe(true);

  await aujourdhui.click();
  await expect(aujourdhui).toHaveAttribute('aria-pressed', 'true');
  await expect(semaine).toHaveAttribute('aria-pressed', 'false');
});

test('CHU-SUP-04 le tri par colonne bascule et se voit', async ({ page }) => {
  await page.goto('/chues/supervision');

  const tableau = page.getByRole('table').first();
  const entete = tableau.getByRole('columnheader', { name: 'Appels' });
  const appels = tableau.getByRole('button', { name: 'Appels' });
  const lignes = tableau.locator('tbody').getByRole('row');
  await expect(lignes.first()).toBeVisible();

  /**
   * Les ex æquo sont départagés par le NOM, toujours croissant : le second sens
   * de tri n'est donc pas l'exact miroir du premier. Ce qui se vérifie est la
   * monotonie de la colonne, pas une inversion caractère à caractère.
   */
  const lire = async (): Promise<{ noms: string[]; appels: number[] }> => {
    const total = await lignes.count();
    const noms: string[] = [];
    const valeurs: number[] = [];
    for (let index = 0; index < total; index += 1) {
      const ligne = lignes.nth(index);
      noms.push((await ligne.getByRole('rowheader').innerText()).trim());
      valeurs.push(Number((await ligne.getByRole('cell').first().innerText()).replace(/\s/gu, '')));
    }
    return { noms, appels: valeurs };
  };

  // « Appels » est la colonne de tri d'usine, en décroissant.
  await expect(entete).toHaveAttribute('aria-sort', 'descending');
  const initial = await lire();
  expect(initial.noms.length, 'le tri ne prouve rien sur moins de deux lignes').toBeGreaterThan(1);
  expect(initial.appels).toEqual([...initial.appels].sort((a, b) => b - a));

  await appels.click();
  await expect(entete).toHaveAttribute('aria-sort', 'ascending');
  const croissant = await lire();
  expect(croissant.appels).toEqual([...croissant.appels].sort((a, b) => a - b));
  expect(croissant.noms, 'le tri est décoratif : l’ordre des lignes n’a pas bougé').not.toEqual(
    initial.noms,
  );

  await appels.click();
  await expect(entete).toHaveAttribute('aria-sort', 'descending');
  const decroissant = await lire();
  expect(decroissant.appels).toEqual([...decroissant.appels].sort((a, b) => b - a));
  expect(decroissant.noms).toEqual(initial.noms);
});

test('CHU-SUP-05 l’export CSV produit un vrai fichier', async ({ page }) => {
  await page.goto('/chues/supervision');

  const exporter = page.getByRole('button', { name: 'Exporter en CSV' });
  await expect(exporter, 'le bouton d’export reste inerte faute de données').toBeEnabled();

  const [telechargement] = await Promise.all([page.waitForEvent('download'), exporter.click()]);
  expect(telechargement.suggestedFilename()).toMatch(
    /^cpi-supervision-activite-\d{4}-\d{2}-\d{2}(_\d{4}-\d{2}-\d{2})?\.csv$/,
  );

  const contenu = await readFile(await telechargement.path(), 'utf8');
  expect(contenu.length).toBeGreaterThan(100);
  expect(contenu.split('\r\n')).toContain(CSV_ENTETES);
});

test('CHU-SUP-06 sans aucun compte de plateau, l’écran le dit', async ({ page }) => {
  await page.route(`**${ACTIVITE}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ACTIVITE_VIDE),
    });
  });

  await page.goto('/chues/supervision');
  await expect(
    page.getByText('Aucun compte téléconseiller. Créez-en un depuis les comptes.', {
      exact: true,
    }),
  ).toBeVisible();
});

test('CHU-SUP-07 le volet Comptes montre la présence', async ({ page }) => {
  await page.goto('/chues/supervision?volet=comptes');

  await expect(page.getByText('Présence et dernière activité des comptes.')).toBeVisible();

  const teleconseillers = page.getByRole('table').filter({ hasText: 'Téléconseillers' });
  const finances = page.getByRole('table').filter({ hasText: 'Banque & Finance' });
  await expect(teleconseillers).toHaveCount(1);
  await expect(finances).toHaveCount(1);

  // Les deux pôles portent des comptes de fixture : l'état vide ne s'affiche
  // donc pas, et sa présence signalerait un volet monté sans données.
  await expect(teleconseillers.getByRole('rowheader')).not.toHaveCount(0);
  await expect(finances.getByRole('rowheader')).not.toHaveCount(0);
  await expect(page.getByText('Aucun compte téléconseiller.', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText('Aucun compte au pôle Banque & Finance.', { exact: true }),
  ).toHaveCount(0);
});
