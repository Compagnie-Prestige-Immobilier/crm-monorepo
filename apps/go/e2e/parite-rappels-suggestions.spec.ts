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
 * Un teleconseiller a soi, dont l'identifiant est un UUID : « mes contacts » et
 * « representants a reprendre » passent `lastCallById` a `GET /representants`,
 * declare `format:"uuid"`, et les comptes du harnais (`e2e-commercial`) le font
 * repondre 422. Les comptes reels portent un UUID v7.
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

interface Promesse {
  readonly fiche: FicheSemee;
  readonly commentaire: string;
}

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

  const tentative = randomUUID();
  await client.query(
    `INSERT INTO rep_call_attempts (id, "representantId", "performedById", outcome, "clientCreatedAt")
     VALUES ($1, $2, $3, 'REFUSED', now())`,
    [tentative, source.id, REPRENEUR.id],
  );
  await client.query(
    `INSERT INTO representant_suggestions
       (id, "sourceRepresentantId", "suggestedName", "suggestedPhoneE164", "suggestedById",
        "sourceAttemptId", "clientCreatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [randomUUID(), source.id, PROPOSE_NOM, proposeE164, REPRENEUR.id, tentative],
  );
  await client.query(
    `UPDATE representants SET "lastCallAt" = now(), "lastCallById" = $2,
       "lastCallOutcome" = 'REFUSED', "nextCallbackAt" = $3, "nextCallbackOrigine" = 'PROMIS'
      WHERE id = $1`,
    [source.id, REPRENEUR.id, new Date(Date.now() - 2 * HEURE_MS).toISOString()],
  );
}

async function ouvrirSession(browser: Browser): Promise<void> {
  // Etat vide impose : le contexte heriterait sinon du `storageState` du premier
  // parcours, celui que cette fonction doit justement ecrire.
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
         FROM users WHERE id = 'e2e-commercial'`,
      [REPRENEUR.id, REPRENEUR.email, REPRENEUR.identifiant, REPRENEUR.nom],
    );
    semaine = await promettre(client, 'Semaine', 26);
    aAnnuler = await promettre(client, 'Annulation', 27);
    depassee = await promettre(client, 'Retard', 2);
    await semerRefusEtSuggestion(client);

    // Deux demandes DEJA REFUSEES : la file en attente reste vide, ce qui garde
    // lisibles les deux etats vides de l'ecran d'arbitrage.
    const banques = await client.query<{ id: string }>(
      'SELECT id FROM banques ORDER BY name LIMIT 1',
    );
    const banqueId = banques.rows[0]?.id;
    if (banqueId === undefined) throw new Error('aucune banque au referentiel');
    await client.query(
      `INSERT INTO client_creation_requests
         (id, nom, prenom, "phoneE164", "banqueId", "requestedById", status, "rejectionNote", "updatedAt")
       VALUES ($1, $3, 'Sienne', $4, $6, $7, 'REJECTED', $9, now()),
              ($2, $3, 'Autre', $5, $6, $8, 'REJECTED', $9, now())`,
      [
        randomUUID(),
        randomUUID(),
        NOM_DEMANDE,
        numeroUnique(),
        numeroUnique(),
        banqueId,
        administrateur.id,
        administrateur.id,
        MOTIF_REFUS,
      ],
    );
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
    await expect(compteur, 'ce parcours pose une echeance deja depassee').toHaveText(
      '1 rappel en retard',
    );

    const tardive = fileRappels(page).getByRole('row').filter({ hasText: depassee.commentaire });
    await expect(tardive).toContainText(affiche(depassee.fiche.phoneE164));
    await expect(
      tardive.getByText('Sans objet', { exact: true }),
      'une echeance depassee porte son retard',
    ).toHaveCount(0);

    await page.getByRole('tab', { name: 'Cette semaine' }).click();
    const file = fileRappels(page);
    for (const colonne of ['Prospect', 'Échéance', 'Retard', 'Commentaire', 'Actions']) {
      await expect(
        file.getByRole('columnheader', { name: colonne, exact: true }),
        `la colonne « ${colonne} » manque a la file des rappels`,
      ).toHaveCount(1);
    }

    // Un teleconseiller ne lit que ses propres rappels : ni la colonne qui nomme
    // l'auteur ni le filtre par collegue n'ont de sens pour lui.
    await expect(file.getByRole('columnheader', { name: 'Téléconseiller' })).toHaveCount(0);
    await expect(page.getByLabel('Téléconseiller')).toHaveCount(0);
    await expect(page.getByLabel('Appelé par')).toHaveCount(0);

    const promise = file.getByRole('row').filter({ hasText: semaine.commentaire });
    await expect(promise).toContainText('demain à');
    await expect(
      promise.getByText('Sans objet', { exact: true }),
      'une echeance a venir n’est pas un retard',
    ).toHaveCount(1);

    const reprise = ligne(page, source.nom);
    await expect(reprise).toHaveCount(1);
    await expect(reprise.getByText('En retard', { exact: true })).toHaveCount(1);
    await expect(
      reprise.getByText('Promis', { exact: true }),
      'l’origine distingue le rappel promis de celui que le referentiel reprogramme',
    ).toHaveCount(1);
  });

  test('annuler retire le rappel, consigner ouvre la fiche visee', async ({ page }) => {
    await page.goto(RAPPELS);
    await page.getByRole('tab', { name: 'Cette semaine' }).click();

    const file = fileRappels(page);
    await file
      .getByRole('row')
      .filter({ hasText: aAnnuler.commentaire })
      .getByRole('button', { name: 'Annuler' })
      .click();
    await expect(page.getByText('Rappel annulé.', { exact: true })).toBeVisible();
    await expect(
      file.getByRole('row').filter({ hasText: aAnnuler.commentaire }),
      'la liste n’a pas ete invalidee apres l’annulation',
    ).toHaveCount(0);

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
    await expect(
      page.getByRole('heading', { name: semaine.fiche.nom, level: 2 }),
      'la console ignore ?fiche= et n’ouvre aucune fiche',
    ).toBeVisible();
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
    await expect(
      page.getByText(
        'Numéros donnés par un représentant qui décline, pour qu’un collègue soit appelé à sa place.',
        { exact: true },
      ),
    ).toBeVisible();

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
    await expect(page.getByText('Aucun numéro « Abandonné ».', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Retirez le filtre pour voir les autres numéros.', { exact: true }),
    ).toBeVisible();
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
    await expect(page.getByText('Numéro marqué « Appelé ».', { exact: true })).toBeVisible();
    await expect(propose.getByText('Appelé', { exact: true })).toHaveCount(1);
    await expect(
      propose.getByRole('button', { name: 'Marquer appelé' }),
      'la liste n’a pas ete invalidee : le geste se rejoue',
    ).toHaveCount(0);
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
    await expect(
      page.getByLabel('Téléconseiller'),
      'l’encadrement perd le filtre dont il vit',
    ).toHaveCount(1);

    const file = fileRappels(page);
    await expect(file.getByRole('columnheader', { name: 'Téléconseiller' })).toHaveCount(1);
    await expect(file.getByRole('row').filter({ hasText: depassee.commentaire })).toContainText(
      REPRENEUR.nom,
    );
    await expect(ligne(page, source.nom), 'la reprise nomme aussi qui a appele').toContainText(
      REPRENEUR.nom,
    );

    await page.goto(SUGGESTIONS);
    await expect(carte(page)).toContainText(`recueilli par ${REPRENEUR.nom}`);
  });

  test.fixme('annuler un rappel : le bouton est offert, l’API le refuse en 403', async ({
    page,
  }) => {
    await page.goto(RAPPELS);
    await expect(
      fileRappels(page).getByRole('button', { name: 'Annuler' }),
      'un role qui ne peut pas annuler ne doit pas voir le geste',
    ).toHaveCount(0);
  });

  test.fixme('solder un numero suggere : lecture seule en v1, permis en v2', async ({ page }) => {
    await page.goto(SUGGESTIONS);
    await expect(page.getByRole('button', { name: 'Marquer appelé' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Abandonner' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Créer la fiche' })).toHaveCount(0);
  });
});

test.describe('parite rappels et numeros suggeres, une file vide', () => {
  test.use({ storageState: vierge.etat });

  const ONGLETS = [
    ['En retard', 'Aucun rappel en retard', 'Les échéances promises sont tenues.'],
    ['Aujourd’hui', 'Aucun rappel aujourd’hui', 'Une échéance se promet en consignant un appel.'],
    [
      'Cette semaine',
      'Aucun rappel cette semaine',
      'Une échéance se promet en consignant un appel.',
    ],
  ] as const;

  test('chaque onglet et chaque liste vide disent quoi faire ensuite', async ({ page }) => {
    await page.goto(RAPPELS);
    // L'etat vide ne promet plus la touche 5 de la console v1, qui n'existe pas.
    for (const [onglet, titre, aide] of ONGLETS) {
      await page.getByRole('tab', { name: new RegExp(`^${onglet}`, 'u') }).click();
      await expect(page.getByRole('heading', { name: titre, level: 2 })).toBeVisible();
      await expect(page.getByText(aide, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Aucun rappel en retard' })).toHaveCount(0);

    await page.goto(SUGGESTIONS);
    await expect(
      page.getByText('Aucun numéro suggéré pour l’instant.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Un numéro arrive ici quand un représentant en décline un autre pendant un appel consigné.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByText('Retirez le filtre pour voir les autres numéros.')).toHaveCount(0);
  });
});

test.describe('parite creations de client, l’arbitrage', () => {
  test.use({ storageState: administrateur.etat });

  test('file vide, filtre trop etroit, decompte annonce et pagination en butee', async ({
    page,
  }) => {
    await page.goto(DEMANDES);
    await expect(
      page.getByRole('heading', { name: 'Créations de client à valider', level: 1 }),
    ).toBeVisible();

    // Sans filtre, l'ecran s'ouvre sur les demandes EN ATTENTE : le vide s'y lit
    // comme une file traitee.
    await expect(
      page.getByRole('heading', { name: 'Aucune demande en attente', level: 2 }),
    ).toBeVisible();

    await page.getByLabel('Recherche').fill(INTROUVABLE);
    await expect(page).toHaveURL(new RegExp(`search=${INTROUVABLE}`, 'u'));
    await expect(
      page.getByRole('heading', { name: 'Aucune demande sur ces critères', level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Aucune demande en attente', level: 2 }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Effacer la recherche' }).click();
    await page.getByRole('button', { name: 'Toutes', exact: true }).click();
    await expect(page).toHaveURL(/statut=tous/u);
    await expect(page.getByRole('listitem').filter({ hasText: NOM_DEMANDE })).toHaveCount(2);

    const decompte = page.getByRole('status').filter({ hasText: 'Demandes affichées' });
    await expect(decompte).toHaveText('Demandes affichées : 1–2 sur 2');
    await expect(page.getByText('1 / 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Page précédente' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Page suivante' })).toBeDisabled();
  });
});

test.describe('parite creations de client, le suivi de l’agent bancaire', () => {
  test.use({ storageState: banquier.etat });

  test('l’agent ne suit que ses demandes et y lit le motif du refus', async ({ page }) => {
    await page.goto(DEMANDES);
    await expect(
      page.getByRole('heading', { name: 'Mes demandes de création', level: 1 }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Toutes', exact: true }).click();

    const sienne = page.getByRole('listitem').filter({ hasText: `Sienne ${NOM_DEMANDE}` });
    await expect(sienne).toHaveCount(1);
    await expect(sienne).toContainText(`Refusée : ${MOTIF_REFUS}`);

    await expect(
      page.getByRole('listitem').filter({ hasText: `Autre ${NOM_DEMANDE}` }),
      'l’agent bancaire lit la demande deposee par quelqu’un d’autre',
    ).toHaveCount(0);
  });
});
