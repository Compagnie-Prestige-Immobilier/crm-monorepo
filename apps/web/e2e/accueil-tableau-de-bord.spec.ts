import { format, parseISO, startOfMonth, subDays, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { readFile } from 'node:fs/promises';

import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * `/accueil/tableau-de-bord` vu par l'ACCUEIL (`fixture.accueil@cpi.sn`).
 * ACC-TDB-01 à ACC-TDB-14.
 *
 * La SEULE donnée touchée est la disposition du compte ACCUEIL, remise à zéro
 * en début de parcours et dans un `afterAll` inconditionnel. Aucune visite,
 * aucun référentiel n'est créé : ce fichier n'a ni préfixe ni plage de
 * téléphones (§5.4).
 *
 * Libellés de CET écran : « Organiser les graphiques » et « Revenir à la
 * disposition par défaut » (§1.9), relevés dans `barre-edition.tsx` (valeur par
 * défaut de `entryLabel`, que `vue.tsx` ne remplace pas).
 *
 * « Proposer par défaut » n'est jamais confirmé (§4.3.4) : ACC-TDB-06 et
 * ACC-TDB-13 prouvent son ABSENCE pour un compte non administrateur.
 */
test.use({ storageState: 'e2e/.auth/accueil.json' });
test.describe.configure({ mode: 'serial' });

const ROUTE = '/accueil/tableau-de-bord';
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const DISPOSITION = '/api/v1/tableaux-de-bord/visites/disposition';

interface Disposition {
  widgets: { source: string }[];
  source: 'utilisateur' | 'defaut' | 'usine';
}

/** Le relais web porte le cookie `httpOnly` ; l'API directe ne le voit pas (§6.7). */
async function accueilApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: WEB_URL, storageState: 'e2e/.auth/accueil.json' });
}

async function lireDisposition(): Promise<Disposition> {
  const api = await accueilApi();
  try {
    const reponse = await api.get(DISPOSITION);
    expect(
      reponse.ok(),
      `GET ${DISPOSITION} a répondu ${String(reponse.status())} : ${await reponse.text()}`,
    ).toBe(true);
    return (await reponse.json()) as Disposition;
  } finally {
    await api.dispose();
  }
}

async function effacerDisposition(): Promise<void> {
  const api = await accueilApi();
  try {
    await api.delete(DISPOSITION);
  } finally {
    await api.dispose();
  }
}

const pastilles = (page: Page) => page.getByRole('group', { name: 'Période affichée' });
/** La ligne annoncée : `<p aria-live="polite">` de `vue.tsx`, seule de la page. */
const periodeAnnoncee = (page: Page) => page.locator('p[aria-live="polite"]');
const organiser = (page: Page) => page.getByRole('button', { name: 'Organiser les graphiques' });
const modeOuvert = (page: Page) => page.getByText('Mode organisation', { exact: true });
const carteParHeure = (page: Page) => page.getByRole('group', { name: 'Par heure graphique' });

const ERREURS =
  /Serveur injoignable|Chargement impossible|Le serveur CPI a rencontré une erreur|Accès refusé/;

/** Le jour d'aujourd'hui LU DANS LE NAVIGATEUR : lui seul calcule les préréglages. */
async function aujourdhuiDuNavigateur(page: Page): Promise<Date> {
  const [annee, mois, jour] = await page.evaluate(() => {
    const maintenant = new Date();
    return [maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()] as const;
  });
  return new Date(annee, mois, jour);
}

test.beforeAll(async () => {
  await effacerDisposition();
});

test.afterAll(async () => {
  await effacerDisposition();
});

test('ACC-TDB-01 l’écran se charge sur le mois en cours', async ({ page }) => {
  await page.goto(ROUTE);

  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible();
  await expect(page).toHaveTitle(/Tableau de bord des visites/);

  await expect(pastilles(page).getByRole('button', { name: 'Ce mois-ci' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(periodeAnnoncee(page)).toHaveText('Ce mois-ci');

  await expect(organiser(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exporter le détail' })).toBeVisible();

  await expect(page.getByRole('heading', { name: ERREURS })).toHaveCount(0);
});

for (const { libelle, parametre } of [
  { libelle: 'Ce mois-ci', parametre: 'ce-mois' },
  { libelle: 'Mois dernier', parametre: 'mois-dernier' },
  { libelle: '3 derniers mois', parametre: 'trois-mois' },
  { libelle: '12 derniers mois', parametre: 'douze-mois' },
  { libelle: 'Cette année', parametre: 'cette-annee' },
  { libelle: 'Année dernière', parametre: 'annee-derniere' },
] as const) {
  test(`ACC-TDB-02 « ${libelle} » écrit periode=${parametre} dans l’URL`, async ({ page }) => {
    await page.goto(ROUTE);
    await pastilles(page).getByRole('button', { name: libelle }).click();

    await expect(page, `« ${libelle} » doit écrire periode=${parametre}`).toHaveURL(
      new RegExp(`[?&]periode=${parametre}(&|$)`),
    );
    await expect(periodeAnnoncee(page)).toHaveText(libelle);

    for (const autre of ['Ce mois-ci', 'Mois dernier', '3 derniers mois'] as const) {
      await expect(
        pastilles(page).getByRole('button', { name: autre }),
        `« ${autre} » ne doit être enfoncé que s’il est le préréglage choisi`,
      ).toHaveAttribute('aria-pressed', autre === libelle ? 'true' : 'false');
    }
  });
}

test('ACC-TDB-03 une plage libre survit au rechargement', async ({ page }) => {
  await page.goto(ROUTE);

  const moisPrecedent = startOfMonth(subMonths(await aujourdhuiDuNavigateur(page), 1));
  const du = new Date(moisPrecedent.getFullYear(), moisPrecedent.getMonth(), 5);
  const au = new Date(moisPrecedent.getFullYear(), moisPrecedent.getMonth(), 10);
  const jourLong = (jour: Date): string => format(jour, 'dd MMMM yyyy', { locale: fr });
  const jourCourt = (jour: Date): string => format(jour, 'dd MMM yyyy', { locale: fr });
  const iso = (jour: Date): string => format(jour, 'yyyy-MM-dd');

  await pastilles(page).getByRole('button', { name: 'Plage libre' }).click();

  // Les deux calendriers s'ouvrent sur le mois de LEUR valeur courante, qui est
  // le mois en cours : chacun recule d'un mois avant de choisir son jour.
  for (const [champ, cible] of [
    ['Du', du],
    ['Au', au],
  ] as const) {
    const declencheur = page.getByRole('button', { name: champ, exact: true });
    await declencheur.click();
    await page.getByRole('button', { name: 'Mois précédent' }).click();
    await page.getByRole('grid', { name: champ }).getByRole('gridcell', { name: jourLong(cible) }).click();
    // Le popover est refermé et la valeur posée : sans cette attente, le second
    // calendrier se monte pendant que le premier se démonte.
    await expect(declencheur).toHaveText(jourCourt(cible));
  }

  const attendue = new RegExp(`[?&]periode=libre&du=${iso(du)}&au=${iso(au)}(&|$)`);
  await expect(page).toHaveURL(attendue);
  await expect(periodeAnnoncee(page)).toHaveText(`${jourCourt(du)} – ${jourCourt(au)}`);

  await page.reload();
  await expect(page).toHaveURL(attendue);
  await expect(periodeAnnoncee(page)).toHaveText(`${jourCourt(du)} – ${jourCourt(au)}`);
});

test('ACC-TDB-04 une plage de plus de 400 jours est refusée avant l’appel', async ({ page }) => {
  const statistiques: string[] = [];
  page.on('request', (requete) => {
    if (requete.url().includes('/api/v1/visites/statistiques')) statistiques.push(requete.url());
  });

  await page.goto(ROUTE);
  const au = await aujourdhuiDuNavigateur(page);
  const du = subDays(au, 499);
  const iso = (jour: Date): string => format(jour, 'yyyy-MM-dd');

  // La plage libre EST portée par l'URL (ACC-TDB-03) : ouvrir le lien partagé
  // est le geste qui pose 500 jours sans quinze clics de calendrier.
  await page.goto(`${ROUTE}?periode=libre&du=${iso(du)}&au=${iso(au)}`);

  await expect(
    page.getByRole('alert').filter({ hasText: 'Cette plage dépasse' }),
  ).toHaveText(
    'Cette plage dépasse 400 jours (500 jours) : revenez à une période plus courte.',
  );

  const partiesAvecCesBornes = statistiques.filter(
    (url) => url.includes(`from=${iso(du)}`) && url.includes(`to=${iso(au)}`),
  );
  expect(
    partiesAvecCesBornes,
    'la garde cliente doit désactiver la requête, pas laisser l’API répondre VISITE_STATS_RANGE_TOO_WIDE',
  ).toEqual([]);
});

test('ACC-TDB-05 le sélecteur de comparaison change l’URL', async ({ page }) => {
  await page.goto(ROUTE);

  const selecteur = page.getByRole('combobox', { name: 'Comparer à' });

  await selecteur.click();
  await page.getByRole('option', { name: 'Comparer à : période précédente' }).click();
  await expect(page).toHaveURL(/[?&]comparaison=precedente(&|$)/);
  // « l'option choisie n'est pas celle affichée » est l'autre moitié du défaut
  // que ce scénario attrape : le déclencheur doit rendre le LIBELLÉ.
  // Ancré à gauche : le chevron du déclencheur ajoute son propre caractère.
  await expect(selecteur).toHaveText(/^Comparer à : période précédente/);

  await selecteur.click();
  await page.getByRole('option', { name: 'Comparer à : rien' }).click();
  await expect(page).not.toHaveURL(/comparaison=/);
  await expect(selecteur).toHaveText(/^Comparer à : rien/);
});

test('ACC-TDB-06 le mode Organiser s’ouvre et annonce son état', async ({ page }) => {
  await page.goto(ROUTE);
  await organiser(page).click();

  await expect(modeOuvert(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter un graphique' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quitter', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Exporter le détail' })).toHaveCount(0);
  await expect(organiser(page)).toHaveCount(0);

  await expect(
    page.getByRole('button', { name: 'Proposer par défaut' }),
    'un compte ACCUEIL ne fixe pas la disposition de tous les comptes',
  ).toHaveCount(0);
});

test('ACC-TDB-07 ajouter un graphique depuis le tiroir des sources', async ({ page }) => {
  await page.goto(ROUTE);
  await organiser(page).click();
  await page.getByRole('button', { name: 'Ajouter un graphique' }).click();

  const tiroir = page.getByRole('dialog', { name: 'Ajouter un graphique' });
  await expect(tiroir).toBeVisible();
  await expect(
    tiroir.getByText(
      'Choisissez ce que vous voulez suivre. L’image montre la forme conseillée.',
      { exact: true },
    ),
  ).toBeVisible();

  await tiroir.getByRole('button', { name: /^Par heure/ }).click();

  await expect(
    tiroir,
    'le tiroir doit se refermer sur le choix : tant qu’il couvre la grille, la carte ajoutée ' +
      'reste hors de l’arbre accessible et ne peut pas prendre le focus',
  ).toHaveCount(0);
  await expect(carteParHeure(page)).toBeVisible();

  // La carte ajoutée reçoit le focus : sans cela elle naît hors de l'écran et
  // le clic paraît n'avoir rien fait.
  const focalise = await page.evaluate(() => document.activeElement?.id ?? '');
  expect(focalise, 'la carte ajoutée doit recevoir le focus').toMatch(/^widget-par-heure-/);

  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
});

/**
 * Le tiroir ne se referme pas de lui-même (défaut relevé par ACC-TDB-07) : on
 * le referme au clavier, sinon son calque modal intercepte tous les clics
 * suivants. La preuve du défaut reste portée par ACC-TDB-07, pas par celui-ci.
 */
async function ajouterParHeure(page: Page): Promise<void> {
  const tiroir = page.getByRole('dialog', { name: 'Ajouter un graphique' });
  await page.getByRole('button', { name: 'Ajouter un graphique' }).click();
  await tiroir.getByRole('button', { name: /^Par heure/ }).click();
  await page.keyboard.press('Escape');
  await expect(tiroir).toHaveCount(0);
}

test('ACC-TDB-08 la disposition enregistrée survit à un rechargement', async ({ page }) => {
  await page.goto(ROUTE);
  await organiser(page).click();
  await ajouterParHeure(page);
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(modeOuvert(page)).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Revenir à la disposition par défaut' }),
  ).toBeVisible();

  await page.reload();
  await expect(carteParHeure(page)).toBeVisible();

  const enregistree = await lireDisposition();
  expect(enregistree.source).toBe('utilisateur');
  expect(enregistree.widgets.map((widget) => widget.source)).toContain('par-heure');
});

test('ACC-TDB-09 retirer un graphique et enregistrer', async ({ page }) => {
  await page.goto(ROUTE);
  await organiser(page).click();
  await page.getByRole('button', { name: 'Retirer Par heure' }).click();

  await expect(carteParHeure(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(modeOuvert(page)).toHaveCount(0);

  await page.reload();
  await expect(carteParHeure(page)).toHaveCount(0);

  const enregistree = await lireDisposition();
  expect(enregistree.widgets.map((widget) => widget.source)).not.toContain('par-heure');
});

test('ACC-TDB-10 quitter sans enregistrer demande confirmation et rétablit', async ({ page }) => {
  const envois: string[] = [];
  page.on('request', (requete) => {
    if (requete.method() === 'PUT' && requete.url().includes(DISPOSITION)) {
      envois.push(requete.url());
    }
  });

  await page.goto(ROUTE);
  await organiser(page).click();
  await ajouterParHeure(page);
  await expect(carteParHeure(page)).toBeVisible();

  await page.getByRole('button', { name: 'Quitter', exact: true }).click();

  const boite = page.getByRole('dialog', { name: 'Quitter sans enregistrer' });
  await expect(boite).toBeVisible();
  await expect(
    boite.getByText('Les changements faits dans ce mode seront perdus.', { exact: true }),
  ).toBeVisible();
  await boite.getByRole('button', { name: 'Quitter sans enregistrer' }).click();

  await expect(modeOuvert(page)).toHaveCount(0);
  await expect(carteParHeure(page)).toHaveCount(0);
  expect(envois, 'quitter sans enregistrer n’envoie aucune disposition').toEqual([]);

  // Contre-épreuve : sans modification, la confirmation ne doit PAS s'afficher.
  await organiser(page).click();
  await expect(modeOuvert(page)).toBeVisible();
  await page.getByRole('button', { name: 'Quitter', exact: true }).click();

  await expect(modeOuvert(page)).toHaveCount(0);
  await expect(
    page.getByRole('dialog', { name: 'Quitter sans enregistrer' }),
    'une confirmation qui s’affiche quand rien n’a changé devient un réflexe',
  ).toHaveCount(0);
  expect(envois).toEqual([]);
});

test('ACC-TDB-12 l’export CSV du détail produit un vrai fichier', async ({ page }) => {
  await page.goto(ROUTE);

  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter le détail' }).click(),
  ]);

  const nom = telechargement.suggestedFilename();
  expect(nom).toMatch(/^cpi-visites-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/);

  const chemin = await telechargement.path();
  // Le BOM ouvre le fichier : c'est lui qui fait lire l'UTF-8 à Excel.
  const contenu = (await readFile(chemin, 'utf8')).replace(/^﻿/u, '');
  const lignes = contenu.split('\r\n');

  const bornes = nom.replace(/^cpi-visites-/u, '').replace(/\.csv$/u, '');
  const du = bornes.slice(0, 10);
  const au = bornes.slice(11);
  expect(lignes[0]).toBe(`Visites du ${du} au ${au}`);

  // `csvRows` sépare par `;` (apps/web/src/lib/csv.ts) : un fichier vide doit
  // exister quand même, avec son total.
  expect(lignes.filter((ligne) => /^Total;\d+$/u.test(ligne))).toHaveLength(1);
  expect(parseISO(du).getTime()).toBeLessThanOrEqual(parseISO(au).getTime());
});

test('ACC-TDB-13 « Proposer par défaut » est réservé à l’administrateur', async ({ page }) => {
  await page.goto(ROUTE);
  await organiser(page).click();
  await expect(modeOuvert(page)).toBeVisible();

  // Le geste n'est JAMAIS exécuté (§4.3.4) : on compte, on ne clique pas.
  await expect(page.getByRole('button', { name: 'Proposer par défaut' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Fixer la disposition par défaut' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Quitter', exact: true }).click();
  await expect(modeOuvert(page)).toHaveCount(0);
});

test('ACC-TDB-14 l’écran est utilisable en 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(ROUTE);
  await page.reload();

  for (const libelle of [
    'Ce mois-ci',
    'Mois dernier',
    '3 derniers mois',
    '12 derniers mois',
    'Cette année',
    'Année dernière',
    'Plage libre',
  ] as const) {
    await expect(
      pastilles(page).getByRole('button', { name: libelle }),
      `« ${libelle} » doit rester visible sur le téléphone du comptoir`,
    ).toBeVisible();
  }

  await expect(organiser(page)).toBeVisible();
  await expect(organiser(page)).toBeEnabled();

  const debordement = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(
    debordement,
    'la barre d’actions (« Exporter le détail », « Organiser les graphiques ») déborde : ' +
      'son conteneur est un flex sans retour à la ligne',
  ).toBeLessThanOrEqual(0);
});

/** Dernier du fichier : il rend au compte ACCUEIL sa disposition d'origine. */
test('ACC-TDB-11 « Revenir à la disposition par défaut » efface la sienne', async ({ page }) => {
  await page.goto(ROUTE);

  const retour = page.getByRole('button', { name: 'Revenir à la disposition par défaut' });
  await expect(retour).toBeVisible();
  await retour.click();
  await expect(retour).toHaveCount(0);

  const remise = await lireDisposition();
  expect(['defaut', 'usine']).toContain(remise.source);

  await page.reload();
  await expect(retour).toHaveCount(0);
  await expect(
    page.getByRole('group', { name: /graphique$/ }),
    'la grille rechargée doit correspondre à la disposition rendue par l’API',
  ).toHaveCount(remise.widgets.length);
});
