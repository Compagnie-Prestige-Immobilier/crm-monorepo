import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import {
  adminApi,
  BANK_CLIENT_PHONE,
  BANQUIER,
  ensureWorkspaceFixtures,
  FIXTURE_PASSWORD,
  REPRESENTANT,
} from './fixtures';

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  test.setTimeout(180_000);
  await ensureWorkspaceFixtures();
  await closeLeftoverCampaigns();
});

/**
 * Un tirage prend chaque fiche dans une tache active, et l'index partiel n'en
 * autorise qu'une. Sans cette cloture, la suite ne passe qu'UNE fois: au
 * deuxieme tirage plus rien n'est eligible, et l'echec accuse le tirage au
 * lieu du reliquat laisse par l'execution precedente.
 */
async function closeLeftoverCampaigns(): Promise<void> {
  const api = await adminApi();
  try {
    for (const [route, prefix] of [
      ['/api/v1/rep-campaigns', 'E2E REP '],
      ['/api/v1/phase2/campaigns', 'E2E '],
    ] as const) {
      const listed = (await (await api.get(route, { params: { pageSize: '100' } })).json()) as {
        items: { id: string; name: string; status: string }[];
      };
      for (const campaign of listed.items) {
        if (campaign.name.startsWith(prefix) && campaign.status !== 'CLOSED') {
          await api.post(`${route}/${campaign.id}/close`);
        }
      }
    }
  } finally {
    await api.dispose();
  }
}

/** Les quatre premiers octets d'un `.xlsx` : la signature ZIP « PK\x03\x04 ». */
async function readMagic(path: string, length = 4): Promise<number[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream(path, { start: 0, end: length - 1 })) {
    chunks.push(chunk as Buffer);
  }
  return [...Buffer.concat(chunks)];
}

async function expectNoErrorState(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', {
      name: /Serveur injoignable|Chargement impossible|Le serveur CPI a rencontré une erreur|Accès refusé/,
    }),
  ).toHaveCount(0);
}

test('l’espace démo se réinitialise et reste isolé', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/parametres');
  await expect(page.getByRole('heading', { name: 'Paramètres', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Réinitialiser l’espace démo' }).click();
  await expect(page.getByText('Espace démo réinitialisé.')).toBeVisible({ timeout: 240_000 });

  await page.getByRole('button', { name: /^Compte de / }).click();
  await page.getByRole('menuitem', { name: 'Ouvrir l’espace démo' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Espace démo' })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto('/prospects');
  await expect(page.getByRole('status').filter({ hasText: 'Espace démo' })).toBeVisible();

  await page.getByRole('button', { name: /^Compte de / }).click();
  await page.getByRole('menuitem', { name: 'Quitter l’espace démo' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Espace démo' })).toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Prospects : surface de phase 3 (Conversion) et double export
// ─────────────────────────────────────────────────────────────────────────────

test('les filtres de conversion vivent dans l’URL et survivent au rechargement', async ({
  page,
}) => {
  await page.goto('/prospects');
  await expect(page.getByRole('table')).toBeVisible();

  const countLine = page.getByRole('status').filter({ hasText: 'Prospects affichés' });
  await expect(countLine).not.toHaveText('');

  // DÉPLIÉ, pas basculé : `AdvancedPanel` mémorise son état dans
  // `localStorage`, et l'état de session l'emporte d'une exécution à l'autre.
  const avances = page.getByRole('button', { name: 'Filtres avancés' });
  if ((await avances.getAttribute('aria-expanded')) !== 'true') await avances.click();
  await expect(avances).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('combobox', { name: 'Résultat de l’appel' }).click();
  await page.getByRole('option', { name: 'Méthode obtenue' }).click();
  await expect(page).toHaveURL(/phase2Status=METHOD_OBTAINED/);

  await page.getByRole('combobox', { name: 'Groupe (syndicat × banque)' }).click();
  await page.getByRole('option', { name: /^BDD1/ }).click();
  await expect(page).toHaveURL(/segment=BDD1/);

  const filtered = (await countLine.textContent())?.trim() ?? '';

  // L'URL EST l'état : un rechargement complet doit rendre le même écran.
  await page.reload();
  await expect(page).toHaveURL(/phase2Status=METHOD_OBTAINED/);
  await expect(page).toHaveURL(/segment=BDD1/);
  await expect(page.getByRole('status').filter({ hasText: 'Prospects affichés' })).toHaveText(
    filtered,
  );

  // Les colonnes de conversion sont bien là, c'est ce qui évitait d'ouvrir
  // l'export pour savoir qui a obtenu le résultat et quand.
  for (const header of [
    'Segment',
    'Résultat de l’appel',
    'Méthode',
    'Dernier appel',
    'Obtenu par',
  ]) {
    await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
  }
});

test('le menu d’export produit les DEUX classeurs', async ({ page }) => {
  await page.goto('/prospects?segment=BDD1');
  await expect(page.getByRole('table')).toBeVisible();

  // ─── Vue filtrée ─────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Exporter' }).click();
  const [filteredDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Exporter la vue filtrée/ }).click(),
  ]);
  expect(filteredDownload.suggestedFilename()).toMatch(/^cpi-prospects-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const filteredPath = await filteredDownload.path();
  expect((await stat(filteredPath)).size).toBeGreaterThan(1_000);
  // Un VRAI classeur, pas un JSON d'erreur renommé.
  expect(await readMagic(filteredPath)).toEqual([0x50, 0x4b, 0x03, 0x04]);

  // ─── Classeur consolidé ──────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Exporter' }).click();
  const [consolidated] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Classeur consolidé/ }).click(),
  ]);
  expect(consolidated.suggestedFilename()).toMatch(
    /^cpi-prospects-consolide-\d{4}-\d{2}-\d{2}\.xlsx$/,
  );
  const consolidatedPath = await consolidated.path();
  expect((await stat(consolidatedPath)).size).toBeGreaterThan(1_000);
  expect(await readMagic(consolidatedPath)).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Phase 3 · Conversion : campagne, aperçu, programme PDF, clôture
// ─────────────────────────────────────────────────────────────────────────────

test('création d’une campagne : l’aperçu chiffre AVANT la confirmation', async ({ page }) => {
  await page.goto('/campagnes');
  await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Nouvelle campagne' }).first().click();

  const name = `E2E ${String(Date.now())}`;
  await page.getByLabel('Nom de la campagne').fill(name);

  // Périmètre BDD1 : plus étroit que « Toutes bases », donc le décompte se
  // distingue franchement du total.
  await page.getByRole('radio', { name: /^BDD1/ }).check();

  // Deux téléconseillers : le tourniquet doit répartir, pas tout donner au premier.
  const commerciaux = page.getByRole('checkbox');
  await commerciaux.nth(0).check();
  await commerciaux.nth(1).check();

  await page.getByRole('button', { name: 'Voir l’aperçu' }).click();

  // LE point de cet écran : le nombre est affiché, et il l'est avant que le
  // bouton de confirmation ne soit actionnable.
  const preview = page.getByRole('status').filter({ hasText: /Maximum à distribuer/i });
  await expect(preview).toBeVisible({ timeout: 30_000 });
  const previewText = (await preview.textContent()) ?? '';
  const shown = Number(
    (/(\d[\d   ]*)\s*prospects/u.exec(previewText)?.[1] ?? '0').replace(/[^\d]/gu, ''),
  );
  expect(shown).toBeGreaterThan(0);

  // La répartition nominative est visible elle aussi : « 800 » ne dit pas si
  // c'est 800 chacun ou 800 en tout.
  await expect(page.getByRole('heading', { name: 'Répartition en tourniquet' })).toBeVisible();
  const parts = await page.getByText(/\d+ appels$/).allTextContents();
  expect(parts.length).toBe(2);
  const distributed = parts.reduce((sum, part) => sum + Number(part.replace(/[^\d]/gu, '')), 0);
  expect(distributed).toBe(shown);

  await page.getByRole('button', { name: 'Lancer la campagne' }).click();

  // On atterrit sur le détail, et le total tiré correspond à l'aperçu.
  await page.waitForURL(/\/campagnes\/[0-9a-f-]{36}/, { timeout: 60_000 });
  // « téléconseiller » : la copie du panel ne dit plus « commercial », qui est
  // désormais réservé aux identifiants venus du contrat engendré.
  await expect(page.getByRole('heading', { name: 'Répartition par téléconseiller' })).toBeVisible();
  await expectNoErrorState(page);
});

test('chaque téléconseiller a son programme PDF téléchargeable', async ({ page }) => {
  await page.goto('/campagnes');
  await page.getByRole('link', { name: /^E2E / }).first().click();
  await page.waitForURL(/\/campagnes\/[0-9a-f-]{36}/);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page
      .getByRole('button', { name: /Programme PDF/ })
      .first()
      .click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^programme-e2e-.*\.pdf$/);
  const path = await download.path();
  expect((await stat(path)).size).toBeGreaterThan(500);
  // « %PDF » : un vrai document, pas un JSON d'erreur relayé en .pdf.
  expect(await readMagic(path, 4)).toEqual([0x25, 0x50, 0x44, 0x46]);
});

test('la clôture annonce les tâches annulées avant de les annuler', async ({ page }) => {
  await page.goto('/campagnes');
  await page.getByRole('link', { name: /^E2E / }).first().click();
  await page.waitForURL(/\/campagnes\/[0-9a-f-]{36}/);

  await page.getByRole('button', { name: 'Clôturer' }).click();

  // La confirmation NOMME la conséquence : sans elle, la clôture se lirait
  // comme un simple archivage, alors qu'elle vide les téléphones.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(/annulée|annulées|figer la campagne/);
  await expect(dialog).toContainText(/tâche|Aucune tâche/);

  await dialog.getByRole('button', { name: 'Clôturer la campagne' }).click();

  await expect(page.getByText('Clôturée', { exact: true })).toBeVisible({ timeout: 30_000 });
  // Une campagne clôturée ne propose plus de clôture.
  await expect(page.getByRole('button', { name: 'Clôturer' })).toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Campagnes REPRÉSENTANTS : tirage, puis programme imprimable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La famille de campagnes qu'on appelle EN PREMIER dans l'ordre du métier : on
 * appelle les représentants pour qu'ils remettent leurs listes, et seulement
 * ensuite les prospects qui en sortent. Elle vit sur sa propre route, avec ses
 * propres tables côté serveur, et son programme PDF passe par un point d'entrée
 * distinct de celui des campagnes prospects
 * (`/rep-campaigns/{id}/commerciaux/{userId}/programme.pdf`).
 *
 * C'est précisément pour cela qu'il faut l'éprouver à part : le jumeau
 * prospects était couvert, celui-ci ne l'était pas, et « les deux écrans se
 * ressemblent » n'a jamais prouvé que les deux routes répondent.
 */
const REP_CAMPAIGN_NAME = `E2E REP ${String(Date.now())}`;

test('une campagne représentants se tire depuis l’onglet dédié', async ({ page }) => {
  await page.goto('/campagnes/representants');
  await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible();
  // Le titre de la barre supérieure est celui de `/campagnes` : c'est l'onglet
  // qui dit sur laquelle des deux listes on se trouve.
  await expect(page.getByRole('link', { name: 'Appels représentants' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('button', { name: 'Nouvelle campagne' }).first().click();
  await page.getByLabel('Nom de la campagne').fill(REP_CAMPAIGN_NAME);

  /**
   * Les téléconseillers sont pris DANS leur groupe de champs, pas dans la
   * page.
   *
   * Le dialogue porte une autre case à cocher, « seulement les représentants
   * dormants », et elle vient AVANT dans le DOM : un `getByRole('checkbox')`
   * global cocherait ce filtre en croyant choisir le premier téléconseiller, et
   * réduirait le tirage à une population qui peut parfaitement être vide.
   */
  const equipe = page.getByRole('group', { name: /Téléconseillers/ });
  await equipe.getByRole('checkbox').nth(0).check();
  await equipe.getByRole('checkbox').nth(1).check();

  await page.getByRole('button', { name: 'Voir l’aperçu' }).click();

  /**
   * L'aperçu vient du SERVEUR, contrairement aux campagnes prospects.
   *
   * L'éligibilité croise le rattachement, la présence de prospects vivants et
   * les campagnes en cours : le chiffre affiché ici est donc celui du tirage
   * réel, et le confirmer sans l'avoir vu n'aurait aucun sens.
   */
  const preview = page.getByRole('status').filter({ hasText: /Représentants éligibles/i });
  await expect(preview).toBeVisible({ timeout: 30_000 });
  const eligible = Number(((await preview.textContent()) ?? '').replace(/[^\d]/gu, ''));
  expect(
    eligible,
    'Aucun représentant éligible : le jeu de démonstration devrait en avoir semé.',
  ).toBeGreaterThan(0);

  await expect(page.getByRole('heading', { name: 'Répartition en tourniquet' })).toBeVisible();

  await page.getByRole('button', { name: 'Lancer la campagne' }).click();

  await page.waitForURL(/\/campagnes\/representants\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Répartition par téléconseiller' })).toBeVisible();
  await expectNoErrorState(page);
});

test('chaque téléconseiller a son programme PDF de campagne représentants', async ({ page }) => {
  await page.goto('/campagnes/representants');
  await page.getByRole('link', { name: REP_CAMPAIGN_NAME }).first().click();
  await page.waitForURL(/\/campagnes\/representants\/[0-9a-f-]{36}/);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page
      .getByRole('button', { name: /Programme PDF/ })
      .first()
      .click(),
  ]);

  /**
   * Le préfixe `programme-representants-` est le point du parcours.
   *
   * Un téléconseiller reçoit les deux liasses le même matin. Si les deux
   * fichiers s'appelaient `programme-…`, ils se confondraient dans le dossier
   * de téléchargements, et se confondraient encore une fois imprimés : celui
   * qu'on appelle n'est pas le même, et l'un des deux n'a pas de nom au
   * téléphone.
   */
  expect(download.suggestedFilename()).toMatch(/^programme-representants-e2e-rep-.*\.pdf$/);
  const path = await download.path();
  expect((await stat(path)).size).toBeGreaterThan(500);
  // « %PDF » : un vrai document, pas un JSON d'erreur relayé en .pdf.
  expect(await readMagic(path, 4)).toEqual([0x25, 0x50, 0x44, 0x46]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Demandes de création de client : la banque dépose, l'administration crée
// ─────────────────────────────────────────────────────────────────────────────

const BANK_IDENTIFIER = process.env.E2E_BANK_IDENTIFIER ?? BANQUIER.email;
const BANK_PASSWORD = process.env.E2E_BANK_PASSWORD ?? FIXTURE_PASSWORD;
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

test('une demande déposée par une banque devient un prospect qui porte sa provenance', async ({
  page,
  browser,
}) => {
  /**
   * DEUX sessions dans un même parcours, et c'est irréductible.
   *
   * Le geste éprouvé traverse deux rôles : un agent BANQUE_FINANCE dépose, un
   * ADMIN arbitre. Le découper en deux fichiers ferait dépendre le second d'une
   * demande créée ailleurs, et la suite tomberait sur une précondition absente
   * plutôt que sur un défaut.
   *
   * `page` porte déjà la session administrateur rangée par `auth.setup.ts` ;
   * seule la session bancaire est ouverte ici, ce qui coûte UNE connexion sur
   * les dix par minute que l'API accorde.
   */
  const stamp = Date.now();
  const prenom = 'Coumba';
  /**
   * Le suffixe est écrit en base 36, et ce n'est pas de la coquetterie.
   *
   * Le dialogue répartit la recherche entre « nom » et « téléphone » selon la
   * proportion de CHIFFRES du terme saisi. Un horodatage décimal en compte
   * treize : « Coumba Ndoye1760000000000 » serait pris pour un numéro, la
   * recherche partirait dans le champ téléphone, et l'assertion de
   * pré-remplissage échouerait pour une raison qui n'a rien à voir avec ce
   * qu'on éprouve. En base 36 le suffixe est surtout fait de lettres.
   */
  const nom = `Ndoye${stamp.toString(36)}`;
  // Préfixe `77` : une plage mobile que `libphonenumber` reconnaît pour le
  // Sénégal. Saisi avec ses espaces : c'est le SERVEUR qui normalise en E.164,
  // et c'est cette normalisation qui décide du doublon.
  const suffix = String(stamp).slice(-7);
  const phone = `77 ${suffix.slice(0, 3)} ${suffix.slice(3, 5)} ${suffix.slice(5, 7)}`;

  // `storageState` VIDE, et explicitement : sans lui, `browser.newContext()`
  // hérite de celui du projet, la session administrateur voyage dans le
  // contexte « bancaire », `/connexion` renvoie vers le tableau de bord, et le
  // parcours attend soixante secondes un champ e-mail jamais rendu.
  const bankContext = await browser.newContext({
    baseURL: WEB_URL,
    storageState: { cookies: [], origins: [] },
  });
  const bankPage = await bankContext.newPage();

  try {
    // ─── La banque dépose ───────────────────────────────────────────────────
    await bankPage.goto('/connexion');
    await bankPage.getByLabel('E-mail ou identifiant').fill(BANK_IDENTIFIER);
    await bankPage.getByLabel('Mot de passe').fill(BANK_PASSWORD);
    await bankPage.getByRole('button', { name: 'Se connecter' }).click();
    // Le hub, atterrissage de tous les rôles : la session est posée dès qu'il
    // est rendu, et l'écran d'ouverture se demande ensuite par son adresse.
    await bankPage.waitForURL('**/espaces', { timeout: 30_000 });

    await bankPage.goto('/dossiers/nouveau');
    await bankPage.getByLabel('Rechercher un client').fill(`${prenom} ${nom}`);

    // L'IMPASSE que ce dialogue existe pour ouvrir : l'écran s'arrêtait là,
    // et le rôle BANQUE_FINANCE n'a aucune route de création de prospect.
    await expect(bankPage.getByText('Aucun client ne correspond.')).toBeVisible({
      timeout: 30_000,
    });
    await bankPage.getByRole('button', { name: 'Demander la création du client' }).click();

    const depot = bankPage.getByRole('dialog');
    // PRÉ-REMPLI depuis la recherche : redemander ce qui vient d'être tapé
    // serait une double saisie, et une occasion de divergence entre ce qui a
    // été cherché et ce qui est demandé.
    await expect(depot.getByLabel(/^Prénom/)).toHaveValue(prenom);
    await expect(depot.getByLabel(/^Nom/)).toHaveValue(nom);

    await depot.getByLabel(/^Téléphone/).fill(phone);
    // Le déclencheur d'un `Select` Base UI est nommé par son `<label for>`, pas
    // par le texte de remplacement qu'il affiche : viser « Choisir une banque »
    // ne désigne AUCUN élément, et le clic attend indéfiniment.
    await depot.getByRole('combobox', { name: /Banque demandeuse/ }).click();
    await bankPage.getByRole('option', { name: /^CBAO/ }).click();
    await depot.getByLabel(/^Contexte pour/).fill('Ouverture de dossier, suite E2E.');

    await depot.getByRole('button', { name: 'Envoyer la demande' }).click();

    // AUCUNE fermeture automatique : l'agent doit lire que sa demande attend
    // un arbitrage, sinon il redéposerait la même dans la minute.
    await expect(depot).toContainText('Demande envoyée', { timeout: 30_000 });
    await expect(depot).toContainText(`${prenom} ${nom} est en attente d’approbation.`);
    // Deux boutons portent ce nom une fois la demande partie : l'action du pied
    // de page et la croix de l'en-tête. C'est l'action qui est éprouvée.
    await depot
      .locator('[data-slot="dialog-footer"]')
      .getByRole('button', { name: 'Fermer' })
      .click();

    // Il retrouve sa demande sur SON écran de suivi, et l'écran ne lui propose
    // aucun geste d'arbitrage : l'API ne lui renvoie que ses propres demandes,
    // et la décision n'est pas la sienne.
    await bankPage.goto('/demandes-clients');
    await expect(
      bankPage.getByRole('heading', { name: 'Mes demandes de création', level: 1 }),
    ).toBeVisible();
    const suivi = bankPage.getByRole('main').getByRole('listitem').filter({ hasText: nom });
    await expect(suivi).toContainText('En attente d’arbitrage par l’administration.');
    await expect(suivi.getByRole('button', { name: 'Approuver et créer le prospect' })).toHaveCount(
      0,
    );

    // ─── L'administration arbitre ───────────────────────────────────────────
    await page.goto('/demandes-clients');
    await expect(
      page.getByRole('heading', { name: 'Créations de client à valider', level: 1 }),
    ).toBeVisible();

    const carte = page.getByRole('main').getByRole('listitem').filter({ hasText: nom });
    await expect(carte).toBeVisible({ timeout: 30_000 });
    // La PROVENANCE est lisible avant la décision : c'est elle qui explique
    // qu'une fiche née ici n'ait pas de représentant de terrain.
    await expect(carte).toContainText('Demande de CBAO');
    await expect(carte).toContainText('Ouverture de dossier, suite E2E.');

    await carte.getByRole('button', { name: 'Approuver et créer le prospect' }).click();

    // Nommé, et pas seulement `getByRole('dialog')` : le sélecteur de
    // représentant s'ouvre dans un popover qui porte lui aussi ce rôle, et un
    // locator ambigu casse le mode strict au lieu d'attendre.
    const arbitrage = page.getByRole('dialog', { name: 'Approuver la demande' });
    await expect(arbitrage).toContainText(`${prenom} ${nom}`);

    const creer = arbitrage.getByRole('button', { name: 'Créer le prospect' });
    /**
     * Trois champs verrouillent l'envoi, et ce n'est pas de la bureaucratie.
     *
     * Le prospect naît en « méthode obtenue », condition exacte du filtre de
     * recherche bancaire, pour que le dossier puisse s'y rattacher tout de
     * suite. Une contrainte CHECK lie ce statut à la méthode d'enrôlement : les
     * demander ici évite de créer une fiche qui échouerait à l'insertion, ou
     * pire, qui serait invisible du formulaire d'ouverture après approbation.
     */
    await expect(creer).toBeDisabled();

    // Les trois listes sont rendues dans un portail, hors du dialogue — mais
    // AUCUNE ne se désigne par `.first()` : la liste de représentants s'ouvre
    // sur une entrée de remise à zéro qui porte le texte de remplacement, et la
    // choisir laisserait le champ vide et l'envoi verrouillé.
    await arbitrage.getByRole('combobox', { name: /Représentant de rattachement/ }).click();
    await page.getByRole('option', { name: REPRESENTANT.fullName }).click();

    await arbitrage.getByRole('combobox', { name: /^Syndicat/ }).click();
    await page.getByRole('option', { name: /^CHUES/ }).click();

    await arbitrage.getByRole('combobox', { name: /Méthode d’enrôlement/ }).click();
    await page.getByRole('option', { name: 'Plateforme' }).click();

    await expect(creer).toBeEnabled();
    await creer.click();
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 60_000 });

    // ─── Le prospect existe, et la provenance a suivi ───────────────────────
    await page.getByRole('button', { name: 'Approuvées' }).click();
    // Scope au contenu principal: une notification ephemere est un `<li>` elle
    // aussi, et « Prospect cree pour Coumba » rend le selecteur ambigu.
    const arbitree = page.getByRole('main').getByRole('listitem').filter({ hasText: nom });
    await expect(arbitree).toContainText('Approuvée', { timeout: 30_000 });
    await expect(arbitree).toContainText('Demande de CBAO');

    await arbitree.getByRole('link', { name: 'Voir le prospect créé' }).click();
    // Le lien porte le TÉLÉPHONE et non l'identifiant : c'est la clé de
    // déduplication du système, et la seule qui retrouve la fiche à coup sûr.
    await expect(page).toHaveURL(/\/prospects\?search=/);

    const ligne = page.getByRole('row').filter({ hasText: nom });
    await expect(ligne).toHaveCount(1, { timeout: 30_000 });
    // « Méthode obtenue » : la conséquence visible de l'approbation, celle qui
    // rend la fiche atteignable depuis le formulaire d'ouverture de dossier.
    await expect(ligne).toContainText('Méthode obtenue');

    // Et la boucle se referme côté banque : la demande approuvée propose enfin
    // le geste qui l'avait motivée.
    await bankPage.goto('/demandes-clients');
    await bankPage.getByRole('button', { name: 'Approuvées' }).click();
    await expect(
      bankPage
        .getByRole('main')
        .getByRole('listitem')
        .filter({ hasText: nom })
        .getByRole('link', { name: 'Ouvrir un dossier pour ce client' }),
    ).toBeVisible({ timeout: 30_000 });
  } finally {
    await bankContext.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Banque & Finance : cycle complet d'un dossier
// ─────────────────────────────────────────────────────────────────────────────

/** Ouvre un dossier sur le premier client trouvé et rend sa référence. */
async function createCase(page: Page, reference: string): Promise<void> {
  await page.goto('/dossiers/nouveau');
  await expect(page.getByLabel('Rechercher un client')).toBeVisible();

  // La fixture garantit CETTE fiche en « méthode obtenue ». Chercher un fragment
  // de nom commun ne tenait que sur les restes d'une exécution précédente.
  await page.getByLabel('Rechercher un client').fill(BANK_CLIENT_PHONE);
  const firstResult = page.getByRole('button', { name: /\+221/ }).first();
  await expect(firstResult).toBeVisible({ timeout: 30_000 });
  await firstResult.click();

  // Le résumé compact confirme QUI a été retenu : ouvrir un dossier sur le
  // mauvais homonyme ne se découvre qu'à l'encaissement.
  await expect(page.getByText(/Nom et téléphone sont copiés/)).toBeVisible();

  await page.getByLabel('Référence bancaire').fill(reference);
  await page.getByRole('button', { name: 'Ouvrir le dossier' }).click();
  await page.waitForURL(/\/dossiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
}

test('un dossier peut être mené jusqu’à l’encaissement', async ({ page }) => {
  const reference = `E2E-ENC-${String(Date.now())}`;
  await createCase(page, reference);

  await expect(page.getByText(reference, { exact: true })).toBeVisible();
  await expectNoErrorState(page);

  // Étape 1 → 2. Le libellé du bouton NOMME l'étape cible : « Suivant » ne dit
  // pas où l'on va.
  const advance = page.getByRole('button', { name: /^Passer à/ });
  await expect(advance).toBeVisible();
  await advance.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });

  // Encaissement : le montant est demandé, et l'aperçu formaté doit apparaître
  // AVANT la validation : « 12000000 » et « 1200000 » se distinguent mal.
  const cash = page.getByRole('button', { name: 'Déclarer l’encaissement' });
  await expect(cash).toBeVisible({ timeout: 30_000 });
  await cash.click();

  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'Confirmer l’encaissement' });
  // Sans montant, la confirmation est verrouillée.
  await expect(confirm).toBeDisabled();

  await dialog.getByLabel('Montant encaissé').fill('12400000');
  // Aperçu en direct, en FCFA groupés.
  await expect(dialog.getByRole('status')).toContainText('FCFA');
  await expect(dialog.getByRole('status')).toContainText('400');
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });

  // Le montant est rendu formaté, et le dossier est verrouillé.
  await expect(page.getByText(/12\s*400\s*000 FCFA/u).first()).toBeVisible();
  await expect(page.getByText(/Étape terminale/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rejeter le dossier' })).toHaveCount(0);

  // L'historique conserve la trace des trois transitions.
  await expect(page.getByRole('heading', { name: 'Historique du dossier' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Montant :' })).toHaveCount(1);
});

test('un dossier peut être rejeté, et le rejet annonce « Montant : 0 FCFA »', async ({ page }) => {
  const reference = `E2E-REJ-${String(Date.now())}`;
  await createCase(page, reference);

  await page.getByRole('button', { name: 'Rejeter le dossier' }).click();

  const dialog = page.getByRole('dialog');
  // La phrase qui évite la surprise : un agent qui vient de voir un montant à
  // l'écran croirait sinon que le rejet le conserve.
  await expect(dialog).toContainText('Montant : 0 FCFA');

  const confirm = dialog.getByRole('button', { name: 'Rejeter définitivement' });
  // Sans motif, rien ne part : la statistique des rejets serait aveugle.
  await expect(confirm).toBeDisabled();

  await dialog.getByRole('combobox', { name: 'Motif de rejet' }).click();
  await page.getByRole('option', { name: 'Document manquant' }).click();
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(/Rejeté : Document manquant/)).toBeVisible();
  await expect(page.getByText(/Étape terminale/)).toBeVisible();
});

test('le motif « Autre » exige une précision', async ({ page }) => {
  const reference = `E2E-AUT-${String(Date.now())}`;
  await createCase(page, reference);

  await page.getByRole('button', { name: 'Rejeter le dossier' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Motif de rejet' }).click();
  await page.getByRole('option', { name: 'Autre motif' }).click();

  const confirm = dialog.getByRole('button', { name: 'Rejeter définitivement' });
  await expect(dialog.getByLabel('Précision')).toBeVisible();
  await expect(confirm).toBeDisabled();

  await dialog.getByLabel('Précision').fill('Vérification à mener avec la direction.');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(/Vérification à mener avec la direction/).last()).toBeVisible();
});

test('la référence dupliquée est signalée au flou, avec un lien vers le dossier existant', async ({
  page,
}) => {
  const reference = `E2E-DUP-${String(Date.now())}`;
  await createCase(page, reference);

  // Deuxième dossier, même référence.
  await page.goto('/dossiers/nouveau');
  await page.getByLabel('Rechercher un client').fill(BANK_CLIENT_PHONE);
  await page.getByRole('button', { name: /\+221/ }).first().click();
  await page.getByLabel('Référence bancaire').fill(reference);
  // Le contrôle part au FLOU, pas à chaque frappe.
  await page.getByLabel('Référence bancaire').blur();

  const alert = page.getByRole('alert').filter({ hasText: 'existe déjà' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert.getByRole('link', { name: 'Ouvrir ce dossier' })).toBeVisible();
});

test('la liste, les vues rapides et l’export des dossiers', async ({ page }) => {
  await page.goto('/dossiers');
  await expect(page.getByRole('heading', { name: 'Dossiers bancaires', level: 1 })).toBeVisible();

  const countLine = page.getByRole('status').filter({ hasText: 'Dossiers affichés' });
  await expect(countLine).not.toHaveText('');

  await page.getByRole('button', { name: 'Encaissés', exact: true }).click();
  await expect(page).toHaveURL(/stageType=CASHED/);
  await expect(countLine).not.toHaveText('');

  await page.getByRole('button', { name: 'Rejetés', exact: true }).click();
  await expect(page).toHaveURL(/stageType=REJECTED/);

  // L'export suit le filtre affiché : c'est toute la promesse faite à l'agent.
  await page.getByRole('button', { name: 'Exporter' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Classeur des dossiers filtrés/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^cpi-dossiers-bancaires-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const path = await download.path();
  expect(await readMagic(path)).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

test('le tableau de bord bancaire mène à la liste filtrée depuis un graphique', async ({
  page,
}) => {
  await page.goto('/banque');
  // L'ADMIN n'a pas d'entrée « Vue d'ensemble » : le titre retombe sur celui de
  // la coque, dont l'écran fait partie.
  await expect(page.getByRole('heading', { name: 'Projet CHUES', level: 1 })).toBeVisible();
  await expectNoErrorState(page);

  await expect(page.getByText('Taux de rejet', { exact: true })).toBeVisible();
  await expect(page.getByText('Délai moyen', { exact: true })).toBeVisible();
  await expect(page.getByText('Dossiers par étape', { exact: true })).toBeVisible();
  // Les montants sont rendus en FCFA, jamais en nombre brut.
  await expect(page.getByText(/FCFA/).first()).toBeVisible();
});

test('la configuration des étapes se réordonne au clavier, sans glisser-déposer', async ({
  page,
}) => {
  await page.goto('/dossiers/etapes');
  await expect(page.getByRole('heading', { name: 'Étapes des dossiers', level: 1 })).toBeVisible();

  // Les boutons NOMMENT l'étape déplacée : « Monter » seul, répété six fois,
  // ne dit pas quoi on déplace.
  await expect(page.locator('button[aria-label^="Monter « "]').first()).toBeVisible();
  await expect(page.locator('button[aria-label^="Descendre « "]').first()).toBeVisible();

  // L'étape initiale ne bouge pas : l'API refuserait, autant le dire par un
  // bouton désactivé.
  const initialRow = page.getByRole('listitem').filter({ hasText: 'Étape initiale' });
  await expect(initialRow.getByRole('button', { name: /^Monter/ })).toBeDisabled();

  // Les étapes système ne se désactivent pas.
  await expect(page.getByText('Étapes terminales', { exact: true })).toBeVisible();
  await expect(page.getByText('Non modifiable').first()).toBeVisible();
});
