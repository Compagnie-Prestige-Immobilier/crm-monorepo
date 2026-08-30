import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test';

import { adminApi } from './fixtures';

/**
 * Dossiers bancaires, sous la session de l'agent BANQUE_FINANCE.
 *
 * CHU-DOS-02 à 06, CHU-DOSN-01 à 05, CHU-DOSD-01 à 07, CHU-DOSX-01, CHU-DOSX-02.
 * Les points déjà tenus par `workspaces.spec.ts` (cycle jusqu'à l'encaissement
 * sous session ADMIN, rejet motivé, motif « Autre », vues rapides sans
 * rechargement) ne sont pas réécrits ici.
 */

test.use({ storageState: 'e2e/.auth/banque.json' });
test.describe.configure({ mode: 'serial' });

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

/** Un dossier bancaire ne se supprime pas : la référence porte l'horodatage. */
const RUN = String(Date.now()).slice(-8);
const reference = (suffixe: string): string => `E2E-CHUES-DOS-${RUN}-${suffixe}`;

/**
 * Les onze dossiers de pagination portent au contraire un suffixe STABLE.
 *
 * Aucune route ne supprime un dossier : un horodatage en ajouterait onze à
 * chaque relance, et « exactement onze » cesserait d'être vrai. Le 409 de la
 * référence dupliquée absorbe les exécutions suivantes.
 */
const PAGINATION_PREFIXE = 'E2E-CHUES-DOS-PAGINATION';
const PAGINATION_TOTAL = 11;

/** Plage réservée à ce fichier, sans recouvrement avec le §5.2 d'`E2E.md`. */
const CLIENT_ELIGIBLE = {
  phone: '+221781005101',
  phoneAffiche: '+221 78 100 51 01',
  nom: 'E2edosEligible',
  prenom: 'Client',
};
const CLIENT_EN_ATTENTE = {
  phone: '+221781005102',
  phoneAffiche: '+221 78 100 51 02',
  nom: 'E2edosAttente',
  prenom: 'Client',
};

/** Identifiants posés par la préparation, relus par les parcours. */
let urlDossierEncaisse = '';

async function lire<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(
    response.ok(),
    `${response.url()} a répondu ${String(response.status())} : ${await response.text()}`,
  ).toBe(true);
  return (await response.json()) as T;
}

interface ProspectLu {
  id: string;
  phoneE164: string;
  phase2Status: string;
}

async function chercherProspect(api: APIRequestContext, phone: string): Promise<ProspectLu | null> {
  const page = await lire<{ items: ProspectLu[] }>(
    await api.get('/api/v1/prospects', { params: { search: phone, pageSize: '5' } }),
  );
  return page.items.find((row) => row.phoneE164 === phone) ?? null;
}

/**
 * Le seul chemin qui pose « méthode obtenue » est une tentative d'appel : une
 * contrainte lie le statut à la méthode d'enrôlement, et `PATCH /prospects` ne
 * l'accepte pas. Même canal que `ensureBankEligibleClient` de `fixtures.ts`.
 */
async function poserMethodeObtenue(api: APIRequestContext, prospectId: string): Promise<void> {
  const at = new Date().toISOString();
  const attemptId = crypto.randomUUID();
  const response = await api.post('/api/v1/sync/push', {
    headers: { 'Idempotency-Key': attemptId },
    data: {
      clientBatchId: attemptId,
      payloadVersion: 1,
      operations: [
        {
          opId: attemptId,
          seq: 0,
          entity: 'call_attempt',
          op: 'create',
          entityId: attemptId,
          clientUpdatedAt: at,
          data: {
            prospectId,
            outcome: 'METHOD_OBTAINED',
            method: 'PLATFORM',
            clientCreatedAt: at,
          },
        },
      ],
    },
  });
  await lire<unknown>(response);
}

test.beforeAll(async () => {
  test.setTimeout(180_000);

  const api = await adminApi();
  try {
    const banques = await lire<{ id: string; shortName: string }[]>(
      await api.get('/api/v1/referentiels/banques', { params: { activeOnly: 'false' } }),
    );
    const syndicats = await lire<{ id: string; sigle: string }[]>(
      await api.get('/api/v1/referentiels/syndicats', { params: { activeOnly: 'false' } }),
    );
    const banque = banques.find((row) => row.shortName === 'CBAO');
    const syndicat = syndicats.find((row) => row.sigle === 'CHUES');
    expect(banque, 'Banque CBAO absente du référentiel — la base est-elle amorcée ?').toBeDefined();
    expect(
      syndicat,
      'Syndicat CHUES absent du référentiel — la base est-elle amorcée ?',
    ).toBeDefined();
    if (banque === undefined || syndicat === undefined) return;

    const liens = { banqueId: banque.id, syndicatId: syndicat.id };

    // ─── Le client éligible, propre à ce fichier ────────────────────────────
    // Jamais `+221781001000` : ce client appartient à `fixtures.ts` et au
    // parcours de `workspaces.spec.ts`, qui le mène jusqu'à l'encaissement.
    let eligible = await chercherProspect(api, CLIENT_ELIGIBLE.phone);
    if (eligible === null) {
      const cree = await api.post('/api/v1/prospects', {
        data: {
          nom: CLIENT_ELIGIBLE.nom,
          prenom: CLIENT_ELIGIBLE.prenom,
          phone: CLIENT_ELIGIBLE.phone,
          ...liens,
        },
      });
      await lire<{ id: string }>(cree);
      eligible = await chercherProspect(api, CLIENT_ELIGIBLE.phone);
    }
    expect(eligible, `Prospect ${CLIENT_ELIGIBLE.phone} introuvable après création`).not.toBeNull();
    if (eligible === null) return;
    if (eligible.phase2Status !== 'METHOD_OBTAINED') {
      await poserMethodeObtenue(api, eligible.id);
    }

    // ─── Le client NON éligible, qui doit rester en attente ─────────────────
    const attente = await chercherProspect(api, CLIENT_EN_ATTENTE.phone);
    if (attente !== null && attente.phase2Status !== 'PENDING') {
      await api.delete(`/api/v1/prospects/${attente.id}`);
    }
    if (attente === null || attente.phase2Status !== 'PENDING') {
      await lire<{ id: string }>(
        await api.post('/api/v1/prospects', {
          data: {
            nom: CLIENT_EN_ATTENTE.nom,
            prenom: CLIENT_EN_ATTENTE.prenom,
            phone: CLIENT_EN_ATTENTE.phone,
            ...liens,
          },
        }),
      );
    }

    // ─── Onze dossiers, la seule volumétrie qui rend deux pages à 10 lignes ──
    const banqueApi = await request.newContext({
      baseURL: WEB_URL,
      storageState: 'e2e/.auth/banque.json',
    });
    try {
      const deja = await lire<{ meta: { total: number } }>(
        await banqueApi.get('/api/v1/bank-cases', {
          params: { search: PAGINATION_PREFIXE, pageSize: '1' },
        }),
      );
      if (deja.meta.total < PAGINATION_TOTAL) {
        for (let index = 1; index <= PAGINATION_TOTAL; index += 1) {
          const cree = await banqueApi.post('/api/v1/bank-cases', {
            data: {
              prospectId: eligible.id,
              reference: `${PAGINATION_PREFIXE}-${String(index).padStart(2, '0')}`,
            },
          });
          // 409 : la référence existe déjà, donc la volumétrie est là.
          if (cree.status() === 409) continue;
          await lire<{ id: string }>(cree);
        }
      }
    } finally {
      await banqueApi.dispose();
    }
  } finally {
    await api.dispose();
  }
});

/** Les quatre premiers octets d'un `.xlsx` : la signature ZIP « PK\x03\x04 ». */
async function signature(chemin: string, longueur = 4): Promise<number[]> {
  const morceaux: Buffer[] = [];
  for await (const morceau of createReadStream(chemin, { start: 0, end: longueur - 1 })) {
    morceaux.push(morceau as Buffer);
  }
  return [...Buffer.concat(morceaux)];
}

/** Ouvre un dossier sur le client éligible de ce fichier, par les gestes. */
async function ouvrirDossier(page: Page, ref: string): Promise<void> {
  await page.goto('/chues/dossiers/nouveau');
  await page.getByLabel('Rechercher un client').fill(CLIENT_ELIGIBLE.phone);
  const resultat = page.getByRole('button', { name: CLIENT_ELIGIBLE.phoneAffiche });
  await expect(resultat).toBeVisible({ timeout: 30_000 });
  await resultat.click();

  await page.getByLabel('Référence bancaire').fill(ref);
  await page.getByRole('button', { name: 'Ouvrir le dossier' }).click();
  await page.waitForURL(/\/chues\/dossiers\/[0-9a-f-]{36}$/, { timeout: 30_000 });
}

/** Attend qu'un geste du détail soit rendu : la vue s'ouvre sur un squelette. */
async function attendreGeste(page: Page, nom: string | RegExp): Promise<void> {
  await expect(page.getByRole('button', { name: nom })).toBeVisible({ timeout: 30_000 });
}

/** Fait avancer le dossier ouvert d'une étape, par les gestes. */
async function avancerDUneEtape(page: Page): Promise<void> {
  await attendreGeste(page, /^Passer à/);
  await page.getByRole('button', { name: /^Passer à/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Ouverture d'un dossier
// ─────────────────────────────────────────────────────────────────────────────

test('CHU-DOSN-01 · seules les fiches « méthode obtenue » sont proposées', async ({ page }) => {
  await page.goto('/chues/dossiers/nouveau');
  await page.getByLabel('Rechercher un client').fill(CLIENT_EN_ATTENTE.phone);

  await expect(page.getByText('Aucun client ne correspond.')).toBeVisible({ timeout: 30_000 });
  // Le filtre de statut sauté ne se découvrirait qu'à l'encaissement : la fiche
  // EN ATTENTE ne doit apparaître dans AUCUN bouton de résultat.
  await expect(
    page.getByRole('button', { name: CLIENT_EN_ATTENTE.phoneAffiche }),
  ).toHaveCount(0);
});

test('CHU-DOSN-02 · l’ouverture exige une référence bancaire', async ({ page }) => {
  await page.goto('/chues/dossiers/nouveau');
  await page.getByLabel('Rechercher un client').fill(CLIENT_ELIGIBLE.phone);
  await page.getByRole('button', { name: CLIENT_ELIGIBLE.phoneAffiche }).click();
  await expect(page.getByText('Nom et téléphone sont copiés sur le dossier.')).toBeVisible();

  const reference_ = page.getByLabel('Référence bancaire');
  await expect(reference_).toHaveValue('');
  // La contrainte est NOMMÉE sous le champ, et l'envoi reste verrouillé.
  await expect(page.getByText('Deux caractères au minimum. Référence unique.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ouvrir le dossier' })).toBeDisabled();

  // Rien n'est parti : l'agent est toujours sur le formulaire.
  await expect(page).toHaveURL(/\/chues\/dossiers\/nouveau$/);
});

test('CHU-DOSN-03 · la recherche par nom et par numéro donne le même client', async ({ page }) => {
  await page.goto('/chues/dossiers/nouveau');

  const champ = page.getByLabel('Rechercher un client');
  await champ.fill(CLIENT_ELIGIBLE.phone);
  const parNumero = page.getByRole('button', { name: CLIENT_ELIGIBLE.phoneAffiche });
  await expect(parNumero).toBeVisible({ timeout: 30_000 });
  const texteParNumero = (await parNumero.textContent())?.trim() ?? '';

  await champ.fill(CLIENT_ELIGIBLE.nom);
  const parNom = page.getByRole('button', { name: CLIENT_ELIGIBLE.phoneAffiche });
  await expect(parNom).toBeVisible({ timeout: 30_000 });
  const texteParNom = (await parNom.textContent())?.trim() ?? '';

  // La répartition nom/téléphone se fait sur la proportion de chiffres du
  // terme : les deux chemins doivent mener à la MÊME fiche.
  expect(texteParNom).toBe(texteParNumero);
  expect(texteParNom).toContain(`${CLIENT_ELIGIBLE.prenom} ${CLIENT_ELIGIBLE.nom}`);
});

test('CHU-DOSN-04 · le contrôle de doublon part au flou, pas à la frappe', async ({ page }) => {
  await page.goto('/chues/dossiers/nouveau');
  await page.getByLabel('Rechercher un client').fill(CLIENT_ELIGIBLE.phone);
  await page.getByRole('button', { name: CLIENT_ELIGIBLE.phoneAffiche }).click();

  // La liste des dossiers est le point d'appel du contrôle de doublon ; la
  // recherche de prospect passe, elle, par `/prospect-search`.
  const appelsListe: string[] = [];
  page.on('request', (requete) => {
    const url = new URL(requete.url());
    if (url.pathname === '/api/v1/bank-cases') appelsListe.push(url.search);
  });

  const champ = page.getByLabel('Référence bancaire');
  const existante = `${PAGINATION_PREFIXE}-01`;
  await champ.pressSequentially(existante, { delay: 30 });
  await expect(champ).toBeFocused();

  // Tant que le champ garde le focus : aucune alerte, et aucune requête.
  await expect(page.getByRole('alert').filter({ hasText: 'existe déjà' })).toHaveCount(0);
  expect(
    appelsListe,
    `Le contrôle de doublon est parti à la frappe : ${String(appelsListe.length)} requêtes`,
  ).toHaveLength(0);

  await champ.blur();
  const alerte = page.getByRole('alert').filter({ hasText: 'existe déjà' });
  await expect(alerte).toBeVisible({ timeout: 30_000 });
  await expect(alerte).toContainText(`La référence « ${existante} » existe déjà.`);
  await expect(alerte.getByRole('link', { name: 'Ouvrir ce dossier' })).toBeVisible();
});

test('CHU-DOSN-05 · un caractère spécial dans la référence n’est jamais ignoré', async ({
  page,
}) => {
  const speciale = `E2E-CHUES-DOS-${RUN}/2026-#1`;
  await ouvrirDossier(page, speciale);

  // Rendue à l'identique : une référence tronquée en silence ne se retrouve
  // plus côté banque.
  await expect(page.getByText(speciale, { exact: true })).toBeVisible({ timeout: 30_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// Détail d'un dossier
// ─────────────────────────────────────────────────────────────────────────────

test('CHU-DOSD-01 · un montant à zéro est refusé', async ({ page }) => {
  await ouvrirDossier(page, reference('ENC'));
  urlDossierEncaisse = page.url();

  await avancerDUneEtape(page);

  await attendreGeste(page, 'Déclarer l’encaissement');
  await page.getByRole('button', { name: 'Déclarer l’encaissement' }).click();
  const dialogue = page.getByRole('dialog');
  const confirmer = dialogue.getByRole('button', { name: 'Confirmer l’encaissement' });

  await dialogue.getByLabel('Montant encaissé').fill('0');
  await expect(dialogue.getByLabel('Montant encaissé')).toHaveValue('0');
  await expect(confirmer).toBeDisabled();

  await dialogue.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('CHU-DOSD-02 · un montant non numérique ou négatif ne peut pas être encaissé', async ({
  page,
}) => {
  await page.goto(urlDossierEncaisse);
  await attendreGeste(page, 'Déclarer l’encaissement');
  await page.getByRole('button', { name: 'Déclarer l’encaissement' }).click();
  const dialogue = page.getByRole('dialog');
  const montant = dialogue.getByLabel('Montant encaissé');
  const confirmer = dialogue.getByRole('button', { name: 'Confirmer l’encaissement' });

  await montant.fill('abc');
  await expect(montant).toHaveValue('');
  await expect(confirmer).toBeDisabled();

  // Le signe est retiré à la saisie : le champ ne PEUT pas porter de négatif, et
  // l'aperçu annonce le montant positif qui partira réellement.
  await montant.fill('-5000');
  await expect(montant).toHaveValue('5000');
  await expect(dialogue.getByRole('status')).toHaveText(/^5\s000\sFCFA$/u);

  await dialogue.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('CHU-DOSD-03 · un très gros montant reste lisible', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(urlDossierEncaisse);
  await attendreGeste(page, 'Déclarer l’encaissement');
  await page.getByRole('button', { name: 'Déclarer l’encaissement' }).click();

  const dialogue = page.getByRole('dialog');
  await dialogue.getByLabel('Montant encaissé').fill('999999999999');

  const apercu = dialogue.getByRole('status');
  // Le regroupement des milliers est la raison d'être de cet aperçu :
  // « 12000000 » et « 1200000 » se confondent sans lui.
  await expect(apercu).toHaveText(/^999\s999\s999\s999\sFCFA$/u);

  const boiteDialogue = await dialogue.boundingBox();
  const boiteApercu = await apercu.boundingBox();
  expect(boiteDialogue, 'La boîte de dialogue n’a pas de boîte englobante').not.toBeNull();
  expect(boiteApercu, 'L’aperçu n’a pas de boîte englobante').not.toBeNull();
  if (boiteDialogue === null || boiteApercu === null) return;
  expect(boiteApercu.x).toBeGreaterThanOrEqual(boiteDialogue.x - 0.5);
  expect(boiteApercu.x + boiteApercu.width).toBeLessThanOrEqual(
    boiteDialogue.x + boiteDialogue.width + 0.5,
  );

  await dialogue.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 720 });
});

test('CHU-DOSD-04 · un dossier encaissé ne propose plus aucun geste', async ({ page }) => {
  await page.goto(urlDossierEncaisse);
  await attendreGeste(page, 'Déclarer l’encaissement');
  await page.getByRole('button', { name: 'Déclarer l’encaissement' }).click();

  const dialogue = page.getByRole('dialog');
  await dialogue.getByLabel('Montant encaissé').fill('12400000');
  await dialogue.getByRole('button', { name: 'Confirmer l’encaissement' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });

  await expect(page.getByText(/Étape terminale/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rejeter le dossier' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Déclarer l’encaissement' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Passer à/ })).toHaveCount(0);
});

test('CHU-DOSD-05 · un rechargement rend le même état', async ({ page }) => {
  await page.goto(urlDossierEncaisse);

  // Ouverture, passage en traitement, encaissement : trois entrées, ni plus ni
  // moins, avant comme après le rechargement.
  const historique = page.getByRole('list').filter({ hasText: 'Ouverture :' }).getByRole('listitem');
  await expect(page.getByText('Encaissé', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(historique).toHaveCount(3);

  await page.reload();

  // L'état vit en base, pas en mémoire : un rechargement qui rendrait le dossier
  // à l'étape précédente le prouverait.
  await expect(page.getByText('Encaissé', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Étape terminale/)).toBeVisible();
  await expect(historique).toHaveCount(3);
  await expect(page.getByRole('listitem').filter({ hasText: 'Montant :' })).toHaveCount(1);
});

test('CHU-DOSD-06 · un identifiant inconnu ne rend pas une page blanche', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => {
    erreurs.push(erreur.message);
  });

  await page.goto('/chues/dossiers/00000000-0000-7000-8000-000000000000');

  await expect(
    page.getByRole('heading', { name: 'Introuvable', level: 2 }).or(
      page.getByRole('heading', { name: 'Page introuvable', level: 1 }),
    ),
  ).toBeVisible({ timeout: 30_000 });
  expect(erreurs, `Erreurs non rattrapées : ${erreurs.join(' | ')}`).toHaveLength(0);
});

test('CHU-DOSD-07 · une transition concurrente est refusée proprement', async ({ page }) => {
  await ouvrirDossier(page, reference('CNC'));
  const url = page.url();

  // Deux onglets du MÊME contexte : la session est unique, seule la révision du
  // dossier diffère entre les deux écrans.
  const ongletB = await page.context().newPage();
  try {
    await ongletB.goto(url);
    await expect(ongletB.getByRole('button', { name: /^Passer à/ })).toBeVisible({
      timeout: 30_000,
    });

    await avancerDUneEtape(page);
    await expect(page.getByText('En traitement banque', { exact: true })).toBeVisible();

    // L'onglet B porte encore l'ancienne révision : sa transition doit être
    // refusée, pas empilée sur celle de A.
    await ongletB.getByRole('button', { name: /^Passer à/ }).click();
    await ongletB.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();

    // Le contrôle d'atteignabilité passe AVANT le jeton de révision : c'est lui
    // qui nomme le refus quand les deux onglets visent la même étape (§8, Q-21).
    await expect(ongletB.getByText('Le dossier est déjà sur cette étape.')).toBeVisible({
      timeout: 30_000,
    });

    await ongletB.reload();
    // Un seul cran franchi, et une seule transition en plus de l'ouverture.
    await expect(ongletB.getByText('En traitement banque', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      ongletB.getByRole('list').filter({ hasText: 'Ouverture :' }).getByRole('listitem'),
    ).toHaveCount(2);
  } finally {
    await ongletB.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Liste
// ─────────────────────────────────────────────────────────────────────────────

test('CHU-DOS-02 · un agent bancaire voit la liste', async ({ page }) => {
  await page.goto('/chues/dossiers');

  await expect(page).toHaveTitle('Dossiers bancaires · CPI GO', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Dossiers bancaires', level: 1 })).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Dossiers affichés' }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toHaveCount(0);
});

test('CHU-DOS-03 · les deux états vides sont distincts', async ({ page }) => {
  await page.goto('/chues/dossiers');
  await page.getByLabel('Recherche').fill(`${PAGINATION_PREFIXE}-SANS-RESULTAT`);

  await expect(
    page.getByRole('heading', { name: 'Aucun dossier ne correspond à ces filtres', level: 2 }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Élargissez la période ou retirez un critère.')).toBeVisible();
  // « Aucun dossier bancaire » est réservé à la liste TOTALEMENT vide : les
  // confondre ferait croire la base vide à l'agent dont le filtre est trop
  // étroit.
  await expect(page.getByRole('heading', { name: 'Aucun dossier bancaire' })).toHaveCount(0);
});

test('CHU-DOS-04 · les vues rapides vivent dans l’URL et survivent au rechargement', async ({
  page,
}) => {
  // Filtré sur les seules données de ce fichier : la base est partagée et
  // d'autres parcours encaissent en même temps.
  await page.goto(`/chues/dossiers?search=${encodeURIComponent(`E2E-CHUES-DOS-${RUN}-`)}`);
  const decompte = page.getByRole('status').filter({ hasText: 'Dossiers affichés' });
  await expect(decompte).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Encaissés', exact: true }).click();
  await expect(page).toHaveURL(/stageType=CASHED/);
  await expect(decompte).toContainText('sur 1');
  const avant = (await decompte.textContent())?.trim() ?? '';

  await page.reload();

  // L'URL EST l'état : un lien partagé doit rouvrir exactement la même liste.
  await expect(page).toHaveURL(/stageType=CASHED/);
  await expect(page).toHaveURL(new RegExp(`search=${encodeURIComponent(`E2E-CHUES-DOS-${RUN}-`)}`));
  await expect(page.getByRole('status').filter({ hasText: 'Dossiers affichés' })).toHaveText(
    avant,
    { timeout: 30_000 },
  );
});

test('CHU-DOS-05 · la pagination', async ({ page }) => {
  await page.goto(`/chues/dossiers?search=${PAGINATION_PREFIXE}&pageSize=10`);

  const decompte = page.getByRole('status').filter({ hasText: 'Dossiers affichés' });
  await expect(decompte).toContainText(/1–10 sur 11$/u, { timeout: 30_000 });

  const precedente = page.getByRole('button', { name: 'Page précédente' });
  const suivante = page.getByRole('button', { name: 'Page suivante' });
  // La butée basse est GARDÉE : un clic hors plage partirait en requête.
  await expect(precedente).toBeDisabled();

  await suivante.click();
  await expect(decompte).toContainText(/11–11 sur 11$/u);
  await expect(suivante).toBeDisabled();
  await expect(precedente).toBeEnabled();

  await precedente.click();
  await expect(decompte).toContainText(/1–10 sur 11$/u);
  await expect(precedente).toBeDisabled();
});

test('CHU-DOS-06 · la liste tient sur 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  // Trié par référence : le premier dossier de la liste est alors connu, et
  // l'assertion ne dépend pas de l'ordre des dernières mises à jour.
  await page.goto(
    `/chues/dossiers?search=${PAGINATION_PREFIXE}&pageSize=10&sortBy=reference&sortDir=asc`,
  );

  await expect(
    page.getByRole('status').filter({ hasText: 'Dossiers affichés' }),
  ).toBeVisible({ timeout: 30_000 });
  // `.first()` : sous 1024 px le tableau est masqué mais reste dans le document,
  // et la même référence y figure une seconde fois (§1.13 d'`E2E.md`).
  await expect(
    page.getByRole('link', { name: `${PAGINATION_PREFIXE}-01`, exact: true }).first(),
  ).toBeVisible();

  const debordement = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(debordement, 'La page déborde horizontalement à 375 px').toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1280, height: 720 });
});

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

test('CHU-DOSX-01 · l’export des dossiers produit un vrai classeur', async ({ page }) => {
  await page.goto('/chues/dossiers/export');
  await expect(page.getByText('Classeur des dossiers bancaires', { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Télécharger le classeur' }).click(),
  ]);

  expect(telechargement.suggestedFilename()).toMatch(
    /^cpi-dossiers-bancaires-\d{4}-\d{2}-\d{2}\.xlsx$/,
  );
  const chemin = await telechargement.path();
  // Un JSON d'erreur relayé sous l'extension `.xlsx` ne porte pas la signature
  // ZIP et ne pèse pas mille octets.
  expect(await signature(chemin)).toEqual([0x50, 0x4b, 0x03, 0x04]);
  expect((await stat(chemin)).size).toBeGreaterThan(1000);
});

test('CHU-DOSX-02 · l’écran annonce le périmètre de l’export', async ({ page }) => {
  await page.goto('/chues/dossiers/export');

  // Sans cette phrase, l'agent exporte la base entière en croyant exporter sa
  // vue.
  await expect(page.getByText('Aucun filtre : tous les dossiers.')).toBeVisible({
    timeout: 30_000,
  });
});
