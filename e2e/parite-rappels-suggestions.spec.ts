import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import type { Client } from 'pg';

import { avecBase, BASE_URL, compteDe, MOT_DE_PASSE, PORT } from './comptes';
import {
  effacerFiches,
  marque,
  numeroUnique,
  semerProspect,
  semerRepresentant,
  type FicheSemee,
} from './donnees-chues';

const vierge = compteDe('CHARGE_CLIENTELE');
const encadrement = compteDe('SUPERVISEUR');
const administrateur = compteDe('ADMIN');
const banquier = compteDe('BANQUE_FINANCE');

/**
 * Un teleconseiller a soi, a l'identifiant UUID : « mes contacts » et la reprise
 * des representants passent `lastCallById` a `GET /representants`, declare
 * `format:"uuid"`, que les comptes du harnais font repondre 422.
 */
const REPRENEUR = {
  id: randomUUID(),
  email: 'e2e.h.repreneur@cpi.sn',
  identifiant: 'e2e.h.repreneur',
  nom: 'E2E H REPRENEUR',
  etat: path.join(__dirname, '.auth', PORT, 'parite-h-repreneur.json'),
};

const cle = marque();
const RAPPELS = '/chues/rappels';
const SUGGESTIONS = '/chues/suggestions';
const DEMANDES = '/chues/demandes-clients';
const HEURE_MS = 3_600_000;
const NOM_DEMANDE = `Demande${cle}`;
const MOTIF_REFUS = `Numéro déjà rattaché à un autre client ${cle}`;
const INTROUVABLE = `ZZZ-AUCUNE-DEMANDE-${cle}`;
const PROPOSE_NOM = `Sow${cle}`;

const telephones: string[] = [];
type Promesse = { readonly fiche: FicheSemee; readonly commentaire: string };
let semaine: Promesse;
let aAnnuler: Promesse;
let depassee: Promesse;
let source: FicheSemee;
let proposeE164 = '';

/** La file des rappels de prospects, l'autre tableau de l'ecran suivant les representants. */
const fileRappels = (page: Page): Locator =>
  page
    .getByRole('table')
    .filter({ has: page.getByRole('columnheader', { name: 'Commentaire', exact: true }) });

const ligne = (page: Page, texte: string): Locator =>
  page.getByRole('row').filter({ hasText: texte });
const carte = (page: Page): Locator =>
  page
    .getByRole('list', { name: 'Numéros suggérés' })
    .getByRole('listitem')
    .filter({ hasText: PROPOSE_NOM });

const mot = (page: Page, valeur: string): Locator => page.getByText(valeur, { exact: true });
const titre = (page: Page, valeur: string): Locator =>
  page.getByRole('heading', { name: valeur, level: 2 });

/** Le numero tel que l'ecran l'ecrit : `formatPhone` espace les groupes. */
const affiche = (e164: string): string =>
  `+221 ${e164.slice(4, 6)} ${e164.slice(6, 9)} ${e164.slice(9, 11)} ${e164.slice(11)}`;

async function promettre(client: Client, sujet: string, heures: number): Promise<Promesse> {
  const fiche = await semerProspect(client, `Rappel${cle}`, sujet, REPRENEUR.id);
  telephones.push(fiche.phoneE164);
  const commentaire = `E2E rappel ${sujet} ${cle}`;
  // `timestamp without time zone` : l'ISO en Z depose l'heure UTC que le serveur relit.
  const echeance = new Date(Date.now() + heures * HEURE_MS).toISOString();
  await client.query(
    `WITH tentative AS (
       INSERT INTO call_attempts (id, "prospectId", "performedById", outcome, comment, "clientCreatedAt")
       VALUES ($1, $2, $3, 'CALLBACK', $4, now()) RETURNING id
     ), promesse AS (
       INSERT INTO scheduled_callbacks
         (id, "prospectId", "assignedToId", "scheduledAt", comment, "sourceAttemptId")
       SELECT $5, $2, $3, $6, $4, id FROM tentative
     )
     UPDATE prospects SET "lastCallAt" = now(), "lastCallById" = $3, "lastCallOutcome" = 'CALLBACK'
      WHERE id = $2`,
    [randomUUID(), fiche.id, REPRENEUR.id, commentaire, randomUUID(), echeance],
  );
  return { fiche, commentaire };
}

/** Un appel refuse donne le numero d'un tiers et laisse une echeance depassee. */
async function semerRefusEtSuggestion(client: Client): Promise<void> {
  source = await semerRepresentant(client, `Refus${cle}`, REPRENEUR.id);
  telephones.push(source.phoneE164);
  proposeE164 = numeroUnique();
  await client.query(
    `WITH tentative AS (
       INSERT INTO rep_call_attempts (id, "representantId", "performedById", outcome, "clientCreatedAt")
       VALUES ($1, $2, $3, 'REFUSED', now()) RETURNING id
     ), piste AS (
       INSERT INTO representant_suggestions
         (id, "sourceRepresentantId", "suggestedName", "suggestedPhoneE164", "suggestedById",
          "sourceAttemptId", "clientCreatedAt")
       SELECT $4, $2, $5, $6, $3, id, now() FROM tentative
     )
     UPDATE representants SET "lastCallAt" = now(), "lastCallById" = $3,
       "lastCallOutcome" = 'REFUSED', "nextCallbackAt" = $7, "nextCallbackOrigine" = 'PROMIS'
      WHERE id = $2`,
    // prettier-ignore
    [randomUUID(), source.id, REPRENEUR.id, randomUUID(), PROPOSE_NOM, proposeE164,
      new Date(Date.now() - 2 * HEURE_MS).toISOString()],
  );
}

async function ouvrirSession(browser: Browser): Promise<void> {
  // Etat vide impose : le contexte heriterait sinon de l'etat que voici a ecrire.
  const contexte = await browser.newContext({
    baseURL: BASE_URL,
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.70' },
  });
  const page = await contexte.newPage();
  await page.goto('/connexion');
  await page.getByLabel('E-mail ou identifiant').fill(REPRENEUR.email);
  await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('button', { name: `Compte de ${REPRENEUR.nom}` })).toBeVisible();
  await contexte.storageState({ path: REPRENEUR.etat });
  await contexte.close();
}

test.beforeAll(async ({ browser }) => {
  await avecBase(async (client) => {
    await client.query('DELETE FROM client_creation_requests WHERE nom LIKE $1', ['Demande%']);
    await client.query(
      `INSERT INTO users (id, email, username, "passwordHash", "fullName", role, "updatedAt")
       SELECT $1, $2, $3, "passwordHash", $4, 'COMMERCIAL', now()
         FROM users WHERE id = $5`,
      [REPRENEUR.id, REPRENEUR.email, REPRENEUR.identifiant, REPRENEUR.nom, administrateur.id],
    );
    semaine = await promettre(client, 'Semaine', 26);
    aAnnuler = await promettre(client, 'Annulation', 27);
    depassee = await promettre(client, 'Retard', -2);
    await semerRefusEtSuggestion(client);
    // Deux demandes DEJA REFUSEES : la file en attente reste vide, donc lisible.
    const demandeurs = [
      ['Sienne', banquier.id],
      ['Autre', administrateur.id],
    ] as const;
    for (const [prenom, demandeur] of demandeurs) {
      await client.query(
        `INSERT INTO client_creation_requests
           (id, nom, prenom, "phoneE164", "banqueId", "requestedById", status, "rejectionNote", "updatedAt")
         SELECT $1, $2, $3, $4, id, $5, 'REJECTED', $6, now() FROM banques ORDER BY name LIMIT 1`,
        [randomUUID(), NOM_DEMANDE, prenom, numeroUnique(), demandeur, MOTIF_REFUS],
      );
    }
  });
  await ouvrirSession(browser);
});

test.afterAll(async () => {
  await effacerFiches(telephones);
  await avecBase(async (client) => {
    await client.query('DELETE FROM client_creation_requests WHERE nom = $1', [NOM_DEMANDE]);
    await client.query('DELETE FROM refresh_tokens WHERE "userId" = $1', [REPRENEUR.id]);
    await client.query('DELETE FROM users WHERE id = $1', [REPRENEUR.id]);
  });
});

test.describe('parite rappels et contacts, le teleconseiller', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: REPRENEUR.etat });

  test('la file, son compteur de retards et les representants a reprendre', async ({ page }) => {
    await page.goto(RAPPELS);
    await expect(page.getByRole('tab', { name: /^En retard/u })).toHaveCount(1);
    await expect(page.getByRole('tab', { name: 'Aujourd’hui' })).toHaveCount(1);
    await expect(page.getByRole('tab', { name: 'Cette semaine' })).toHaveCount(1);
    const compteur = page.getByRole('status').filter({ hasText: /rappels? en retard$/u });
    await expect(compteur).toHaveText('1 rappel en retard');
    const tardive = fileRappels(page).getByRole('row').filter({ hasText: depassee.commentaire });
    await expect(tardive).toContainText(affiche(depassee.fiche.phoneE164));
    await expect(tardive.getByText('Sans objet')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Cette semaine' }).click();
    const file = fileRappels(page);
    for (const colonne of ['Prospect', 'Échéance', 'Retard', 'Commentaire', 'Actions']) {
      await expect(file.getByRole('columnheader', { name: colonne, exact: true })).toHaveCount(1);
    }
    // Un teleconseiller ne lit que ses rappels : ni colonne ni filtre par collegue.
    await expect(file.getByRole('columnheader', { name: 'Téléconseiller' })).toHaveCount(0);
    await expect(page.getByLabel('Téléconseiller')).toHaveCount(0);
    await expect(page.getByLabel('Appelé par')).toHaveCount(0);
    const promise = file.getByRole('row').filter({ hasText: semaine.commentaire });
    await expect(promise).toContainText('demain à');
    await expect(promise.getByText('Sans objet', { exact: true })).toHaveCount(1);
    // L'origine distingue le rappel promis de celui que le referentiel reprogramme.
    const reprise = ligne(page, source.nom);
    await expect(reprise).toHaveCount(1);
    await expect(reprise.getByText('En retard', { exact: true })).toHaveCount(1);
    await expect(reprise.getByText('Promis', { exact: true })).toHaveCount(1);
  });

  test('annuler retire le rappel, consigner ouvre la fiche visee', async ({ page }) => {
    await page.goto(RAPPELS);
    await page.getByRole('tab', { name: 'Cette semaine' }).click();
    const file = fileRappels(page);
    const cible = file.getByRole('row').filter({ hasText: aAnnuler.commentaire });
    await cible.getByRole('button', { name: 'Annuler' }).click();
    await expect(mot(page, 'Rappel annulé.')).toBeVisible();
    await expect(cible, 'la liste n’a pas ete invalidee').toHaveCount(0);
    await avecBase(async (client) => {
      const { rows } = await client.query<{ status: string }>(
        'SELECT status FROM scheduled_callbacks WHERE "prospectId" = $1',
        [aAnnuler.fiche.id],
      );
      expect(rows.map((row) => row.status)).toEqual(['CANCELLED']);
    });
    await file
      .getByRole('row')
      .filter({ hasText: semaine.commentaire })
      .getByRole('link', { name: 'Consigner l’appel' })
      .click();
    await page.waitForURL(`**/chues/console?fiche=${semaine.fiche.id}`);
    await expect(titre(page, semaine.fiche.nom), 'la console ignore ?fiche=').toBeVisible();
  });

  test('mes contacts listent les prospects et les representants appeles', async ({ page }) => {
    await page.goto('/chues/mes-contacts');
    const prospect = ligne(page, affiche(semaine.fiche.phoneE164));
    await expect(prospect).toHaveCount(1);
    await expect(prospect).toContainText('À rappeler');
    await expect(prospect).toContainText('En attente');
    await expect(page.getByLabel('Appelé par')).toHaveCount(0);
    await page.getByRole('button', { name: 'Représentants', exact: true }).click();
    const representant = ligne(page, source.nom);
    await expect(representant).toHaveCount(1);
    await expect(representant).toContainText('Refus');
  });
});

test.describe('parite numeros suggeres, le teleconseiller', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: REPRENEUR.etat });

  test('la carte dit d’ou vient le numero, et chaque filtre a son etat vide', async ({ page }) => {
    await page.goto(SUGGESTIONS);
    const explication =
      'Numéros donnés par un représentant qui décline, pour qu’un collègue soit appelé à sa place.';
    await expect(mot(page, explication)).toBeVisible();
    const propose = carte(page);
    await expect(propose).toHaveCount(1);
    await expect(propose).toContainText(affiche(proposeE164));
    // Le representant source est designe par son code court, jamais par son nom.
    await expect(propose).toContainText(/Donné par le représentant\s+[0-9A-Z]{6}/u);
    await expect(propose).toContainText(`recueilli par ${REPRENEUR.nom}`);
    await expect(propose.getByText('À appeler', { exact: true })).toHaveCount(1);
    const filtres = page.getByRole('group', { name: 'Filtrer par statut' });
    await expect(filtres.getByRole('button', { name: 'Tous', exact: true })).toHaveCount(1);
    await filtres.getByRole('button', { name: 'Abandonné', exact: true }).click();
    await expect(mot(page, 'Aucun numéro « Abandonné ».')).toBeVisible();
    await expect(mot(page, 'Retirez le filtre pour voir les autres numéros.')).toBeVisible();
    await expect(page.getByText('Aucun numéro suggéré pour l’instant.')).toHaveCount(0);
  });

  test('creer la fiche pre-remplit, marquer appele solde la carte', async ({ page }) => {
    await page.goto(SUGGESTIONS);
    const propose = carte(page);
    await propose.getByRole('button', { name: 'Créer la fiche' }).click();
    const dialogue = page.getByRole('dialog');
    await expect(dialogue.getByRole('heading', { name: 'Nouveau représentant' })).toBeVisible();
    await expect(dialogue.getByLabel('Nom complet')).toHaveValue(PROPOSE_NOM);
    await expect(dialogue.getByLabel('Téléphone')).toHaveValue(affiche(proposeE164));
    await page.keyboard.press('Escape');
    await expect(dialogue).toHaveCount(0);
    await propose.getByRole('button', { name: 'Marquer appelé' }).click();
    await expect(mot(page, 'Numéro marqué « Appelé ».')).toBeVisible();
    await expect(propose.getByText('Appelé', { exact: true })).toHaveCount(1);
    const solde = propose.getByRole('button', { name: 'Marquer appelé' });
    await expect(solde, 'le geste se rejoue : liste non invalidee').toHaveCount(0);
    await expect(propose.getByRole('button', { name: 'Abandonner' })).toHaveCount(0);
    await avecBase(async (client) => {
      const { rows } = await client.query<{ status: string }>(
        'SELECT status FROM representant_suggestions WHERE "sourceRepresentantId" = $1',
        [source.id],
      );
      expect(rows.map((row) => row.status)).toEqual(['APPELE']);
    });
  });
});

test.describe('parite rappels et numeros suggeres, l’encadrement', () => {
  test.use({ storageState: encadrement.etat });

  test('le filtre, la colonne et les cartes de tout le plateau', async ({ page }) => {
    await page.goto(RAPPELS);
    await expect(page.getByLabel('Téléconseiller'), 'le filtre de l’encadrement').toHaveCount(1);
    const file = fileRappels(page);
    await expect(file.getByRole('columnheader', { name: 'Téléconseiller' })).toHaveCount(1);
    const promise = file.getByRole('row').filter({ hasText: depassee.commentaire });
    await expect(promise).toContainText(REPRENEUR.nom);
    await expect(ligne(page, source.nom), 'la reprise nomme qui a appele').toContainText(
      REPRENEUR.nom,
    );
    await page.goto(SUGGESTIONS);
    await expect(carte(page)).toContainText(`recueilli par ${REPRENEUR.nom}`);
  });

  test('annuler un rappel : le geste n’est pas offert a la supervision', async ({ page }) => {
    await page.goto(RAPPELS);
    await expect(fileRappels(page).getByRole('button', { name: 'Annuler' })).toHaveCount(0);
  });

  test.fixme('solder un numero : lecture seule en v1, permis en v2', async ({ page }) => {
    await page.goto(SUGGESTIONS);
    await expect(page.getByRole('button', { name: 'Marquer appelé' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Créer la fiche' })).toHaveCount(0);
  });
});

const AIDE_VIDE = 'Une échéance se promet en consignant un appel.';
const ONGLETS_VIDES = [
  ['En retard', 'Aucun rappel en retard', 'Les échéances promises sont tenues.'],
  ['Aujourd’hui', 'Aucun rappel aujourd’hui', AIDE_VIDE],
  ['Cette semaine', 'Aucun rappel cette semaine', AIDE_VIDE],
] as const;

test.describe('parite rappels et numeros suggeres, une file vide', () => {
  test.use({ storageState: vierge.etat });

  test('chaque onglet et chaque liste vide disent quoi faire ensuite', async ({ page }) => {
    await page.goto(RAPPELS);
    // L'etat vide ne promet plus la touche 5 de la console v1, qui n'existe pas.
    for (const [onglet, vide, aide] of ONGLETS_VIDES) {
      await page.getByRole('tab', { name: new RegExp(`^${onglet}`, 'u') }).click();
      await expect(titre(page, vide)).toBeVisible();
      await expect(mot(page, aide)).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Aucun rappel en retard' })).toHaveCount(0);
    await page.goto(SUGGESTIONS);
    const origine =
      'Un numéro arrive ici quand un représentant en décline un autre pendant un appel consigné.';
    await expect(mot(page, 'Aucun numéro suggéré pour l’instant.')).toBeVisible();
    await expect(mot(page, origine)).toBeVisible();
    await expect(page.getByText('Retirez le filtre pour voir les autres numéros.')).toHaveCount(0);
  });
});

test.describe('parite creations de client, l’arbitrage', () => {
  test.use({ storageState: administrateur.etat });

  test('file vide, filtre trop etroit, decompte annonce et pagination en butee', async ({
    page,
  }) => {
    await page.goto(DEMANDES);
    const entete = page.getByRole('heading', { name: 'Créations de client à valider', level: 1 });
    await expect(entete).toBeVisible();
    // Sans filtre, l'ecran s'ouvre sur les demandes EN ATTENTE : le vide s'y lit
    // comme une file traitee.
    await expect(titre(page, 'Aucune demande en attente')).toBeVisible();
    await page.getByLabel('Recherche').fill(INTROUVABLE);
    await expect(page).toHaveURL(new RegExp(`search=${INTROUVABLE}`, 'u'));
    await expect(titre(page, 'Aucune demande sur ces critères')).toBeVisible();
    await expect(titre(page, 'Aucune demande en attente')).toHaveCount(0);
    await page.getByRole('button', { name: 'Effacer la recherche' }).click();
    await page.getByRole('button', { name: 'Toutes', exact: true }).click();
    await expect(page).toHaveURL(/statut=tous/u);
    await expect(page.getByRole('listitem').filter({ hasText: NOM_DEMANDE })).toHaveCount(2);
    const decompte = page.getByRole('status').filter({ hasText: 'Demandes affichées' });
    await expect(decompte).toHaveText('Demandes affichées : 1–2 sur 2');
    await expect(mot(page, '1 / 1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Page précédente' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Page suivante' })).toBeDisabled();
  });
});

test.describe('parite creations de client, le suivi de l’agent bancaire', () => {
  test.use({ storageState: banquier.etat });

  test('l’agent ne suit que ses demandes et y lit le motif du refus', async ({ page }) => {
    await page.goto(DEMANDES);
    const entete = page.getByRole('heading', { name: 'Mes demandes de création', level: 1 });
    await expect(entete).toBeVisible();
    await page.getByRole('button', { name: 'Toutes', exact: true }).click();
    const sienne = page.getByRole('listitem').filter({ hasText: `Sienne ${NOM_DEMANDE}` });
    await expect(sienne).toHaveCount(1);
    await expect(sienne).toContainText(`Refusée : ${MOTIF_REFUS}`);
    const autrui = page.getByRole('listitem').filter({ hasText: `Autre ${NOM_DEMANDE}` });
    await expect(autrui, 'l’agent lit la demande d’un autre').toHaveCount(0);
  });
});
