import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * GP-34 à GP-45 : `/grand-public/statistiques`, `ChiffresView ecran="grand-public"`.
 *
 * Libellés de CET écran (§1.9) : « Composer l’écran » et « Revenir à l’écran
 * par défaut ». « Organiser les graphiques » appartient au tableau de bord des
 * visites, et sa présence ici serait le défaut.
 *
 * « Proposer par défaut » n'est JAMAIS confirmé (§4.3.4) : GP-38 prouve la
 * présence du bouton, jamais son effet, qui fixerait la disposition de tous les
 * comptes qui n'en ont pas enregistré.
 *
 * La donnée partagée de ce fichier est la disposition du compte SUPERVISEUR.
 * Elle est remise à celle du serveur AVANT chaque parcours et dans le
 * `afterAll` : chaque scénario part donc de la disposition d'usine et rend un
 * verdict propre. Le `mode: 'serial'` de la carte du §5.7 aurait fait sauter
 * onze verdicts derrière le premier rouge, connu et documenté (§1.1).
 */

test.use({ storageState: 'e2e/.auth/superviseur.json' });

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const SUPERVISEUR_STATE = 'e2e/.auth/superviseur.json';
const ADMIN_STATE = 'e2e/.auth/admin.json';
const DIRECTION_STATE = 'e2e/.auth/direction.json';

const ECRAN = '/grand-public/statistiques';
const DISPOSITION = '/api/v1/tableaux-de-bord/grand-public/disposition';

/**
 * La disposition d'usine de cet écran, côté serveur
 * (`dashboards/dashboard-layout.ts`, `USINE['grand-public']`). Un SUPERVISEUR
 * ne voit pas les montants : les deux cartes de recette n'y sont pas.
 */
const CARTES_USINE = [
  'Taux de joignabilité',
  'Prospects notés',
  'Adhésions',
  'Par téléconseiller',
] as const;

/** Ce que le tiroir propose en plus, pour un SUPERVISEUR. */
const CARTE_AJOUTEE = 'Méthodes d’adhésion';
const SOURCE_AJOUTEE = 'methodes-d-adhesion';

/** Réservé à l'ADMIN et à la DIRECTION (`chiffres/sources.ts`, `SOURCES_MONTANTS`). */
const CARTES_DE_MONTANT = ['Encaissé', 'De l’appel à l’encaissement'] as const;

const VIDE = 'Cet écran est vide. Ouvrez « Composer l’écran » pour y poser vos chiffres.';

async function superviseurApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: WEB_URL, storageState: SUPERVISEUR_STATE });
}

/** La carte posée : `ChartCard` nomme sa zone de tracé « <titre> graphique ». */
function carte(page: Page, titre: string) {
  return page.getByRole('group', { name: `${titre} graphique` });
}

/**
 * Ouvre l'écran et attend qu'il ait rendu SON CORPS : ses cartes, ou son état
 * d'erreur. `enterEdition` sort sans rien faire tant que la disposition n'est
 * pas arrivée (`chiffres/vue.tsx`), et le bouton d'entrée reste cliquable
 * pendant ce temps : cliquer trop tôt ne produit aucun mode et aucun message.
 */
async function attendreLeCorps(page: Page): Promise<void> {
  await expect(
    carte(page, CARTES_USINE[0]).or(page.getByRole('alert').filter({ hasText: 'Réessayez' })),
  ).toBeVisible();
}

async function ouvrirEcran(page: Page, url: string = ECRAN): Promise<void> {
  const disposition = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' && new URL(response.url()).pathname === DISPOSITION,
  );
  await page.goto(url);
  await disposition;
  await attendreLeCorps(page);
}

async function ouvrirLeMode(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Composer l’écran' }).click();
  await expect(page.getByText('Mode organisation')).toBeVisible();
}

test.beforeEach(async () => {
  const api = await superviseurApi();
  try {
    const efface = await api.delete(DISPOSITION);
    expect(
      efface.ok(),
      `${DISPOSITION} a répondu ${String(efface.status())} : ${await efface.text()}`,
    ).toBe(true);
  } finally {
    await api.dispose();
  }
});

test.afterAll(async () => {
  const api = await superviseurApi();
  try {
    await api.delete(DISPOSITION);
  } finally {
    await api.dispose();
  }
});

test('GP-34 · l’écran des chiffres Grand Public se charge', async ({ page }) => {
  await ouvrirEcran(page);

  await expect(page).toHaveTitle(/^Tableau de bord Grand Public · CPI GO$/u);
  await expect(page.getByRole('button', { name: 'Composer l’écran' })).toBeVisible();
  // Le libellé du tableau de bord des VISITES n'a rien à faire ici (§1.9).
  await expect(page.getByRole('button', { name: 'Organiser les graphiques' })).toHaveCount(0);
  // L'indicateur de fraîcheur, monté avec son geste de pause.
  await expect(page.getByRole('button', { name: 'Mettre en pause' })).toBeVisible();

  await expect(page.getByRole('alert').filter({ hasText: 'Réessayez' })).toHaveCount(0);
  await expect(carte(page, CARTES_USINE[0])).toBeVisible();
});

test('GP-35 · le mode organisation met le rafraîchissement en pause', async ({ page }) => {
  await ouvrirEcran(page);
  await ouvrirLeMode(page);

  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quitter' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter un graphique' })).toBeVisible();

  // Le rafraîchissement automatique remplacerait la grille en cours d'édition :
  // l'indicateur doit dire la pause, et proposer de reprendre.
  await expect(page.getByRole('status').filter({ hasText: 'En pause' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reprendre' })).toBeVisible();
});

test('GP-36 · une carte ajoutée survit au rechargement', async ({ page }) => {
  await ouvrirEcran(page);
  await ouvrirLeMode(page);

  await page.getByRole('button', { name: 'Ajouter un graphique' }).click();
  const tiroir = page.getByRole('dialog', { name: 'Ajouter un graphique' });
  await expect(tiroir).toContainText('Choisissez ce que vous voulez suivre.');
  await tiroir.getByRole('button', { name: new RegExp(`^${CARTE_AJOUTEE}`, 'u') }).click();

  // Le tiroir reste ouvert après un choix — on peut en poser plusieurs — et son
  // voile couvre la barre d'édition : il se referme avant d'enregistrer.
  await tiroir.getByRole('button', { name: 'Fermer' }).click();
  await expect(tiroir).toHaveCount(0);

  const [reponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' && new URL(response.url()).pathname === DISPOSITION,
    ),
    page.getByRole('button', { name: 'Enregistrer' }).click(),
  ]);

  const envoye = JSON.parse(reponse.request().postData() ?? '{}') as {
    widgets: { source: string }[];
  };
  expect(envoye.widgets.map((widget) => widget.source)).toContain(SOURCE_AJOUTEE);
  expect(reponse.status(), await reponse.text()).toBe(200);

  await expect(page.getByText('Mode organisation')).toHaveCount(0);
  await expect(carte(page, CARTE_AJOUTEE)).toBeVisible();

  await page.reload();
  await expect(carte(page, CARTE_AJOUTEE)).toBeVisible();
});

test('GP-37 · quitter sans enregistrer rend la disposition d’avant', async ({ page }) => {
  const retiree = CARTES_USINE[1];
  await ouvrirEcran(page);
  await expect(carte(page, retiree)).toBeVisible();

  await ouvrirLeMode(page);
  await page.getByRole('button', { name: `Retirer ${retiree}` }).click();
  await expect(carte(page, retiree)).toHaveCount(0);

  await page.getByRole('button', { name: 'Quitter' }).click();
  const boite = page.getByRole('dialog', { name: 'Quitter sans enregistrer' });
  await expect(boite).toContainText('Les changements faits dans ce mode seront perdus.');
  await boite.getByRole('button', { name: 'Quitter sans enregistrer' }).click();

  await expect(page.getByText('Mode organisation')).toHaveCount(0);
  await expect(carte(page, retiree)).toBeVisible();
});

test('GP-38 · « Proposer par défaut » n’est offert qu’à l’ADMIN', async ({ page, browser }) => {
  await ouvrirEcran(page);
  await ouvrirLeMode(page);
  await expect(
    page.getByRole('button', { name: 'Proposer par défaut' }),
    'un SUPERVISEUR ne fixe pas la disposition de tous',
  ).toHaveCount(0);

  for (const etat of [ADMIN_STATE, DIRECTION_STATE]) {
    const contexte = await browser.newContext({
      storageState: etat,
      baseURL: WEB_URL,
      locale: 'fr-FR',
      timezoneId: 'Africa/Dakar',
    });
    try {
      const vue = await contexte.newPage();
      await ouvrirEcran(vue);
      await ouvrirLeMode(vue);
      const bouton = vue.getByRole('button', { name: 'Proposer par défaut' });
      // JAMAIS de clic : la confirmation fixerait la disposition de tous les
      // comptes qui n'en ont pas enregistré (§1.12, §4.3.4).
      if (etat === ADMIN_STATE) {
        await expect(bouton, 'l’ADMIN doit pouvoir proposer une disposition').toBeVisible();
      } else {
        await expect(bouton, 'la DIRECTION ne fixe pas la disposition de tous').toHaveCount(0);
      }
    } finally {
      await contexte.close();
    }
  }
});

test('GP-39 · « Revenir à l’écran par défaut » efface la disposition du compte', async ({
  page,
}) => {
  // Précondition : une disposition ENREGISTRÉE. Le bouton n'existe que dans ce
  // cas ; le geste éprouvé reste le clic, pas cette écriture.
  const api = await superviseurApi();
  try {
    const pose = await api.put(DISPOSITION, {
      data: {
        widgets: [
          { source: 'taux-de-joignabilite' },
          { source: 'prospects-notes' },
          { source: SOURCE_AJOUTEE },
        ],
      },
    });
    expect(pose.ok(), `${DISPOSITION} a répondu ${String(pose.status())}`).toBe(true);
  } finally {
    await api.dispose();
  }

  await ouvrirEcran(page);
  const retour = page.getByRole('button', { name: 'Revenir à l’écran par défaut' });
  await expect(retour).toBeVisible();

  const [reponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' && new URL(response.url()).pathname === DISPOSITION,
    ),
    retour.click(),
  ]);
  expect(reponse.status(), await reponse.text()).toBe(200);

  await expect(retour).toHaveCount(0);
  await expect(carte(page, CARTE_AJOUTEE)).toHaveCount(0);

  // La remise à zéro doit avoir été écrite, pas seulement affichée. Le corps
  // est attendu avant de compter : une absence lue sur une page encore vide ne
  // prouverait rien.
  await page.reload();
  await attendreLeCorps(page);
  await expect(carte(page, CARTE_AJOUTEE)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Revenir à l’écran par défaut' })).toHaveCount(0);
});

test('GP-40 · un écran sans carte le dit', async ({ page }) => {
  await ouvrirEcran(page);
  await ouvrirLeMode(page);

  for (const titre of CARTES_USINE) {
    await page.getByRole('button', { name: `Retirer ${titre}` }).click();
    await expect(carte(page, titre)).toHaveCount(0);
  }

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' && new URL(response.url()).pathname === DISPOSITION,
    ),
    page.getByRole('button', { name: 'Enregistrer' }).click(),
  ]);

  await expect(page.getByText(VIDE, { exact: true })).toBeVisible();
});

test('GP-41 · la période vit dans l’URL', async ({ page }) => {
  await ouvrirEcran(page);
  const affichee = page.locator('p[aria-live="polite"]');
  await expect(affichee).toHaveText('Ce mois-ci');

  await page.getByRole('button', { name: 'Mois dernier' }).click();
  await expect(page).toHaveURL(/\/grand-public\/statistiques\?periode=mois-dernier$/u);
  await expect(affichee).toHaveText('Mois dernier');

  await page.reload();
  await expect(page).toHaveURL(/\/grand-public\/statistiques\?periode=mois-dernier$/u);
  await expect(affichee).toHaveText('Mois dernier');
  await expect(page.getByRole('button', { name: 'Mois dernier' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('GP-42 · le filtre par téléconseiller nomme la personne, pas son identifiant', async ({
  page,
}) => {
  await ouvrirEcran(page);

  // L'équipe proposée vient de `jeux.activite.teleconseillers` : sans ce jeu,
  // le sélecteur n'est pas rendu du tout.
  const selecteur = page.getByRole('combobox', { name: 'Téléconseiller regardé' });
  await expect(selecteur).toBeVisible();
  await expect(selecteur).toContainText('Toute l’équipe');

  await selecteur.click();
  const personne = page.getByRole('option').filter({ hasNotText: 'Toute l’équipe' }).first();
  const nom = (await personne.textContent())?.trim() ?? '';
  expect(nom).not.toBe('');
  await personne.click();

  await expect(page).toHaveURL(/[?&]teleconseiller=[0-9a-f-]{36}/u);
  await expect(selecteur).toContainText(nom);

  await selecteur.click();
  await page.getByRole('option', { name: 'Toute l’équipe' }).click();
  await expect(page).not.toHaveURL(/teleconseiller=/u);
  await expect(selecteur).toContainText('Toute l’équipe');
});

test('GP-43 · des chiffres en panne n’emportent pas la coque', async ({ page }) => {
  // Les cartes d'usine de cet écran vivent toutes sur `/supervision/activite`,
  // hors de cette famille : la panne simulée porte sur les analyses, demandées
  // dès que le mode organisation est ouvert.
  await page.route('**/api/v1/analytics/**', (route) => route.fulfill({ status: 500 }));

  await ouvrirEcran(page);
  await ouvrirLeMode(page);

  const panne = page.getByRole('alert').filter({ hasText: 'Réessayez' });
  await expect(panne.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Navigation principale' }),
    'la panne des chiffres ne doit pas emporter la barre latérale',
  ).toBeVisible();
  await expect(panne).toContainText('Erreur serveur (500). Réessayez.');
});

test('GP-44 · les montants ne sont pas proposés à la supervision', async ({ page }) => {
  await ouvrirEcran(page);
  await ouvrirLeMode(page);
  await page.getByRole('button', { name: 'Ajouter un graphique' }).click();

  const tiroir = page.getByRole('dialog', { name: 'Ajouter un graphique' });
  // Le tiroir a bien rendu son catalogue : sans ce repère, les deux absences
  // ci-dessous ne prouveraient rien.
  await expect(
    tiroir.getByRole('button', { name: new RegExp(`^${CARTE_AJOUTEE}`, 'u') }),
  ).toBeVisible();

  for (const montant of CARTES_DE_MONTANT) {
    await expect(
      tiroir.getByRole('button', { name: new RegExp(`^${montant}`, 'u') }),
      `${montant} est réservé à l’ADMIN et à la DIRECTION`,
    ).toHaveCount(0);
    await expect(carte(page, montant)).toHaveCount(0);
  }
});

test('GP-45 · à 375 px la grille passe en une colonne', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await ouvrirEcran(page);

  const premiere = carte(page, CARTES_USINE[0]);
  const seconde = carte(page, CARTES_USINE[1]);
  await expect(premiere).toBeVisible();
  await expect(seconde).toBeVisible();

  const haut = await premiere.boundingBox();
  const suivante = await seconde.boundingBox();
  expect(suivante?.x, 'deux cartes côte à côte : la grille n’est pas en une colonne').toBe(haut?.x);
  expect(suivante?.y ?? 0).toBeGreaterThan(haut?.y ?? 0);

  const entree = page.getByRole('button', { name: 'Composer l’écran' });
  await expect(entree).toBeVisible();
  await entree.click();

  const enregistrer = page.getByRole('button', { name: 'Enregistrer' });
  await expect(enregistrer).toBeVisible();
  const boite = await enregistrer.boundingBox();
  expect(
    (boite?.x ?? 0) + (boite?.width ?? 0),
    'la barre d’édition déborde du cadre à 375 px',
  ).toBeLessThanOrEqual(375);
});
