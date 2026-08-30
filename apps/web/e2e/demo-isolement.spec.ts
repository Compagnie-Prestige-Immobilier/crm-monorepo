import { expect, test, type Locator, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * Espace démo : bascule, réinitialisation, isolement DANS LES DEUX SENS.
 * DEMO-01 à DEMO-09 (E2E.md §7.7).
 *
 * `workspaces.spec.ts` couvre déjà « l'espace démo se réinitialise et reste
 * isolé » : la bascule aller-retour et la persistance du bandeau d'un écran à
 * l'autre. Ce qu'il ne couvre pas, et qui est éprouvé ici : le contenu exact du
 * jeu de démonstration après réinitialisation, les DEUX sens de l'isolement,
 * la preuve que la réinitialisation n'atteint pas le schéma `public`, les
 * droits du rôle BANQUE_FINANCE en démo et la fermeture de l'export intégral.
 * Ce fichier ne modifie pas `workspaces.spec.ts` et ne rejoue rien de ce qu'il
 * prouve déjà.
 *
 * SEUL fichier autorisé à basculer d'espace et à appeler
 * `POST /api/v1/admin/demo/reset` (E2E.md §4.3.5). Il tourne en dernier, seul.
 *
 * UNE page par session, tenue d'un test à l'autre : l'espace de travail vit
 * dans le cookie de session du CONTEXTE. Une page neuve par test repartirait de
 * l'état posé sur disque — c'est-à-dire de l'espace public — et aucun des
 * parcours d'isolement ne pourrait s'écrire.
 *
 * Données laissées en base : deux visites (le registre n'a aucune route de
 * suppression, d'où le `RUN` du §5.1) — une dans `demo`, effacée par la
 * réinitialisation suivante, une dans `public` — et un prospect public
 * `+221781002101`, repris par le `beforeAll` de l'exécution suivante.
 */

test.use({ storageState: 'e2e/.auth/admin.json' });
test.describe.configure({ mode: 'serial' });

const RUN = String(Date.now()).slice(-8);

/** Visites : indestructibles, donc horodatées (§5.1). */
const VISITE_DEMO = `E2E-DEMO-VIS-${RUN} Visiteur Demo`;
const VISITE_PUBLIC = `E2E-DEMO-VIS-${RUN} Visiteur Public`;

/** Prospects : supprimables, donc suffixe stable et nettoyage en tête (§5.1). */
const VERS_PUBLIC = {
  prenom: 'E2E-DEMO-vers-public',
  nom: 'Temoin',
  national: '781002100',
  phone: '+221781002100',
} as const;
const VERS_DEMO = {
  prenom: 'E2E-DEMO-vers-demo',
  nom: 'Temoin',
  national: '781002101',
  phone: '+221781002101',
} as const;

/**
 * Les deux témoins publics que ce fichier ne possède pas : les comptes actifs
 * et les entrées « Classeur d'origine » du registre. Ils se lisent, ils ne se
 * modifient jamais (§4.3.6). Ce sont exactement deux des dix-sept tables que la
 * fabrique VIDE dans le schéma `demo` avant de les recopier : si une
 * réinitialisation perdait sa qualification de schéma, elles tomberaient les
 * premières.
 */
const COMPTES_ACTIFS = '/api/v1/users';
const ENTREPRISES = '/api/v1/visites/referentiels/entreprises';

const OUVRIR_DEMO = 'Ouvrir l’espace démo';
const QUITTER_DEMO = 'Quitter l’espace démo';
const PHRASE_BANDEAU = 'Données fictives. Les e-mails et les exports intégraux sont désactivés.';

/** `<li data-sonner-toast>` n'a aucun rôle : le toast se vise par son texte (§6.3). */
const TOAST_VISITE = /^Visite (V-\d{4}-\d{6}) enregistrée\.$/u;

let page: Page;
/** Référence du registre de la visite publique, relevée en DEMO-06, relue en DEMO-07. */
let referencePublique = '';

interface Fiche {
  readonly id: string;
  readonly prenom: string;
  readonly nom: string;
  readonly phoneE164: string;
}

interface Visite {
  readonly id: string;
  readonly reference: string;
  readonly visitorName: string;
}

/**
 * Lit l'espace PUBLIC, quoi que fasse le navigateur.
 *
 * Le contexte est reconstruit depuis `e2e/.auth/admin.json`, que la bascule ne
 * réécrit jamais : c'est le seul témoin dont l'espace ne dépend pas de l'état
 * de la page.
 */
async function lirePublic<T>(chemin: string, params: Record<string, string>): Promise<T> {
  const api = await adminApi();
  try {
    const reponse = await api.get(chemin, { params });
    expect(
      reponse.ok(),
      `${chemin} a répondu ${String(reponse.status())} : ${await reponse.text()}`,
    ).toBe(true);
    return (await reponse.json()) as T;
  } finally {
    await api.dispose();
  }
}

async function prospectsPublics(recherche: string): Promise<Fiche[]> {
  const trouves = await lirePublic<{ items: Fiche[] }>('/api/v1/prospects', {
    search: recherche,
    pageSize: '50',
  });
  return trouves.items;
}

async function visitesPubliques(recherche: string): Promise<Visite[]> {
  const trouves = await lirePublic<{ items: Visite[] }>('/api/v1/visites', {
    search: recherche,
    pageSize: '50',
  });
  return trouves.items;
}

/**
 * Le nombre de comptes actifs du schéma `public`, lu à l'instant de la
 * réinitialisation.
 *
 * La fabrique recopie `public.users` dans `demo` : le compteur « comptes » de
 * la carte suit donc ce que les autres suites ont créé et ne peut pas être figé
 * (E2E.md §8, Q-27).
 */
async function comptesActifsPublics(): Promise<string[]> {
  const comptes = await lirePublic<{ items: { email: string }[] }>(COMPTES_ACTIFS, {
    isActive: 'true',
    pageSize: '100',
  });
  return comptes.items.map((compte) => compte.email).sort();
}

async function entreprisesPubliques(): Promise<string[]> {
  const listes = await lirePublic<{ items: { code: string }[] }>(ENTREPRISES, {});
  return listes.items.map((entree) => entree.code).sort();
}

test.beforeAll(async ({ browser }) => {
  const api = await adminApi();
  try {
    for (const fiche of [VERS_PUBLIC, VERS_DEMO]) {
      const trouves = await api.get('/api/v1/prospects', {
        params: { search: fiche.phone, pageSize: '10' },
      });
      const corps = (await trouves.json()) as { items?: Fiche[] };
      for (const trouve of corps.items ?? []) {
        if (trouve.phoneE164 === fiche.phone) await api.delete(`/api/v1/prospects/${trouve.id}`);
      }
    }
  } finally {
    await api.dispose();
  }

  const contexte = await browser.newContext({
    storageState: 'e2e/.auth/admin.json',
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
  });
  page = await contexte.newPage();
});

/**
 * Retour au public INCONDITIONNEL, y compris après un rouge (§4.3.5). Sans
 * assertion : un `afterAll` ne juge rien (§5.1).
 */
test.afterAll(async () => {
  await page.request.post('/api/auth/workspace', { data: { workspace: 'public' } });
  await page.context().close();
});

function bandeau(surLaPage: Page): Locator {
  return surLaPage.getByRole('status').filter({ hasText: 'Espace démo' });
}

/**
 * Bascule par le MENU DE COMPTE, jamais par l'API : c'est le geste éprouvé.
 *
 * La réponse de `/api/auth/workspace` est attendue avant toute assertion
 * d'écran : elle porte les nouveaux cookies de session, et `router.refresh()`
 * ne part qu'après elle.
 */
async function basculer(surLaPage: Page, cible: 'demo' | 'public'): Promise<void> {
  const libelle = cible === 'demo' ? OUVRIR_DEMO : QUITTER_DEMO;
  await surLaPage.getByRole('button', { name: /^Compte de / }).click();
  const bascule = surLaPage.waitForResponse(
    (reponse) =>
      new URL(reponse.url()).pathname === '/api/auth/workspace' &&
      reponse.request().method() === 'POST',
  );
  await surLaPage.getByRole('menuitem', { name: libelle, exact: true }).click();
  const reponse = await bascule;
  expect(
    reponse.status(),
    `la bascule vers l’espace ${cible} a répondu ${String(reponse.status())}`,
  ).toBe(200);
}

/** Le menu se rouvre pour être lu : `router.refresh()` peut l'avoir refermé. */
async function entreeDuMenu(surLaPage: Page): Promise<Locator> {
  await surLaPage.keyboard.press('Escape');
  await surLaPage.getByRole('button', { name: /^Compte de / }).click();
  return surLaPage.getByRole('menuitem', { name: new RegExp('espace démo$', 'u') });
}

async function espaceDeLaSession(surLaPage: Page): Promise<string> {
  const reponse = await surLaPage.request.get('/api/v1/auth/me');
  expect(
    reponse.ok(),
    `/api/v1/auth/me a répondu ${String(reponse.status())} : ${await reponse.text()}`,
  ).toBe(true);
  const utilisateur = (await reponse.json()) as { workspace: string };
  return utilisateur.workspace;
}

/**
 * Ouvre le registre et attend SA réponse : le composant client demande les
 * visites, et un clic posé avant l'hydratation est perdu sans trace (§6.3).
 */
async function ouvrirRegistre(url: string): Promise<void> {
  const chargement = page.waitForResponse((reponse) => reponse.url().includes('/api/v1/visites?'));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await chargement;
}

async function choisir(formulaire: Locator, champ: string, option: string): Promise<void> {
  await formulaire.getByRole('combobox', { name: new RegExp(`^${champ}`, 'u') }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/** Enregistre une visite par le formulaire du registre et rend sa référence. */
async function enregistrerVisite(nom: string): Promise<string> {
  await ouvrirRegistre('/accueil');
  await page.getByRole('button', { name: 'Ajouter une visite' }).click();
  const dialogue = page.getByRole('dialog', { name: 'Enregistrer une visite' });
  const formulaire = dialogue.getByRole('form', { name: 'Enregistrer une visite' });

  await formulaire.getByRole('textbox', { name: /^PRENOM ET NOMS/u }).fill(nom);
  // `CPI` et `SUIVI DE DOSSIER` : entrées système, actives, recopiées dans le
  // schéma `demo` par la fabrique (E2E.md §8, Q-28).
  await choisir(formulaire, 'ENTREPRISE', 'CPI');
  await choisir(formulaire, 'OBJET VISITE', 'SUIVI DE DOSSIER');
  await formulaire.getByRole('button', { name: 'Enregistrer la visite' }).click();

  const toast = page.getByText(TOAST_VISITE);
  await expect(toast).toBeVisible();
  const texte = (await toast.innerText()).trim();
  const reference = TOAST_VISITE.exec(texte)?.[1] ?? '';
  expect(reference, `le registre devrait annoncer une référence : « ${texte} »`).toMatch(
    /^V-\d{4}-\d{6}$/u,
  );

  // Le dialogue reste ouvert pour la saisie en rafale.
  await page.keyboard.press('Escape');
  await expect(dialogue).toHaveCount(0);
  return reference;
}

async function enregistrerProspect(fiche: {
  prenom: string;
  nom: string;
  national: string;
}): Promise<void> {
  await page.goto('/grand-public/nouveau');
  await page.getByRole('textbox', { name: /^Prénom/u }).fill(fiche.prenom);
  await page.getByRole('textbox', { name: /^Nom/u }).fill(fiche.nom);
  await page.getByRole('textbox', { name: /^Téléphone/u }).fill(fiche.national);
  await page.getByRole('button', { name: 'Enregistrer et suivant' }).click();
  await expect(page.getByText(`${fiche.prenom} ${fiche.nom} enregistré.`)).toBeVisible();
}

/**
 * Le registre, période « Tout le registre », filtré sur un nom de visiteur.
 *
 * Le repli « Rechercher et filtrer » s'ouvre AVANT la bascule de période : son état de
 * départ se déduit du nombre de critères posés, et « Tout le registre » en est
 * un. Dans l'autre ordre, le clic sur le résumé refermerait un panneau déjà
 * déplié et le champ deviendrait introuvable.
 */
async function chercherAuRegistre(nom: string): Promise<Locator> {
  await ouvrirRegistre('/accueil');
  await page.getByRole('button', { name: 'Rechercher et filtrer' }).click();

  await page
    .getByRole('group', { name: 'Période' })
    .getByRole('button', { name: 'Tout le registre' })
    .click();
  await expect(page).toHaveURL(/[?&]periode=tout(&|$)/u);

  const champ = page.getByRole('textbox', { name: 'Recherche', exact: true });
  await champ.fill(nom);
  await expect(champ).toHaveValue(nom);

  return page.getByRole('table').getByRole('row').filter({ hasText: nom });
}

/** La liste Grand Public, filtrée sur un terme. */
async function chercherEnGrandPublic(terme: string): Promise<Locator> {
  await page.goto('/grand-public');
  await page.getByRole('textbox', { name: 'Rechercher' }).fill(terme);
  return page.getByRole('table').getByRole('row').filter({ hasText: terme });
}

function lignesDuTableau(surLaPage: Page, texte: string): Locator {
  // §1.13 : les listes sont rendues deux fois, cartes puis tableau. On borne.
  return surLaPage.getByRole('table').getByRole('row').filter({ hasText: texte });
}

/**
 * Les quatre compteurs de la carte « Espace démo » sont des couples
 * `<dt>`/`<dd>` : le nombre est le frère immédiat de son libellé, et rien
 * d'autre ne les relie.
 */
function compteurDemo(libelle: string): Locator {
  return page
    .locator('dt')
    .filter({ hasText: new RegExp(`^${libelle}$`, 'u') })
    .locator('xpath=following-sibling::dd');
}

async function reinitialiserLaDemo(): Promise<void> {
  await page.goto('/admin/parametres');
  await expect(page).toHaveTitle('Paramètres · CPI GO');
  await page.getByRole('button', { name: 'Réinitialiser l’espace démo' }).click();
  // Borne large et assumée : la fabrique vide le schéma, recopie dix-sept
  // tables et refait le jeu. `workspaces.spec.ts` lui accorde la même.
  await expect(page.getByText('Espace démo réinitialisé.')).toBeVisible({ timeout: 90_000 });
}

test('DEMO-01 · la bascule vers la démo pose le bandeau et retourne l’entrée du menu', async () => {
  await page.goto('/admin/parametres');
  await expect(page).toHaveTitle('Paramètres · CPI GO');
  await expect(
    bandeau(page),
    'le parcours doit partir de l’espace public, sinon la bascule ne prouve rien',
  ).toHaveCount(0);

  await basculer(page, 'demo');

  await expect(bandeau(page)).toBeVisible();
  await expect(bandeau(page)).toContainText(PHRASE_BANDEAU);
  await expect(await entreeDuMenu(page)).toHaveText(QUITTER_DEMO);
  await page.keyboard.press('Escape');
});

test('DEMO-02 · le retour au public retire le bandeau ET rend la session publique', async () => {
  await basculer(page, 'public');

  await expect(bandeau(page)).toHaveCount(0);
  await expect(await entreeDuMenu(page)).toHaveText(OUVRIR_DEMO);
  await page.keyboard.press('Escape');

  // L'écran ne montre pas l'espace de la SESSION : c'est lui qui décide de ce
  // que liront toutes les requêtes suivantes.
  expect(
    await espaceDeLaSession(page),
    'la sortie est visuelle mais la session est restée en démo',
  ).toBe('public');
});

test('DEMO-03 · la réinitialisation rend au jeu de démonstration ses effectifs exacts', async () => {
  // La réinitialisation vide un schéma et recopie dix-sept tables : le délai du
  // test est porté à sa mesure, faute de quoi il expirerait avant la réponse.
  test.setTimeout(180_000);

  // Le menu de compte est celui de la coque : la page y est ramenée avant la
  // bascule, pour que ce scénario reste jouable seul.
  await page.goto('/admin/parametres');
  await basculer(page, 'demo');
  const actifs = (await comptesActifsPublics()).length;

  await reinitialiserLaDemo();

  await expect(compteurDemo('représentants')).toHaveText('8');
  await expect(compteurDemo('prospects')).toHaveText('16');
  await expect(compteurDemo('dossiers bancaires')).toHaveText('3');
  await expect(
    compteurDemo('comptes'),
    'la fabrique recopie `public.users` : le compteur suit les comptes actifs publics',
  ).toHaveText(String(actifs));
});

test('DEMO-04 · les deux projets ne se mélangent pas dans le jeu de démonstration', async () => {
  await page.goto('/grand-public');
  await expect(page).toHaveTitle(/Prospects Grand Public/u);

  await expect(lignesDuTableau(page, 'Prospect Démo')).toHaveCount(8);
  for (let rang = 9; rang <= 16; rang += 1) {
    const nom = `Prospect Démo ${String(rang).padStart(2, '0')}`;
    await expect(
      lignesDuTableau(page, nom),
      `${nom} devrait figurer en Grand Public, avec le prénom « Grand Public »`,
    ).toContainText('Grand Public');
  }
  await expect(
    lignesDuTableau(page, 'Prospect Démo 01'),
    'la fiche CHUES 01 n’a rien à faire dans la liste Grand Public',
  ).toHaveCount(0);

  await page.goto('/chues/prospects');
  await expect(page).toHaveTitle('Prospects · CPI GO');

  await expect(lignesDuTableau(page, 'Prospect Démo')).toHaveCount(8);
  for (let rang = 1; rang <= 8; rang += 1) {
    const nom = `Prospect Démo 0${String(rang)}`;
    await expect(lignesDuTableau(page, nom), `${nom} devrait figurer en CHUES`).toHaveCount(1);
  }
  await expect(
    lignesDuTableau(page, 'Prospect Démo 09'),
    'la fiche Grand Public 09 n’a rien à faire dans la liste CHUES',
  ).toHaveCount(0);
});

test('DEMO-05 · ce qui est écrit en démo ne se voit nulle part en public', async () => {
  test.setTimeout(180_000);

  const reference = await enregistrerVisite(VISITE_DEMO);
  const enDemo = await chercherAuRegistre(VISITE_DEMO);
  await expect(enDemo).toHaveCount(1);
  await expect(enDemo.getByRole('cell', { name: reference, exact: true })).toHaveCount(1);

  await enregistrerProspect(VERS_PUBLIC);
  await expect(await chercherEnGrandPublic(VERS_PUBLIC.prenom)).toHaveCount(1);

  await basculer(page, 'public');
  expect(await espaceDeLaSession(page)).toBe('public');

  const enPublic = await chercherAuRegistre(VISITE_DEMO);
  await expect(enPublic).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Aucune visite pour cette recherche' }),
  ).toBeVisible();

  await page.goto('/grand-public');
  await page.getByRole('textbox', { name: 'Rechercher' }).fill(VERS_PUBLIC.prenom);
  await expect(page.getByText('Aucun prospect ne correspond à ces filtres.')).toBeVisible();

  // Et la même absence hors navigateur : l'API publique, interrogée depuis un
  // contexte qui n'a jamais quitté l'espace public.
  expect(
    (await visitesPubliques(VISITE_DEMO)).map((visite) => visite.reference),
    'la visite écrite en démo a fui dans le schéma public',
  ).toEqual([]);
  expect(
    (await prospectsPublics(VERS_PUBLIC.phone)).map((fiche) => fiche.phoneE164),
    'le prospect écrit en démo a fui dans le schéma public',
  ).toEqual([]);
});

test('DEMO-06 · ce qui est écrit en public ne se voit nulle part en démo', async () => {
  test.setTimeout(180_000);

  referencePublique = await enregistrerVisite(VISITE_PUBLIC);
  await enregistrerProspect(VERS_DEMO);

  // La donnée publique EXISTE, sinon l'absence constatée en démo ne vaudrait rien.
  expect((await visitesPubliques(VISITE_PUBLIC)).map((visite) => visite.reference)).toEqual([
    referencePublique,
  ]);
  expect((await prospectsPublics(VERS_DEMO.phone)).map((fiche) => fiche.phoneE164)).toEqual([
    VERS_DEMO.phone,
  ]);

  await basculer(page, 'demo');
  expect(await espaceDeLaSession(page)).toBe('demo');

  await expect(await chercherAuRegistre(VISITE_PUBLIC)).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Aucune visite pour cette recherche' }),
  ).toBeVisible();

  await page.goto('/grand-public');
  await page.getByRole('textbox', { name: 'Rechercher' }).fill(VERS_DEMO.prenom);
  await expect(
    page.getByText('Aucun prospect ne correspond à ces filtres.'),
    'des données réelles apparaissent dans un espace annoncé comme fictif',
  ).toBeVisible();
});

test('DEMO-07 · la réinitialisation de la démo n’atteint pas le schéma public', async () => {
  test.setTimeout(180_000);

  await basculer(page, 'public');

  const visitesAvant = await visitesPubliques(VISITE_PUBLIC);
  const prospectsAvant = await prospectsPublics(VERS_DEMO.phone);
  const comptesAvant = await comptesActifsPublics();
  const entreprisesAvant = await entreprisesPubliques();
  expect(visitesAvant.map((visite) => visite.reference)).toEqual([referencePublique]);
  expect(prospectsAvant).toHaveLength(1);
  expect(
    comptesAvant.length,
    'aucun compte actif en base : le témoin ne prouverait rien',
  ).toBeGreaterThan(0);
  expect(entreprisesAvant.length, 'aucune entreprise au registre : idem').toBeGreaterThan(0);

  await reinitialiserLaDemo();

  expect(
    (await visitesPubliques(VISITE_PUBLIC)).map((visite) => visite.reference),
    'la visite publique a disparu ou changé de référence pendant la réinitialisation',
  ).toEqual([referencePublique]);
  expect(
    (await prospectsPublics(VERS_DEMO.phone)).map((fiche) => fiche.id),
    'le prospect public a été emporté par la réinitialisation de la démo',
  ).toEqual(prospectsAvant.map((fiche) => fiche.id));
  expect(
    await comptesActifsPublics(),
    'des comptes publics ont disparu pendant la réinitialisation de la démo',
  ).toEqual(comptesAvant);
  expect(
    await entreprisesPubliques(),
    'la liste « Classeur d’origine » du registre public a été emportée',
  ).toEqual(entreprisesAvant);
});

test.describe('DEMO-08', () => {
  /**
   * Session BANQUE_FINANCE, dans SON propre contexte : la bascule d'espace est
   * un état de session, et celle de l'administrateur ne doit pas bouger ici.
   */
  let pageBanque: Page;

  const ROUTES_FERMEES = [
    { route: '/chues/prospects', famille: '/api/v1/prospects' },
    { route: '/chues/representants', famille: '/api/v1/representants' },
    { route: '/grand-public', famille: '/api/v1/prospects' },
  ] as const;

  test.beforeAll(async ({ browser }) => {
    const contexte = await browser.newContext({
      storageState: 'e2e/.auth/banque.json',
      baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
      locale: 'fr-FR',
      timezoneId: 'Africa/Dakar',
    });
    pageBanque = await contexte.newPage();
  });

  test.afterAll(async () => {
    await pageBanque.request.post('/api/auth/workspace', { data: { workspace: 'public' } });
    await pageBanque.context().close();
  });

  test('DEMO-08 · un agent bancaire ne gagne aucun droit en démo', async () => {
    test.setTimeout(120_000);

    await pageBanque.goto('/chues/banque');
    await expect(pageBanque).toHaveTitle('Tableau de bord bancaire · CPI GO');
    await basculer(pageBanque, 'demo');
    await expect(bandeau(pageBanque)).toBeVisible();

    // Les deux écrans du rôle rendent LEUR contenu, sur le jeu de démonstration.
    await pageBanque.goto('/chues/banque');
    await expect(pageBanque).toHaveTitle('Tableau de bord bancaire · CPI GO');
    await expect(pageBanque.getByText('Taux de rejet', { exact: true })).toBeVisible();
    await expect(pageBanque.getByRole('heading', { name: 'Accès refusé' })).toHaveCount(0);

    await pageBanque.goto('/chues/dossiers');
    await expect(pageBanque).toHaveTitle('Dossiers bancaires · CPI GO');
    for (const reference of ['DEMO-001', 'DEMO-002', 'DEMO-003']) {
      await expect(
        lignesDuTableau(pageBanque, reference),
        `${reference} devrait figurer dans les dossiers du jeu de démonstration`,
      ).toHaveCount(1);
    }

    // Trois routes de ROL-21, rejouées EN DÉMO : le refus tient, et rien n'est
    // chargé avant lui (§6.5).
    const chemins: string[] = [];
    pageBanque.on('response', (reponse) => {
      const chemin = new URL(reponse.url()).pathname;
      if (chemin.startsWith('/api/v1/') && reponse.status() < 400) chemins.push(chemin);
    });

    for (const { route, famille } of ROUTES_FERMEES) {
      chemins.length = 0;
      await pageBanque.goto(route);

      await expect(
        pageBanque.getByRole('heading', { name: 'Accès refusé', level: 2 }),
        `${route} devrait rester refusé à BANQUE_FINANCE en démo`,
      ).toBeVisible();
      await expect(
        pageBanque.getByRole('alert').filter({ hasText: 'Accès refusé' }),
        `${route} : le refus devrait nommer le rôle en cours`,
      ).toContainText('Banque & Finance');
      await expect(
        pageBanque.getByRole('link', { name: 'Retour à l’accueil', exact: true }),
      ).toHaveAttribute('href', '/espaces');
      expect(
        chemins.filter((chemin) => chemin.startsWith(famille)),
        `${route} a chargé des données métier malgré le refus, en démo`,
      ).toEqual([]);
    }
  });
});

test('DEMO-09 · l’export intégral de la base est retiré en démo', async () => {
  const TITRE = 'Export intégral de la base';

  // En public d'abord : sans cette contre-épreuve, l'absence constatée en démo
  // se confondrait avec un serveur où `DB_DUMP_ENABLED` n'est pas posée.
  const enPublic = page.waitForResponse((reponse) =>
    new URL(reponse.url()).pathname.startsWith('/api/v1/admin/database-dump'),
  );
  await page.goto('/admin/parametres');
  await enPublic;
  await expect(page.getByText(TITRE, { exact: true })).toBeVisible();

  await basculer(page, 'demo');

  // La section rend un squelette tant que la requête n'a pas répondu : sans
  // cette attente, le compte de zéro serait vrai avant même la décision.
  const enDemo = page.waitForResponse((reponse) =>
    new URL(reponse.url()).pathname.startsWith('/api/v1/admin/database-dump'),
  );
  await page.goto('/admin/parametres');
  await enDemo;
  await expect(bandeau(page)).toBeVisible();
  await expect(
    page.getByText(TITRE, { exact: true }),
    'le bandeau annonce des exports intégraux désactivés : la carte ne doit pas être proposée',
  ).toHaveCount(0);
});
