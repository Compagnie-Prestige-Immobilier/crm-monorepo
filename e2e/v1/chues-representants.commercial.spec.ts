import { expect, test, type APIResponse, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * `/chues/representants` et `/chues/representants/[id]`, vus par un
 * TÉLÉCONSEILLER (`fixture.awa@cpi.sn`). CHU-REP-01, 02, 04 ; CHU-REPD-01 à 05.
 *
 * Données : préfixe `E2E-CHUES-REP `, plage `+221 78 100 43 0x` (§5.2). Les
 * fiches sont supprimables : le ménage se fait EN DÉBUT de parcours, sur un
 * suffixe stable, et non dans un `afterAll` qui ne tourne pas après un échec
 * dur (§5.1).
 *
 * CHU-REP-03 est déjà couvert par `console.spec.ts` : il n'est pas réécrit.
 * CHU-REP-05 n'est pas écrit, la volumétrie manque : voir le retour.
 */
test.use({ storageState: 'v1/.auth/commercial.json' });

const PREFIXE = 'E2E-CHUES-REP ';

const MARIAMA = { fullName: `${PREFIXE}Mariama Sy`, phone: '+221781004301' } as const;
const SANS_PROSPECT = { fullName: `${PREFIXE}Sans Prospect`, phone: '+221781004302' } as const;

/**
 * Le décompte de la liste, distingué de la région `aria-live` de Sonner (§6.3).
 * `\s` plutôt qu'une espace : le libellé source porte une espace insécable et
 * les milliers un séparateur étroit.
 */
const DECOMPTE = new RegExp(
  '^Représentants affichés\\s*:\\s*(Aucun résultat|[\\d\\s]+–[\\d\\s]+ sur [\\d\\s]+(, dont [\\d\\s]+ qui ont accepté)?)$',
  'u',
);

const UUID =
  /\/chues\/representants\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** Le champ, jamais son bouton d'effacement, qui porte « Effacer la recherche ». */
const recherche = (page: Page) => page.getByRole('textbox', { name: 'Recherche', exact: true });

const decompte = (page: Page) =>
  page.getByRole('status').filter({ hasText: 'Représentants affichés' });

/**
 * Ouvre une fiche depuis la liste, sans passer par la recherche.
 *
 * La saisie est débattue puis poussée dans l'URL : un clic tiré aussitôt après
 * le `fill` est annulé par le rendu que cette poussée déclenche, et il se perd
 * sans erreur. La liste étant triée par saisie décroissante, les fiches créées
 * par la préparation sont en tête et le lien est atteignable tel quel.
 */
async function ouvrir(page: Page, fullName: string): Promise<void> {
  const lien = page.getByRole('link', { name: fullName, exact: true });
  await expect(lien).toHaveCount(1);
  await lien.click();
  // La navigation est CÔTÉ CLIENT : aucun événement `load` ne repart, et
  // `waitForURL` resterait suspendu à l'attendre. On observe l'URL.
  await expect(page).toHaveURL(UUID);
}

async function json<T>(response: APIResponse): Promise<T> {
  expect(
    response.ok(),
    `${response.url()} a répondu ${String(response.status())} : ${await response.text()}`,
  ).toBe(true);
  return (await response.json()) as T;
}

interface FicheEnBase {
  readonly id: string;
  readonly fullName: string;
  readonly phoneE164: string;
  readonly relationStatus: string;
  readonly prospectCount: number;
}

/** La fiche est-elle déjà EXACTEMENT dans l'état que les scénarios attendent ? */
function conforme(row: FicheEnBase, attendu: { fullName: string; phone: string }): boolean {
  return (
    row.fullName === attendu.fullName &&
    row.phoneE164 === attendu.phone &&
    row.relationStatus === 'INCONNU' &&
    row.prospectCount === 0
  );
}

/**
 * Ménage puis pose des deux fiches, en le moins d'appels possible.
 *
 * La liste est relue UNE fois : la pile locale est partagée par plusieurs
 * suites à la fois et chaque aller-retour se paie. Une fiche déjà conforme est
 * gardée telle quelle ; toute autre est retirée puis refaite, pour que l'état
 * de départ ne dépende pas de l'exécution précédente.
 */
test.beforeAll(async () => {
  const api = await adminApi();
  try {
    const liste = await json<{ items: FicheEnBase[] }>(
      await api.get('/api/v1/representants', { params: { pageSize: '100' } }),
    );

    const aPoser = [MARIAMA, SANS_PROSPECT].filter(
      (fiche) => !liste.items.some((row) => conforme(row, fiche)),
    );
    if (aPoser.length === 0) return;

    const departements = await json<{ id: string; name: string }[]>(
      await api.get('/api/v1/referentiels/departements', { params: { activeOnly: 'false' } }),
    );
    const departement = departements.find((row) => row.name === 'Dakar') ?? departements[0];
    expect(departement, 'Aucun département dans le référentiel').toBeDefined();
    if (departement === undefined) return;

    for (const fiche of aPoser) {
      for (const row of liste.items.filter((item) => item.phoneE164 === fiche.phone)) {
        const deleted = await api.delete(`/api/v1/representants/${row.id}`, {
          params: { cascade: 'true' },
        });
        expect(
          deleted.ok(),
          `Le ménage de ${fiche.phone} a répondu ${String(deleted.status())} : ${await deleted.text()}`,
        ).toBe(true);
      }
      const created = await api.post('/api/v1/representants', {
        data: { fullName: fiche.fullName, phone: fiche.phone, departementId: departement.id },
      });
      expect(
        created.ok(),
        `La création de ${fiche.fullName} a répondu ${String(created.status())} : ${await created.text()}`,
      ).toBe(true);
    }
  } finally {
    await api.dispose();
  }
});

test('CHU-REP-01 la liste se rend avec sa recherche et son décompte', async ({ page }) => {
  await page.goto('/chues/representants');

  await expect(page).toHaveTitle(/Représentants/u);
  await expect(page.getByRole('heading', { level: 1, name: 'Représentants' })).toBeVisible();
  await expect(recherche(page)).toBeVisible();

  // Sans ce décompte, une page qui n'a pas chargé et un filtre trop étroit se
  // ressemblent.
  await expect(decompte(page)).toHaveText(DECOMPTE);
});

test('CHU-REP-02 la recherche filtre par nom et par numéro', async ({ page }) => {
  await page.goto('/chues/representants');
  const tableau = page.getByRole('table');
  const mariama = tableau.getByRole('row').filter({ hasText: MARIAMA.fullName });
  // Le témoin est une fiche À MOI, donc certaine d'exister, et qui ne répond à
  // aucun des deux termes cherchés : sa présence prouverait que le filtre n'a
  // rien resserré.
  const temoin = tableau.getByRole('row').filter({ hasText: SANS_PROSPECT.fullName });

  await recherche(page).fill(`${PREFIXE}Mariama`);
  await expect(mariama, 'la recherche par nom doit rendre la fiche Mariama').toHaveCount(1);
  await expect(
    temoin,
    `« ${SANS_PROSPECT.fullName} » ne correspond pas au terme cherché`,
  ).toHaveCount(0);

  await recherche(page).fill('781004301');
  await expect(
    mariama,
    'la recherche par chiffres doit atteindre le téléphone normalisé',
  ).toHaveCount(1);
  await expect(temoin, `« ${SANS_PROSPECT.fullName} » ne porte pas ce numéro`).toHaveCount(0);
});

test('CHU-REP-04 un filtre sans résultat le dit avec les bons mots', async ({ page }) => {
  await page.goto('/chues/representants');
  await recherche(page).fill('E2E-CHUES-REP-INTROUVABLE');

  await expect(page.getByText('Aucun représentant ne correspond à ces critères.')).toBeVisible();
  // « Aucun représentant enregistré. » est réservé à la base vide : confondre
  // les deux ferait croire à une base perdue.
  await expect(page.getByText('Aucun représentant enregistré.')).toHaveCount(0);
});

test('CHU-REPD-01 la fiche s’ouvre depuis la liste et porte son histoire', async ({ page }) => {
  await page.goto('/chues/representants');
  await ouvrir(page, MARIAMA.fullName);

  await expect(page).toHaveURL(UUID);
  await expect(page.getByText('Histoire de la relation', { exact: true })).toBeVisible();
});

test('CHU-REPD-02 une fiche sans prospect le dit', async ({ page }) => {
  await page.goto('/chues/representants');
  await ouvrir(page, SANS_PROSPECT.fullName);

  await expect(page.getByText('Aucune fiche remise pour l’instant.')).toBeVisible();
});

test('CHU-REPD-03 une relation jamais tranchée le dit aussi', async ({ page }) => {
  await page.goto('/chues/representants');
  await ouvrir(page, MARIAMA.fullName);

  // La fiche vient d'être créée : sa relation vaut INCONNU, « Pas encore
  // contacté », et l'onglet des statuts de l'histoire ne montre aucune bascule.
  await expect(page.getByText('Non qualifié', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /^Statuts/ }).click();
  await expect(page.getByText('Aucune bascule enregistrée.')).toBeVisible();
});

test('CHU-REPD-04 un identifiant inconnu rend un refus lisible, pas une page blanche', async ({
  page,
}) => {
  const explosions: string[] = [];
  page.on('pageerror', (error) => {
    explosions.push(error.message);
  });

  await page.goto('/chues/representants/00000000-0000-7000-8000-000000000000');

  await expect(
    page.getByRole('heading', { name: 'Introuvable', level: 2 }),
    'la fiche inconnue doit rendre un état d’erreur nommé',
  ).toBeVisible();
  expect(explosions, 'aucune exception non rattrapée ne doit remonter').toEqual([]);
});

test('CHU-REPD-05 la fiche tient sur 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/chues/representants');
  // Sous 1024 px la liste est rendue en CARTES, le tableau est retiré de
  // l'arbre d'accessibilité (§1.13) : `getByRole` ne voit que la carte.
  await ouvrir(page, MARIAMA.fullName);

  await expect(page.getByText(MARIAMA.fullName, { exact: true })).toBeVisible();
  await expect(page.getByText('+221 78 100 43 01', { exact: true })).toBeVisible();
  await expect(page.getByText('Histoire de la relation', { exact: true })).toBeVisible();

  const deborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(deborde, 'la page ne doit pas défiler latéralement sur 375 px').toBe(false);
});
