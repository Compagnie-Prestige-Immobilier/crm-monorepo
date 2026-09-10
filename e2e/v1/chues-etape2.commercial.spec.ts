import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * Étape 2 du projet CHUES : `/chues/prospects/nouveau`, vu par un
 * TÉLÉCONSEILLER. CHU-ET2-01 à CHU-ET2-09.
 *
 * Préfixe `E2E-CHUES-ET2 `, plage réservée `+221 78 100 42 0x` (§5.2). La
 * saisie en rafale qui garde banque et syndicat, et le numéro déjà pris, sont
 * DÉJÀ couverts par `console.spec.ts` : ils ne sont pas réécrits ici.
 */
test.use({ storageState: 'v1/.auth/commercial.json' });

const PREFIXE = 'E2E-CHUES-ET2';

const REPRESENTANT = { fullName: `${PREFIXE} Rep`, phone: '+221781004209' } as const;

interface Cascade {
  region: string;
  departementsDeLaRegion: number;
  departementsTotal: number;
}

let representantId = '';
let cascade: Cascade | null = null;

async function attendu<T>(reponse: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(
    reponse.ok(),
    `${reponse.url()} a répondu ${String(reponse.status())} : ${await reponse.text()}`,
  ).toBe(true);
  return (await reponse.json()) as T;
}

test.beforeAll(async () => {
  const api = await adminApi();
  try {
    // Les fiches d'une exécution précédente partent D'ABORD : un `afterAll` ne
    // tourne pas après un échec dur (§5.1).
    const anciens = await attendu<{ items: { id: string; prenom: string }[] }>(
      await api.get('/api/v1/prospects', { params: { search: PREFIXE, pageSize: '100' } }),
    );
    for (const fiche of anciens.items) {
      if (fiche.prenom === PREFIXE) await api.delete(`/api/v1/prospects/${fiche.id}`);
    }

    const departements = await attendu<{ id: string; regionId: string; regionName: string }[]>(
      await api.get('/api/v1/referentiels/departements', { params: { activeOnly: 'false' } }),
    );
    const departementId = departements[0]?.id;
    expect(departementId, 'aucun département dans le référentiel').toBeDefined();

    const parRegion = new Map<string, number>();
    for (const item of departements) {
      parRegion.set(item.regionName, (parRegion.get(item.regionName) ?? 0) + 1);
    }
    const resserrante = [...parRegion.entries()].find(
      ([, nombre]) => nombre > 0 && nombre < departements.length,
    );
    expect(
      resserrante,
      'aucune région ne resserre la liste des départements : la cascade ne peut pas être éprouvée',
    ).toBeDefined();
    cascade = {
      region: resserrante?.[0] ?? '',
      departementsDeLaRegion: resserrante?.[1] ?? 0,
      departementsTotal: departements.length,
    };

    const trouves = await attendu<{ items: { id: string; phoneE164: string }[] }>(
      await api.get('/api/v1/representants', {
        params: { search: REPRESENTANT.phone, pageSize: '20' },
      }),
    );
    const existant = trouves.items.find((row) => row.phoneE164 === REPRESENTANT.phone);
    if (existant !== undefined) {
      representantId = existant.id;
      return;
    }

    const cree = await attendu<{ id: string }>(
      await api.post('/api/v1/representants', {
        data: {
          fullName: REPRESENTANT.fullName,
          phone: REPRESENTANT.phone,
          departementId,
        },
      }),
    );
    representantId = cree.id;
  } finally {
    await api.dispose();
  }
});

/** Les POST de création, comptés pour prouver qu'aucun envoi n'est parti. */
function compterCreations(page: Page): string[] {
  const envois: string[] = [];
  page.on('request', (requete) => {
    const chemin = new URL(requete.url()).pathname;
    if (requete.method() === 'POST' && chemin === '/api/v1/prospects') envois.push(chemin);
  });
  return envois;
}

const champRepresentant = (page: Page) => page.getByRole('combobox', { name: /^Représentant/ });

const chercherDansMenu = (page: Page) =>
  page.getByPlaceholder('Chercher…').filter({ visible: true });

/**
 * Ouvre un menu déroulant, le précédent une fois DÉMONTÉ.
 *
 * Le popup de Base UI sort avec une animation : enchaîner banque puis syndicat
 * trouvait deux champs « Chercher… » à l'écran et violait le mode strict.
 */
async function ouvrirMenu(page: Page, champ: RegExp): Promise<void> {
  await expect(chercherDansMenu(page)).toHaveCount(0);
  await page.getByRole('combobox', { name: champ }).click();
}

/**
 * Choisit le représentant par son NUMÉRO : la recherche par nom rend
 * aujourd'hui tout l'annuaire (voir CHU-ET1-02), et la fiche visée sortirait
 * de la première page dès que la base grossit.
 */
async function choisirRepresentant(page: Page): Promise<void> {
  await ouvrirMenu(page, /^Représentant/);
  await chercherDansMenu(page).fill(REPRESENTANT.phone.slice(4));
  await page.getByRole('option').filter({ hasText: REPRESENTANT.fullName }).click();
  await expect(champRepresentant(page)).toContainText(REPRESENTANT.fullName);
}

async function choisirDansListe(page: Page, champ: RegExp, recherche: string): Promise<void> {
  await ouvrirMenu(page, champ);
  await chercherDansMenu(page).fill(recherche);
  await page.getByRole('option').filter({ hasText: recherche }).first().click();
}

test('CHU-ET2-01 la validation nomme chaque champ manquant', async ({ page }) => {
  const envois = compterCreations(page);
  await page.goto('/chues/prospects/nouveau');

  await page.getByRole('button', { name: 'Enregistrer ce prospect' }).click();

  for (const message of [
    'Le prénom est obligatoire.',
    'Le nom est obligatoire.',
    'Le numéro est obligatoire.',
    'Choisissez un représentant.',
  ]) {
    await expect(
      page.getByRole('alert').filter({ hasText: message }),
      `« ${message} » doit nommer le champ manquant`,
    ).toBeVisible();
  }

  expect(envois, 'aucun formulaire incomplet ne doit partir au serveur').toEqual([]);
});

test('CHU-ET2-02 un numéro invalide pour le pays choisi est refusé côté écran', async ({
  page,
}) => {
  const envois = compterCreations(page);
  await page.goto('/chues/prospects/nouveau');

  await choisirRepresentant(page);
  await page.getByLabel(/^Prénom/).fill(PREFIXE);
  await page.getByLabel(/^Nom/).fill('Numero invalide');
  await page.getByLabel(/^Téléphone/).fill('123');

  await page.getByRole('button', { name: 'Enregistrer ce prospect' }).click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'Numéro invalide pour le pays choisi.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Le numéro est obligatoire.' }),
  ).toHaveCount(0);
  expect(envois, 'un numéro inexploitable ne doit pas atteindre la base').toEqual([]);
});

test('CHU-ET2-03 l’indicatif du pays change le numéro envoyé', async ({ page }) => {
  // Le représentant vient de l'URL : ce scénario porte sur l'INDICATIF, et
  // ouvrir le sélecteur de représentant n'y ajoute rien.
  await page.goto(`/chues/prospects/nouveau?rep=${representantId}`);

  await page.getByLabel('Pays').selectOption('33');
  await page.getByLabel(/^Prénom/).fill(PREFIXE);
  await page.getByLabel(/^Nom/).fill('Indicatif France');
  await page.getByLabel(/^Téléphone/).fill('612345678');

  const envoi = page.waitForResponse(
    (reponse) =>
      reponse.request().method() === 'POST' &&
      new URL(reponse.url()).pathname === '/api/v1/prospects',
  );
  await page.getByRole('button', { name: 'Enregistrer ce prospect' }).click();

  const reponse = await envoi;
  const corps = (await reponse.request().postDataJSON()) as { phone: string };
  expect(
    corps.phone,
    'l’indicatif choisi doit voyager tel quel, sinon toute saisie est normalisée en +221',
  ).toMatch(/^\+33/);
});

test('CHU-ET2-04 la cascade région resserre les départements, dans le dialogue de création', async ({
  page,
}) => {
  expect(cascade, 'la cascade n’a pas été relevée dans le référentiel').not.toBeNull();
  await page.goto('/chues/prospects/nouveau');

  await ouvrirMenu(page, /^Représentant/);
  await chercherDansMenu(page).fill(`${PREFIXE} Nouveau`);
  await page.getByRole('option', { name: `Créer « ${PREFIXE} Nouveau »` }).click();

  const dialogue = page.getByRole('dialog').filter({ hasText: 'Nouveau représentant' });
  await expect(dialogue).toBeVisible();
  await expect(
    dialogue.getByLabel(/^Nom complet/),
    'la saisie déjà tapée ne doit pas être perdue',
  ).toHaveValue(`${PREFIXE} Nouveau`);

  await dialogue.getByRole('combobox', { name: /^Département/ }).click();
  const avant = await page.getByRole('option').count();
  await page.keyboard.press('Escape');

  await dialogue.getByRole('combobox', { name: /^Région/ }).click();
  await page
    .getByRole('option')
    .filter({ hasText: cascade?.region ?? '' })
    .first()
    .click();

  await dialogue.getByRole('combobox', { name: /^Département/ }).click();
  const apres = await page.getByRole('option').count();

  expect(
    apres,
    `le choix de la région « ${cascade?.region ?? ''} » doit réduire la liste des départements`,
  ).toBeLessThan(avant);
});

test('CHU-ET2-05 la saisie tapée pré-remplit le bon champ selon lettres ou chiffres', async ({
  page,
}) => {
  await page.goto('/chues/prospects/nouveau');

  await ouvrirMenu(page, /^Représentant/);
  await chercherDansMenu(page).fill('781004201');
  await page.getByRole('option', { name: 'Créer « 781004201 »' }).click();

  const chiffres = page.getByRole('dialog').filter({ hasText: 'Nouveau représentant' });
  await expect(chiffres.getByLabel(/^Téléphone/)).toHaveValue('781004201');
  await expect(chiffres.getByLabel(/^Nom complet/)).toHaveValue('');
  await chiffres.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(chiffres).toHaveCount(0);

  await ouvrirMenu(page, /^Représentant/);
  await chercherDansMenu(page).fill(`${PREFIXE} Fatou`);
  await page.getByRole('option', { name: `Créer « ${PREFIXE} Fatou »` }).click();

  const lettres = page.getByRole('dialog').filter({ hasText: 'Nouveau représentant' });
  await expect(lettres.getByLabel(/^Nom complet/)).toHaveValue(`${PREFIXE} Fatou`);
  await expect(lettres.getByLabel(/^Téléphone/)).toHaveValue('');
});

test('CHU-ET2-06 `Ctrl + Entrée` enregistre et enchaîne', async ({ page }) => {
  await page.goto('/chues/prospects/nouveau');

  await expect(page.getByText('Ctrl + Entrée enregistre et enchaîne.')).toBeVisible();
  await expect(page.getByText('Aucun prospect noté pour l’instant.')).toBeVisible();

  await choisirRepresentant(page);
  await choisirDansListe(page, /^Banque/, 'CBAO');
  await choisirDansListe(page, /^Syndicat/, 'CHUES');
  await page.getByLabel(/^Prénom/).fill(PREFIXE);
  await page.getByLabel(/^Nom/).fill('Rafale');
  await page.getByLabel(/^Téléphone/).fill('78 100 42 01');

  await page.keyboard.press('Control+Enter');

  await expect(
    page.getByText(`1 prospect noté pour ${REPRESENTANT.fullName} aujourd’hui`),
  ).toBeVisible();
  await expect(page.getByLabel(/^Prénom/)).toHaveValue('');
  await expect(page.getByLabel(/^Nom/)).toHaveValue('');
  await expect(page.getByLabel(/^Téléphone/)).toHaveValue('');
  await expect(
    page.getByLabel(/^Prénom/),
    'la fiche suivante commence là où le doigt est déjà posé',
  ).toBeFocused();
});

test('CHU-ET2-07 le lien de sortie ramène au projet', async ({ page }) => {
  await page.goto('/chues/prospects/nouveau');

  const sortie = page.getByRole('link', { name: 'Terminé, revenir au projet' });
  await expect(sortie).toHaveAttribute('href', '/chues');

  await sortie.click();
  await expect(page).toHaveURL(/\/chues$/);
});

test('CHU-ET2-08 `?rep=<id>` verrouille le représentant', async ({ page }) => {
  expect(representantId, 'le représentant du parcours n’a pas été créé').not.toBe('');
  await page.goto(`/chues/prospects/nouveau?rep=${representantId}`);

  await expect(
    champRepresentant(page),
    'le représentant venant de l’URL ne se rechoisit pas',
  ).toHaveCount(0);

  await page.getByLabel(/^Prénom/).fill(PREFIXE);
  await page.getByLabel(/^Nom/).fill('Verrou');
  await page.getByLabel(/^Téléphone/).fill('78 100 42 03');

  const envoi = page.waitForResponse(
    (reponse) =>
      reponse.request().method() === 'POST' &&
      new URL(reponse.url()).pathname === '/api/v1/prospects',
  );
  await page.getByRole('button', { name: 'Enregistrer ce prospect' }).click();

  const reponse = await envoi;
  const corps = (await reponse.request().postDataJSON()) as { representantId: string };
  expect(corps.representantId, 'la fiche doit rester rattachée au représentant de l’URL').toBe(
    representantId,
  );
  expect(reponse.status(), 'la fiche valide doit être acceptée').toBe(201);
});

test('CHU-ET2-09 l’écran tient sur 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/chues/prospects/nouveau');

  await expect(page.getByLabel(/^Prénom/)).toBeVisible();
  await expect(page.getByLabel(/^Nom/)).toBeVisible();
  await expect(page.getByLabel(/^Téléphone/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer ce prospect' })).toBeVisible();

  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeur, 'la grille sm:grid-cols-2 fuit horizontalement sous 375 px').toBeLessThanOrEqual(
    375,
  );
});
