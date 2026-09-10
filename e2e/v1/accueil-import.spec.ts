import { createReadStream } from 'node:fs';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  expect,
  request,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';

import { buildXlsx } from './xlsx';

/**
 * Aller-retour Excel du registre : exporter, corriger, redéposer, appliquer.
 * ACC-XLS-01 à ACC-XLS-12 du plan `E2E.md` §7.3.5, session DIRECTION.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Ce que seul un vrai navigateur éprouve ici.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  1. l'export est un TÉLÉCHARGEMENT binaire ; un 502 relayé sous un nom en
 *     `.xlsx` ne se distingue d'un classeur que par sa signature ZIP ;
 *  2. le dépôt est un ENVOI MULTIPART qui traverse le relais `/api/v1/*`, donc
 *     le cookie `httpOnly` ;
 *  3. la simulation N'ÉCRIT RIEN : c'est la promesse centrale de l'écran, et
 *     elle ne se vérifie qu'en regardant le registre AVANT de confirmer ;
 *  4. l'export et le lecteur d'import doivent s'accorder au caractère près sur
 *     les dates, les heures et les libellés : un aller-retour sans modification
 *     qui produirait des différences ferait réécrire tout le registre.
 *
 * Les visites appliquées NE SE SUPPRIMENT PAS : tout ce que ce fichier écrit
 * porte `E2E-ACC-XLS-<RUN>`, horodaté au module, et chaque assertion de
 * comptage est filtrée sur ce préfixe (§5.1). Deux exécutions ne se voient
 * jamais.
 *
 * `POST /visites/import` est plafonné à CINQ dépôts par minute
 * (`visites-import.controller.ts` ligne 69). Ce fichier en fait six, mais
 * chaque analyse coûte au moins un intervalle de sondage de dix secondes
 * (`LIVE_INTERVAL_MS`) : deux dépôts ne peuvent pas se suivre à moins de douze
 * secondes, et six dépôts s'étalent donc au-delà de la fenêtre du plafond.
 * ACC-XLS-12, lui, est intercepté avant le réseau.
 *
 * L'ORDRE des scénarios n'est pas celui du plan : les deux qui échouent sur un
 * défaut connu du produit (ACC-XLS-08 puis ACC-XLS-04) sont rangés à la fin,
 * sans quoi le mode `serial` ferait sauter tout ce qui les suit.
 */

test.describe.configure({ mode: 'serial' });

const SESSION = 'v1/.auth/direction.json';
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4000';

test.use({ storageState: SESSION });

/** La visite appliquée ne se supprime pas : l'horodatage isole les exécutions. */
const RUN = String(Date.now()).slice(-8);
const PREFIXE = `E2E-ACC-XLS-${RUN}`;

const REFERENCE_INEXISTANTE = 'V-1999-000001';
const ENTREPRISE = 'CPI';
const DIRECTION = 'COMMERCIALE';
const DESTINATAIRE = 'MME. NDOYE (RESP. COMM.)';
const OBJET = 'SUIVI DE DOSSIER';
/** Valeur littérale des scénarios de l'espace Accueil : le registre n'impose aucune unicité. */
const TELEPHONE = '78 454 44 66';

const JOUR_ISO = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Dakar',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const [ANNEE, MOIS, JOUR] = JOUR_ISO.split('-') as [string, string, string];
const JOUR_FR = `${JOUR}/${MOIS}/${ANNEE}`;
/** Le nom accessible de la case du jour dans le calendrier : « 29 août 2026 ». */
const JOUR_CALENDRIER = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Africa/Dakar',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
}).format(new Date());

const NOM_CREATION = `${PREFIXE} Fatou Sarr`;
const NOM_TEMOIN = `${PREFIXE} Awa Ba`;
const NOM_REFUS = `${PREFIXE} Refus Registre`;
const NOM_SECONDE_CREATION = `${PREFIXE} Mamadou Diop`;
const NOTE_INITIALE = `${PREFIXE} note initiale`;
const NOTE_CORRIGEE = `${PREFIXE} note corrigée`;
const NOTE_DE_REVUE = `${PREFIXE} note de la revue`;

/** Le « N° » attribué par l'application à la visite créée, relevé À L'ÉCRAN. */
let referenceCreee = '';
let dossier = '';

const EN_TETES = [
  'N° REGISTRE',
  'DATE VISITE',
  'HEURE VISITE',
  'PRENOM ET NOMS',
  'TELEPHONES',
  'ENTREPRISE',
  'DIRECTION',
  'DESTINATAIRES',
  'OBJET VISITE',
  'COMMENTAIRES / NOTES',
  'SAISIE LE',
];

/**
 * La ligne 2 porte le rappel de l'export, et le lecteur la SAUTE
 * (`FIRST_DATA_ROW = 3`). La garder ici prouve qu'elle n'est pas comptée : les
 * données commencent donc à la ligne 3, numéro que la revue affiche.
 */
const RAPPEL = ['N° REGISTRE vide = nouvelle visite. Ne renommez ni ne déplacez les colonnes.'];

interface LigneRegistre {
  readonly numero?: string;
  readonly heure?: string;
  readonly nom: string;
  readonly telephone?: string;
  readonly entreprise?: string;
  readonly direction?: string;
  readonly destinataire?: string;
  readonly objet?: string;
  readonly commentaire?: string;
}

function ligne(valeurs: LigneRegistre): string[] {
  return [
    valeurs.numero ?? '',
    JOUR_FR,
    valeurs.heure ?? '',
    valeurs.nom,
    valeurs.telephone ?? '',
    valeurs.entreprise ?? ENTREPRISE,
    valeurs.direction ?? '',
    valeurs.destinataire ?? '',
    valeurs.objet ?? OBJET,
    valeurs.commentaire ?? '',
    '',
  ];
}

function classeur(lignes: readonly LigneRegistre[]): Buffer {
  return buildXlsx('Registre', [EN_TETES, RAPPEL, ...lignes.map(ligne)]);
}

/** Les quatre premiers octets d'un `.xlsx` : la signature ZIP « PK\x03\x04 ». */
async function signature(chemin: string): Promise<number[]> {
  const morceaux: Buffer[] = [];
  for await (const morceau of createReadStream(chemin, { start: 0, end: 3 })) {
    morceaux.push(morceau as Buffer);
  }
  return [...Buffer.concat(morceaux)];
}

async function directionApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: WEB, storageState: SESSION });
}

/**
 * Le travail d'import se sonde toutes les DIX secondes (`LIVE_INTERVAL_MS`),
 * et `expect.timeout` vaut dix secondes : sans borne explicite, l'attente et le
 * sondage se disputeraient la même seconde. La borne posée ici est celle du
 * PRODUIT, pas un délai d'attente déguisé — l'assertion porte sur le texte de
 * l'écran, comme dans `representants-import.spec.ts`.
 *
 * Un travail refusé par le serveur ne rend jamais cette phrase : l'échec porte
 * alors sur ce libellé, et la capture d'écran montre le motif du refus.
 */
const ANALYSE_TERMINEE = /^Analyse terminée, le \d{2} \S+ \d{4} à \d{2}:\d{2}\.$/u;
const ATTENTE_TRAVAIL = 30_000;

async function attendreAnalyse(page: Page): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: 'Analyse terminée' })).toHaveText(
    ANALYSE_TERMINEE,
    { timeout: ATTENTE_TRAVAIL },
  );
}

/**
 * Le chiffre d'un cadran de l'analyse.
 *
 * Les quatre cadrans forment une liste de définitions : `<dt>` porte
 * l'intitulé, `<dd>` la valeur. On les apparie par POSITION, seule relation que
 * la sémantique d'une `<dl>` garantisse.
 */
async function cadran(page: Page, libelle: string): Promise<number> {
  const intitules = await page.getByRole('term').allTextContents();
  const rang = intitules.findIndex((texte) => texte.trim() === libelle);
  expect(rang, `Le cadran « ${libelle} » ne figure pas dans l’analyse.`).toBeGreaterThanOrEqual(0);

  const valeur = await page.getByRole('definition').nth(rang).textContent();
  return Number((valeur ?? '').replace(/[^\d]/gu, ''));
}

async function deposer(page: Page, nom: string, lignes: readonly LigneRegistre[]): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles({
    name: nom,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: classeur(lignes),
  });
}

/**
 * La recherche du registre vit dans un dépliant fermé tant qu'aucun critère
 * n'est posé. Le champ se vise par son RÔLE : `getByLabel('Recherche')`
 * attraperait aussi la section « Rechercher dans le registre », qui porte le
 * même mot en nom accessible.
 */
async function chercherAuRegistre(page: Page, terme: string): Promise<void> {
  await page.goto('/accueil');
  await page.locator('summary').filter({ hasText: 'Rechercher' }).click();
  await page.getByRole('textbox', { name: 'Recherche', exact: true }).fill(terme);
}

function lignesDuRegistre(page: Page, nom: string): Locator {
  return page.getByRole('table').getByRole('row').filter({ hasText: nom });
}

test.beforeAll(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'e2e-acc-xls-'));

  const api = await directionApi();
  try {
    const reponse = await api.get('/api/v1/visites/referentiels');
    expect(
      reponse.ok(),
      `Les référentiels du registre ont répondu ${String(reponse.status())}.`,
    ).toBe(true);
    const referentiels = (await reponse.json()) as Record<string, { id: string; label: string }[]>;

    const identifiant = (famille: string, libelle: string): string => {
      const entree = (referentiels[famille] ?? []).find((item) => item.label === libelle);
      if (entree === undefined) {
        throw new Error(`« ${libelle} » manque à la liste ${famille} — la base est-elle amorcée ?`);
      }
      return entree.id;
    };

    // La visite témoin de ACC-XLS-04 : aucun écran du périmètre ne pose cette
    // précondition, l'écran d'import part d'un registre déjà tenu.
    const creation = await api.post('/api/v1/visites', {
      data: {
        date: JOUR_ISO,
        time: '09:15',
        visitorName: NOM_TEMOIN,
        phone: TELEPHONE,
        entrepriseId: identifiant('entreprises', ENTREPRISE),
        objetId: identifiant('objets', OBJET),
        directionId: identifiant('directions', DIRECTION),
        destinataireId: identifiant('destinataires', DESTINATAIRE),
        comment: `${PREFIXE} visite témoin`,
      },
    });
    expect(creation.status(), `La visite témoin n’a pas été créée : ${await creation.text()}`).toBe(
      201,
    );
  } finally {
    await api.dispose();
  }
});

test.afterAll(async () => {
  await rm(dossier, { recursive: true, force: true });
});

test('ACC-XLS-01 · l’écran présente ses quatre temps, et rien avant le dépôt', async ({ page }) => {
  await page.goto('/accueil/import');

  await expect(page).toHaveTitle('Import du registre des visites · CPI GO');
  await expect(page.getByText('1. Exporter le registre', { exact: true })).toBeVisible();
  await expect(page.getByText('2. Déposer le classeur corrigé', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Glissez le classeur ici, ou choisissez un fichier', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Format .xlsx, 25 Mo au maximum.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exporter le registre filtré' })).toBeVisible();

  // La promesse « rien n'est écrit tant que vous n'avez pas confirmé » commence
  // par ne rien montrer : pas de panneau d'analyse vide au chargement.
  await expect(page.getByText(/^3\. Analyse/u)).toHaveCount(0);
  await expect(page.getByText('4. Revue', { exact: true })).toHaveCount(0);
});

test('ACC-XLS-02 · l’export filtré produit un vrai classeur', async ({ page }) => {
  await page.goto('/accueil/import');

  // Le calendrier refermé RESTE dans le document : viser sa grille par son nom
  // accessible, sans quoi « Du » et « Au » offrent deux fois le même bouton.
  await page.getByRole('button', { name: 'Du', exact: true }).click();
  await page
    .getByRole('grid', { name: 'Du', exact: true })
    .getByRole('gridcell', { name: JOUR_CALENDRIER, exact: true })
    .click();
  await page.getByRole('button', { name: 'Au', exact: true }).click();
  await page
    .getByRole('grid', { name: 'Au', exact: true })
    .getByRole('gridcell', { name: JOUR_CALENDRIER, exact: true })
    .click();

  const requete = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith('/api/v1/export/visites.xlsx'),
  );
  const [telechargement, reponse] = await Promise.all([
    page.waitForEvent('download'),
    requete,
    page.getByRole('button', { name: 'Exporter le registre filtré' }).click(),
  ]);

  // Le filtre de l'écran est bien celui qui part au serveur.
  const parametres = new URL(reponse.url()).searchParams;
  expect(parametres.get('from')).toBe(JOUR_ISO);
  expect(parametres.get('to')).toBe(JOUR_ISO);

  expect(telechargement.suggestedFilename()).toMatch(
    /^cpi-registre-visites-\d{4}-\d{2}-\d{2}\.xlsx$/u,
  );
  await expect(page.getByText('Fichier généré.', { exact: true })).toBeVisible();

  const chemin = join(dossier, 'export-date.xlsx');
  await telechargement.saveAs(chemin);
  expect((await stat(chemin)).size).toBeGreaterThan(1_000);
  // Un VRAI classeur : un 502 relayé tel quel passerait toutes les assertions
  // précédentes sauf celle-ci.
  expect(await signature(chemin)).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

test('ACC-XLS-03 · un fichier trop lourd est refusé avant l’envoi', async ({ page }) => {
  const gros = join(dossier, 'gros.xlsx');
  await writeFile(gros, Buffer.alloc(26 * 1024 * 1024));

  const envois: string[] = [];
  page.on('request', (requete) => {
    if (
      requete.method() === 'POST' &&
      new URL(requete.url()).pathname === '/api/v1/visites/import'
    ) {
      envois.push(requete.url());
    }
  });

  await page.goto('/accueil/import');
  await page.locator('input[type="file"]').setInputFiles(gros);

  await expect(
    page.getByText('Fichier trop volumineux : 25 Mo au maximum.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/^3\. Analyse/u)).toHaveCount(0);
  // Le garde est CLIENT : 26 Mo ne partent pas sur une connexion de comptoir
  // pour se faire refuser en 413.
  expect(envois, 'Un dépôt de 26 Mo est parti malgré le garde client.').toEqual([]);
});

test('ACC-XLS-05 · une création se détecte, se revoit et s’applique', async ({ page, context }) => {
  await page.goto('/accueil/import');

  await deposer(page, `registre-${RUN}-creation.xlsx`, [
    { nom: NOM_CREATION, commentaire: NOTE_INITIALE },
  ]);
  await attendreAnalyse(page);

  expect(await cadran(page, 'À créer')).toBe(1);
  await expect(page.getByText('4. Revue', { exact: true })).toBeVisible();
  await expect(
    page.getByText('1 différence · 0 correction · 1 création', { exact: true }),
  ).toBeVisible();

  const revue = page.getByRole('listitem').filter({ hasText: `${NOM_CREATION}, ${JOUR_FR}` });
  await expect(revue).toHaveCount(1);
  await expect(revue.getByText('Création', { exact: true })).toBeVisible();
  await expect(revue.getByText('ligne 3', { exact: true })).toBeVisible();
  await expect(revue.getByRole('checkbox')).toBeChecked();
  await expect(page.getByRole('button', { name: 'Appliquer 1 création' })).toBeEnabled();

  // LA PROMESSE CENTRALE : la simulation n'a rien écrit. On le regarde dans le
  // registre, avant de confirmer, sur un autre onglet — quitter l'écran perdrait
  // le travail d'import en cours.
  const registre = await context.newPage();
  await chercherAuRegistre(registre, PREFIXE);
  // La visite témoin PROUVE que la recherche a bien porté : sans elle, un
  // « aucune ligne » serait vrai pour la mauvaise raison.
  await expect(lignesDuRegistre(registre, NOM_TEMOIN)).toHaveCount(1);
  await expect(lignesDuRegistre(registre, NOM_CREATION)).toHaveCount(0);
  // Un second onglet rend le premier CACHÉ, et TanStack suspend alors le
  // sondage du travail d'import : sans ce retour au premier plan, l'écran
  // n'apprendrait jamais que l'application est terminée.
  await page.bringToFront();

  await page.getByRole('button', { name: 'Appliquer 1 création' }).click();

  const dialogue = page.getByRole('dialog');
  await expect(dialogue.getByRole('heading', { name: 'Appliquer 1 création ?' })).toBeVisible();
  await expect(
    dialogue.getByText('Cette action écrit les visites cochées en base et ne s’annule pas.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialogue.getByText(`1 visite créée à partir de « registre-${RUN}-creation.xlsx ».`),
  ).toBeVisible();

  await dialogue.getByRole('button', { name: 'Appliquer 1 création' }).click();

  await expect(
    page.getByText('Application lancée. L’écran suit son avancement.', { exact: true }),
  ).toBeVisible();
  // Même borne que l'analyse : l'application est un second travail, sondé au
  // même rythme.
  await expect(page.getByText('1 visite créée, 0 corrigée.', { exact: true })).toBeVisible({
    timeout: ATTENTE_TRAVAIL,
  });

  // Le même onglet, rechargé : le critère de recherche vit dans l'URL, et
  // recharger coûte moins qu'une navigation froide sur un serveur de
  // développement chargé.
  await registre.bringToFront();
  await registre.reload();
  const creee = lignesDuRegistre(registre, NOM_CREATION);
  await expect(creee).toHaveCount(1);
  const numero = creee.getByRole('cell').first();
  await expect(numero).toHaveText(/^V-\d{4}-\d{6}$/u);
  referenceCreee = ((await numero.textContent()) ?? '').trim();
});

test('ACC-XLS-06 · une correction montre l’avant et l’après', async ({ page }) => {
  expect(referenceCreee, 'ACC-XLS-05 n’a pas relevé le numéro de la visite créée.').not.toBe('');

  await page.goto('/accueil/import');

  await deposer(page, `registre-${RUN}-correction.xlsx`, [
    { numero: referenceCreee, nom: NOM_CREATION, commentaire: NOTE_CORRIGEE },
  ]);
  await attendreAnalyse(page);

  expect(await cadran(page, 'À corriger')).toBe(1);
  expect(await cadran(page, 'À créer')).toBe(0);

  const revue = page.getByRole('listitem').filter({ hasText: `${NOM_CREATION}, ${JOUR_FR}` });
  await expect(revue).toHaveCount(1);
  await expect(revue.getByText('Correction', { exact: true })).toBeVisible();
  // L'avant et l'après, dans cet ordre, sur la colonne qui a réellement changé.
  await expect(
    revue.getByText(`COMMENTAIRES / NOTES : « ${NOTE_INITIALE} » → « ${NOTE_CORRIGEE} »`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Appliquer 1 correction' })).toBeEnabled();
});

test('ACC-XLS-07 · un numéro de registre inconnu est refusé, pas replié en création', async ({
  page,
}) => {
  await page.goto('/accueil/import');

  await deposer(page, `registre-${RUN}-inconnu.xlsx`, [
    { numero: REFERENCE_INEXISTANTE, nom: NOM_REFUS },
  ]);
  await attendreAnalyse(page);

  // Une coquille sur un numéro ne doit pas produire une visite fantôme.
  expect(await cadran(page, 'Refusées')).toBe(1);
  expect(await cadran(page, 'À créer')).toBe(0);

  await expect(page.getByRole('heading', { name: 'Lignes refusées' })).toBeVisible();
  const tableau = page.getByRole('table');
  await expect(tableau.getByRole('columnheader', { name: 'Ligne' })).toBeVisible();
  await expect(tableau.getByRole('columnheader', { name: 'Colonne' })).toBeVisible();
  await expect(tableau.getByRole('columnheader', { name: 'Motif' })).toBeVisible();

  const refus = tableau.getByRole('row').filter({ hasText: 'N° REGISTRE' });
  await expect(refus).toHaveCount(1);
  await expect(refus.getByRole('cell').first()).toHaveText('3');
  await expect(refus).toContainText(REFERENCE_INEXISTANTE);
  await expect(page.getByText('4. Revue', { exact: true })).toHaveCount(0);
});

test('ACC-XLS-12 · un dépôt refusé par le serveur le dit', async ({ page }) => {
  await page.goto('/accueil/import');

  await page.route('**/api/v1/visites/import', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: '{"message":"Feuille Registre introuvable."}',
    });
  });

  await deposer(page, `registre-${RUN}-refuse.xlsx`, [{ nom: `${PREFIXE} Dépôt refusé` }]);

  // Le message du SERVEUR, pas le repli « Le classeur n’a pas pu être déposé. » :
  // sans lui, la Direction ne sait pas quoi corriger dans son fichier.
  await expect(page.getByText('Feuille Registre introuvable.', { exact: true })).toBeVisible();
  await expect(page.getByText(/^3\. Analyse/u)).toHaveCount(0);

  await page.unroute('**/api/v1/visites/import');
});

test('ACC-XLS-11 · « Déposer un autre fichier » remet l’écran à zéro', async ({ page }) => {
  await page.goto('/accueil/import');

  // Une différence suffit : il faut que les cartes 3 ET 4 soient à l'écran pour
  // prouver qu'elles disparaissent toutes les deux.
  await deposer(page, `registre-${RUN}-reprise.xlsx`, [{ nom: `${PREFIXE} Reprise Ecran` }]);
  await attendreAnalyse(page);
  await expect(page.getByText('4. Revue', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Déposer un autre fichier' }).click();

  await expect(page.getByText(/^3\. Analyse/u)).toHaveCount(0);
  await expect(page.getByText('4. Revue', { exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toBeFocused();
  await expect(page.getByText('1. Exporter le registre', { exact: true })).toBeVisible();
  await expect(page.getByText('2. Déposer le classeur corrigé', { exact: true })).toBeVisible();
});

/**
 * AVANT-DERNIER, et c'est délibéré.
 *
 * Ce scénario échoue aujourd'hui sur un défaut du produit :
 * `PATCH /api/v1/visites/import/{id}/revue` répond 400 « each value in ids must
 * be a UUID ». `SetVisiteImportChangeSelectionDto`
 * (`apps/api/src/modules/imports/visites-registre.revue.service.ts` ligne 86)
 * exige `@IsUUID('4')`, alors que les lignes de revue sont créées avec
 * `uuidv7()` (`visites-registre.adapter.ts`). Cocher, décocher, « Tout
 * décocher » : aucun de ces gestes n'aboutit, et l'écran affiche le nouveau
 * décompte de façon optimiste avant de revenir en arrière.
 *
 * Le fichier étant `serial`, un rouge coupe tout ce qui suit : les scénarios
 * connus rouges sont donc rangés à la fin.
 */
test('ACC-XLS-08 · décocher une ligne change le libellé du bouton', async ({ page }) => {
  expect(referenceCreee, 'ACC-XLS-05 n’a pas relevé le numéro de la visite créée.').not.toBe('');

  await page.goto('/accueil/import');

  await deposer(page, `registre-${RUN}-revue.xlsx`, [
    { numero: referenceCreee, nom: NOM_CREATION, commentaire: NOTE_DE_REVUE },
    { nom: NOM_SECONDE_CREATION },
  ]);
  await attendreAnalyse(page);

  expect(await cadran(page, 'À corriger')).toBe(1);
  expect(await cadran(page, 'À créer')).toBe(1);
  await expect(
    page.getByRole('button', { name: 'Appliquer 1 correction et 1 création' }),
  ).toBeEnabled();

  // Le bouton doit annoncer EXACTEMENT ce qui sera écrit : l'action est
  // irréversible.
  await page
    .getByRole('listitem')
    .filter({ hasText: NOM_SECONDE_CREATION })
    .getByRole('checkbox')
    .uncheck();
  await expect(page.getByRole('button', { name: 'Appliquer 1 correction' })).toBeEnabled();

  await page.getByRole('button', { name: 'Tout décocher' }).click();
  await expect(page.getByRole('button', { name: 'Rien à appliquer' })).toBeDisabled();
});

/**
 * EN DERNIER, et c'est délibéré (voir ACC-XLS-08).
 *
 * Ce scénario échoue aujourd'hui sur un défaut du produit : l'export téléchargé,
 * redéposé sans la moindre modification, est refusé une fois sur deux avec
 * « Aucun onglet de ce classeur ne porte de données à importer. Onglets
 * trouvés : Sheet1. » Le classeur écrit par `WorkbookWriter` range
 * `xl/worksheets/sheet1.xml` AVANT `xl/workbook.xml`, et le lecteur en flux
 * d'ExcelJS retombe alors sur le nom par défaut « Sheet1 », que
 * `VISITES_REGISTRE_LAYOUT.sheetPattern` (`/^Registre/i`) rejette.
 *
 * Le fichier étant `serial`, un rouge ici couperait tout ce qui suit : placé en
 * dernier, il laisse les huit autres scénarios rendre leur verdict.
 */
test('ACC-XLS-04 · un classeur identique au registre ne propose rien à appliquer', async ({
  page,
}) => {
  await page.goto('/accueil/import');
  // Filtré sur la SEULE visite témoin : le compte « Inchangées » ne dépend
  // d'aucun autre scénario du fichier.
  await page.getByRole('textbox', { name: 'Recherche', exact: true }).fill(NOM_TEMOIN);

  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter le registre filtré' }).click(),
  ]);
  const chemin = join(dossier, 'export-temoin.xlsx');
  await telechargement.saveAs(chemin);

  await page.locator('input[type="file"]').setInputFiles(chemin);

  await expect(page.getByText(/^3\. Analyse · déposé le /u)).toBeVisible();
  await expect(page.getByText('Simulation', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Lecture du fichier…' })).toBeVisible();

  await attendreAnalyse(page);

  // L'aller-retour ne doit rien inventer : la seule ligne du classeur est celle
  // du registre, à l'octet près, date, heure et téléphone compris.
  expect(await cadran(page, 'À créer')).toBe(0);
  expect(await cadran(page, 'À corriger')).toBe(0);
  expect(await cadran(page, 'Inchangées')).toBe(1);
  expect(await cadran(page, 'Refusées')).toBe(0);

  await expect(
    page.getByText('Votre classeur est identique au registre. Rien à appliquer.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('4. Revue', { exact: true })).toHaveCount(0);
});
