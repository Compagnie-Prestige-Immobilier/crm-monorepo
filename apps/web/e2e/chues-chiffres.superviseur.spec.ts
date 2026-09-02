import { expect, test, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * Les chiffres du projet CHUES, vus par un SUPERVISEUR.
 *
 * `GET /api/v1/supervision/activite` répond aujourd'hui 500 : une virgule de
 * trop ferme le `SELECT` de `supervision.service.ts` juste avant son `FROM`.
 * Tout ce qui vit de ce jeu — les huit cartes, le sélecteur de téléconseiller,
 * le tableau d'équipe — est donc ATTENDU ROUGE, et ces rouges sont l'objet même
 * de ce fichier. On ne contourne rien.
 */

test.use({ storageState: 'e2e/.auth/superviseur.json' });

/**
 * Le titre d'une carte n'est pas un `heading` : `ChartCard` le rend dans un
 * `div` (`CardTitle`), et `TuileWidget` le répète en `sr-only`. Un
 * `getByText(titre)` trouve donc deux fois le même texte. Le seul repère unique
 * et accessible est la région du graphique, nommée « <titre> graphique ».
 */
function carte(page: Page, titre: string) {
  return page.getByRole('group', { name: `${titre} graphique` });
}

const CARTES_USINE = [
  'Taux de contact',
  'Taux de rendez-vous',
  'Taux de qualification',
  'Adhésions',
  'Par téléconseiller',
] as const;

const PASTILLES = [
  { label: 'Ce mois-ci', cle: 'ce-mois' },
  { label: 'Mois dernier', cle: 'mois-dernier' },
  { label: '3 derniers mois', cle: 'trois-mois' },
  { label: '12 derniers mois', cle: 'douze-mois' },
  { label: 'Cette année', cle: 'cette-annee' },
  { label: 'Année dernière', cle: 'annee-derniere' },
] as const;

/**
 * Ouvre l'écran et attend la RÉPONSE de disposition, pas un délai.
 *
 * C'est elle qui dit quelles cartes poser : avant elle, aucune requête de
 * chiffres n'est partie et la page est un squelette. L'attendre garantit aussi
 * que le composant est hydraté, donc qu'un clic sur une pastille compte.
 */
async function ouvrirLesChiffres(page: Page, url = '/chues/statistiques'): Promise<void> {
  const disposition = page.waitForResponse(
    (reponse) =>
      reponse.url().includes('/api/v1/tableaux-de-bord/chues/disposition') &&
      reponse.request().method() === 'GET',
  );
  // L'activité arrive APRÈS la disposition, qui seule dit quelles cartes — donc
  // quels jeux — charger. Le sélecteur de téléconseiller et le tableau d'équipe
  // n'existent qu'une fois cette réponse rendue.
  const activite = page.waitForResponse((reponse) =>
    reponse.url().includes('/api/v1/supervision/activite'),
  );
  await page.goto(url);
  await disposition;
  await activite;
}

function ligneDePeriode(page: Page) {
  return page.getByRole('main').locator('p[aria-live="polite"]');
}

test('CHU-CHF-01 · l’écran d’usine pose ses cinq cartes pour un superviseur', async ({ page }) => {
  await ouvrirLesChiffres(page);

  for (const titre of CARTES_USINE) {
    await expect(carte(page, titre), `la carte « ${titre} » doit être posée`).toBeVisible();
  }

  // Les montants restent fermés à la supervision.
  await expect(carte(page, 'Encaissé')).toHaveCount(0);
  await expect(carte(page, 'De l’appel à l’encaissement')).toHaveCount(0);

  for (const titre of [
    'Chargement impossible',
    'Serveur injoignable',
    'Erreur serveur',
    'Accès refusé',
  ]) {
    await expect(page.getByRole('heading', { name: titre, level: 2 })).toHaveCount(0);
  }
});

test('CHU-CHF-05 · les six pastilles de période changent l’écran et l’URL', async ({ page }) => {
  await ouvrirLesChiffres(page);

  for (const { label, cle } of PASTILLES) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page).toHaveURL(`/chues/statistiques?periode=${cle}`);

    for (const autre of PASTILLES) {
      await expect(
        page.getByRole('button', { name: autre.label, exact: true }),
        `« ${autre.label} » après un clic sur « ${label} »`,
      ).toHaveAttribute('aria-pressed', autre.cle === cle ? 'true' : 'false');
    }

    await expect(ligneDePeriode(page)).toHaveText(label);
  }
});

test('CHU-CHF-06 · la plage libre écrit ses deux bornes dans l’URL et les réaffiche', async ({
  page,
}) => {
  await ouvrirLesChiffres(page);

  await page.getByRole('button', { name: 'Plage libre' }).click();

  await page.getByRole('button', { name: 'Du', exact: true }).click();
  await page.getByRole('combobox', { name: 'Mois affiché' }).click();
  await page.getByRole('option', { name: 'février' }).click();
  await page
    .getByRole('grid', { name: 'Du' })
    .getByRole('gridcell', { name: '01 février 2026' })
    .click();
  // Les deux calendriers portent un sélecteur « Mois affiché » : ouvrir le
  // second avant que le premier ne soit démonté viole le mode strict.
  await expect(page.getByRole('grid', { name: 'Du' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Au', exact: true }).click();
  await page.getByRole('combobox', { name: 'Mois affiché' }).click();
  await page.getByRole('option', { name: 'février' }).click();
  await page
    .getByRole('grid', { name: 'Au' })
    .getByRole('gridcell', { name: '28 février 2026' })
    .click();
  await expect(page.getByRole('grid', { name: 'Au' })).toHaveCount(0);

  await expect(page).toHaveURL('/chues/statistiques?periode=libre&du=2026-02-01&au=2026-02-28');
  await expect(ligneDePeriode(page)).toHaveText('01 févr. 2026 – 28 févr. 2026');

  /**
   * Les bornes se contraignent mutuellement. `DatePicker` n'est PAS un
   * `<input type="date">` : il n'y a ni `min` ni `max` à lire sur un champ, la
   * contrainte se voit sur les jours hors bornes, qui sont désactivés.
   */
  await page.getByRole('button', { name: 'Du', exact: true }).click();
  await expect(
    page.getByRole('grid', { name: 'Du' }).getByRole('gridcell', { name: '01 mars 2026' }),
  ).toBeDisabled();
  // Le déclencheur referme son propre calendrier ; « Échap » refermerait aussi
  // la plage libre qui le porte.
  await page.getByRole('button', { name: 'Du', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Du' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Au', exact: true }).click();
  await expect(
    page.getByRole('grid', { name: 'Au' }).getByRole('gridcell', { name: '31 janvier 2026' }),
  ).toBeDisabled();
});

test('CHU-CHF-07 · une plage de plus de 400 jours est refusée par un message', async ({ page }) => {
  await page.goto('/chues/statistiques?periode=libre&du=2024-01-01&au=2026-08-27');

  const refus = page.getByRole('alert').filter({ hasText: 'Cette plage dépasse' });
  await expect(refus).toHaveText(
    'Cette plage dépasse 400 jours (970 jours) : revenez à une période plus courte.',
  );
});

test('CHU-CHF-08 · « Comparer à » n’existe pas ici : rien sur cet écran ne compare deux périodes', async ({
  page,
}) => {
  await ouvrirLesChiffres(page);

  await expect(page.getByRole('group', { name: 'Période affichée' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Comparer à' })).toHaveCount(0);
});

test('CHU-CHF-09 · la liste des téléconseillers inclut l’encadrement et exclut la banque', async ({
  page,
}) => {
  await ouvrirLesChiffres(page);

  await page.getByRole('combobox', { name: 'Téléconseiller regardé' }).click();

  for (const nom of [
    'Toute l’équipe',
    'Awa Fixture',
    'Fatou Fixture',
    'Superviseur Fixture',
    'Direction Fixture',
  ]) {
    await expect(page.getByRole('option', { name: nom, exact: true })).toBeVisible();
  }

  await expect(page.getByRole('option', { name: 'Moussa Fixture', exact: true })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Administrateur CPI', exact: true })).toHaveCount(
    0,
  );
});

test('CHU-CHF-10 · le sélecteur affiche le nom, jamais l’identifiant', async ({ page }) => {
  const api = await adminApi();
  let directionId: string;
  try {
    const reponse = await api.get('/api/v1/users', {
      params: { search: 'fixture.direction@cpi.sn', pageSize: '50' },
    });
    expect(reponse.ok(), `GET /api/v1/users a répondu ${String(reponse.status())}`).toBe(true);
    const corps = (await reponse.json()) as { items: { id: string; email: string }[] };
    const trouve = corps.items.find((user) => user.email === 'fixture.direction@cpi.sn');
    expect(trouve, 'le compte fixture.direction@cpi.sn doit exister').toBeDefined();
    directionId = trouve?.id ?? '';
  } finally {
    await api.dispose();
  }

  await ouvrirLesChiffres(page, `/chues/statistiques?teleconseiller=${directionId}`);

  const selecteur = page.getByRole('combobox', { name: 'Téléconseiller regardé' });
  await expect(selecteur).toContainText('Direction Fixture');
  await expect(selecteur).not.toContainText(directionId.slice(0, 8));
});

test('CHU-CHF-11 · sans choix, le sélecteur annonce « Toute l’équipe » et l’URL reste propre', async ({
  page,
}) => {
  await ouvrirLesChiffres(page);

  const selecteur = page.getByRole('combobox', { name: 'Téléconseiller regardé' });
  await expect(selecteur).toContainText('Toute l’équipe');
  await expect(page).not.toHaveURL(/teleconseiller=/);

  await selecteur.click();
  await page.getByRole('option', { name: 'Awa Fixture', exact: true }).click();
  await expect(page).toHaveURL(/[?&]teleconseiller=[0-9a-f-]{36}$/);

  await selecteur.click();
  await page.getByRole('option', { name: 'Toute l’équipe', exact: true }).click();
  await expect(page).not.toHaveURL(/teleconseiller=/);
});

test('CHU-CHF-12 · le tableau « Par téléconseiller » nomme tout le plateau', async ({ page }) => {
  await ouvrirLesChiffres(page, '/chues/statistiques?periode=ce-mois');

  const tableau = carte(page, 'Par téléconseiller').getByRole('table');
  await expect(tableau).toBeVisible();

  for (const entete of [
    'Téléconseiller',
    'Appels',
    'Contact',
    'Rendez-vous',
    'Qualification',
    'Prospects notés',
    'Adhésions',
  ]) {
    await expect(tableau.getByRole('columnheader', { name: entete, exact: true })).toBeVisible();
  }
  await expect(tableau.getByRole('rowheader', { name: 'Équipe', exact: true })).toBeVisible();

  for (const nom of ['Awa Fixture', 'Fatou Fixture', 'Superviseur Fixture', 'Direction Fixture']) {
    await expect(tableau.getByRole('rowheader', { name: nom, exact: true })).toBeVisible();
  }
  await expect(tableau.getByRole('rowheader', { name: 'Moussa Fixture', exact: true })).toHaveCount(
    0,
  );
});

test('CHU-CHF-20 · l’écran en erreur propose de réessayer, il ne reste pas blanc', async ({
  page,
}) => {
  await page.route('**/api/v1/supervision/activite**', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'panne simulée' }),
    });
  });

  await page.goto('/chues/statistiques');

  const erreur = page.getByRole('alert').filter({ hasText: 'Réessayer' });
  await expect(page.getByRole('heading', { name: 'Erreur serveur', level: 2 })).toBeVisible();
  await expect(erreur).toContainText('Erreur serveur (500). Réessayez.');

  await page.unroute('**/api/v1/supervision/activite**');
  await erreur.getByRole('button', { name: 'Réessayer' }).click();

  for (const titre of CARTES_USINE) {
    await expect(carte(page, titre), `« ${titre} » après « Réessayer »`).toBeVisible();
  }
});

test('CHU-CHF-21 · l’écran tient sur 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await ouvrirLesChiffres(page);

  for (const titre of CARTES_USINE) {
    await expect(carte(page, titre)).toBeVisible();
  }

  const largeurDocument = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(
    largeurDocument,
    'la page entière ne doit pas défiler horizontalement',
  ).toBeLessThanOrEqual(375);
});

test('CHU-TDB-01 · les anciennes adresses hors coque arrivent aussi', async ({ page }) => {
  await page.goto('/tableau-de-bord');
  await expect(page).toHaveURL('/chues/statistiques');
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toHaveCount(0);

  await page.goto('/statistiques');
  await expect(page).toHaveURL('/chues/statistiques');
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toHaveCount(0);
});

test('CHU-TRV-03 · hors ligne, l’écran le dit au lieu de rester figé', async ({
  page,
  context,
}) => {
  await ouvrirLesChiffres(page);

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Mois dernier', exact: true }).click();

  // L'écran doit rester l'écran : un changement de période hors ligne ne doit
  // pas rendre la main au navigateur.
  await expect(page).toHaveURL('/chues/statistiques?periode=mois-dernier');
  await expect(page.getByRole('heading', { name: 'Serveur injoignable', level: 2 })).toBeVisible();

  const erreur = page.getByRole('alert').filter({ hasText: 'Réessayer' });
  await context.setOffline(false);
  await erreur.getByRole('button', { name: 'Réessayer' }).click();

  for (const titre of CARTES_USINE) {
    await expect(carte(page, titre), `« ${titre} » après retour du réseau`).toBeVisible();
  }
});

test('CHU-TRV-04 · une API en 429 ne se lit pas comme une erreur de données', async ({ page }) => {
  let requetes = 0;
  await page.route('**/api/v1/supervision/activite**', async (route) => {
    requetes += 1;
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Trop de requêtes' }),
    });
  });

  await page.goto('/chues/statistiques');

  const erreur = page.getByRole('alert').filter({ hasText: 'Réessayer' });
  await expect(
    page.getByRole('heading', { name: 'Chargement impossible', level: 2 }),
  ).toBeVisible();
  await expect(erreur).toContainText('Trop de requêtes. Patientez quelques secondes.');
  await expect(erreur.getByRole('button', { name: 'Réessayer' })).toBeVisible();

  // L'indicateur passe en « Interrompu » : le rafraîchissement automatique
  // ralentit au lieu de marteler une API déjà limitée.
  await expect(page.getByRole('status').filter({ hasText: 'Interrompu' })).toBeVisible();
  // Un appel, plus l'unique réessai de TanStack Query (`retry: 1`).
  expect(requetes, 'aucune boucle de rejeu sur une API limitée').toBe(2);
});

test('CHU-TRV-06 · la navigation de l’encadrement ouvre sur les chiffres', async ({ page }) => {
  await page.goto('/espaces');
  await page
    .getByRole('link', { name: 'Projet CHUES Enrôlement des enseignants syndiqués' })
    .click();

  await expect(page).toHaveURL('/chues/statistiques');

  const navigation = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(navigation.getByRole('link', { name: 'Tableau de bord' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Mon équipe' })).toBeVisible();
  /**
   * « Lots d’export » est rangé sous le repli « Plus », un `<details>` fermé :
   * son contenu sort de l'arbre d'accessibilité, donc `getByRole` ne le voit
   * pas. On le vise par son `href`, ce qui prouve sa présence sans ouvrir le
   * repli — dont l'état est un cookie partagé par toutes les specs.
   */
  const lotsExport = navigation.locator('a[href="/chues/campagnes"]');
  await expect(lotsExport).toHaveCount(1);
  await expect(lotsExport).toHaveText('Lots d’export');
});
