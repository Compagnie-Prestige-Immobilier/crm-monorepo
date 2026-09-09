import { expect, test, type Locator, type Page } from '@playwright/test';

import { compteDe, type RoleCompte } from './comptes';
import {
  compter,
  creerBanque,
  creerProspectEnrole,
  ecrire,
  effacerBanque,
  ligne,
  marque,
  numero,
} from './donnees-admin';
import { nationalDe, sansDebordementHorizontal } from './donnees-chues';

const banquier = compteDe('BANQUE_FINANCE');
const administrateur = compteDe('ADMIN');

const cle = marque();
const NOM_BANQUE = `Banque ${cle} parite`;
const NOM_CLIENT = `Sow${cle}`;
const NOM_DEMANDE = `Absent${cle}`;
const REFERENCE = `PAR-${cle}`;
const MOTIF_REFUS = `Numéro à revérifier avec l’agence. ${cle}`;
const TELEPHONE_DEMANDE = '78 110 00 01';

let banqueId = '';
let dossierId = '';
let telephoneEligible = '';
let telephoneEnAttente = '';

async function semerClient(prenom: string): Promise<string> {
  const telephone = numero();
  const entree = { nom: NOM_CLIENT, prenom, telephone, banqueId, proprietaireId: banquier.id };
  await creerProspectEnrole(entree);
  return telephone;
}

/** Le résultat de recherche porte aussi le téléphone et la banque : préfixe. */
const resultat = (page: Page, prenom: string): Locator =>
  page.getByRole('button', { name: new RegExp(`^${prenom} ${NOM_CLIENT}`, 'u') });

const etatVide = (page: Page, titre: string): Locator =>
  page.getByRole('heading', { name: titre, level: 2 });
const carteDemande = (page: Page): Locator =>
  page.getByRole('listitem').filter({ hasText: `Fatou ${NOM_DEMANDE}` });

async function sansGesteDArbitrage(carte: Locator): Promise<void> {
  for (const geste of ['Approuver et créer le prospect', 'Refuser']) {
    await expect(carte.getByRole('button', { name: geste })).toHaveCount(0);
  }
}

async function dossier(reference: string) {
  return ligne<{ id: string; amountXof: string | null; code: string }>(
    `SELECT c.id, c."amountXof", s.code
       FROM bank_cases c JOIN bank_case_stages s ON s.id = c."currentStageId"
      WHERE c.reference = $1`,
    [reference],
  );
}

test.beforeAll(async () => {
  banqueId = await creerBanque(NOM_BANQUE);
  telephoneEligible = await semerClient('Awa');
  await semerClient('Bineta');
  telephoneEnAttente = await semerClient('Coumba');
  // Une contrainte lie le statut à la méthode : la fiche encore en attente ne
  // se sème pas autrement, et c'est elle qui doit rester invisible.
  await ecrire(
    `UPDATE prospects SET "phase2Status" = 'PENDING', "enrollmentMethod" = NULL
      WHERE "phoneE164" = $1`,
    [telephoneEnAttente],
  );
});

test.afterAll(async () => {
  await ecrire(`DELETE FROM notifications WHERE body LIKE $1`, [`%${NOM_DEMANDE}%`]);
  await effacerBanque(banqueId);
});

test.describe('parité banque, les écrans du dossier bancaire', () => {
  test.use({ storageState: banquier.etat });
  test.describe.configure({ mode: 'serial' });

  test('« Projet CHUES » mène la banque à sa vue d’ensemble', async ({ page }) => {
    await page.goto('/espaces');
    const tuile = page.getByRole('link', { name: /^Projet CHUES/u });
    await expect(tuile).toHaveAttribute('href', '/chues/banque');

    await page.goto('/chues');
    await expect(page).toHaveURL(/\/chues\/banque$/u);
    await expect(page.getByRole('heading', { name: 'Vue d’ensemble', level: 1 })).toBeVisible();
    await expect(etatVide(page, 'Accès refusé')).toHaveCount(0);
  });

  test('les deux listes vides ne disent pas la même chose', async ({ page }) => {
    await page.goto('/chues/dossiers');
    await expect(page.getByRole('heading', { name: 'Dossiers bancaires', level: 1 })).toBeVisible();
    // D'autres parcours ouvrent des dossiers en même temps : l'état « rien du tout » ne se voit
    // que si la base n'en a aucun ; l'état filtré, lui, se provoque toujours.
    if (
      (await compter('SELECT count(*) AS n FROM bank_cases WHERE "deletedAt" IS NULL', [])) === 0
    ) {
      await expect(etatVide(page, 'Aucun dossier bancaire')).toBeVisible();
      await expect(page.getByText('Ouvrez un dossier depuis « Nouveau dossier ».')).toBeVisible();
    }

    await page.getByLabel('Recherche').fill(`ZZZ-${cle}`);
    await expect(page).toHaveURL(new RegExp(`search=ZZZ-${cle}`, 'u'));
    await expect(etatVide(page, 'Aucun dossier ne correspond à ces critères')).toBeVisible();
    await expect(page.getByText('Élargissez la période ou retirez un critère.')).toBeVisible();
  });

  test('seule une fiche en méthode obtenue s’ouvre, la référence exigée', async ({ page }) => {
    await page.goto('/chues/dossiers/nouveau');
    const recherche = page.getByLabel('Rechercher un client');

    await recherche.fill(telephoneEnAttente);
    await expect(page.getByText('Aucun client ne correspond.')).toBeVisible();
    await expect(resultat(page, 'Coumba')).toHaveCount(0);

    await recherche.fill(NOM_CLIENT);
    await expect(resultat(page, 'Awa')).toBeVisible();
    await recherche.fill(nationalDe(telephoneEligible));
    await resultat(page, 'Awa').click();
    await expect(page.getByText('Nom et téléphone sont copiés sur le dossier.')).toBeVisible();

    const reference = page.getByLabel('Référence bancaire');
    const ouvrir = page.getByRole('button', { name: 'Ouvrir le dossier' });
    await expect(reference).toHaveValue('');
    await expect(page.getByText('Deux caractères au minimum. Référence unique.')).toBeVisible();
    await expect(ouvrir).toBeDisabled();
    await reference.fill('A');
    await expect(ouvrir).toBeDisabled();

    await reference.fill(REFERENCE);
    await ouvrir.click();
    await expect(page.getByText(`Dossier ${REFERENCE} ouvert.`)).toBeVisible();

    const ouvert = await dossier(REFERENCE);
    dossierId = ouvert.id;
    expect(ouvert.code).toBe('A_TRAITER');
    expect(ouvert.amountXof, 'un dossier en instruction ne porte aucun montant').toBeNull();
    await expect(page).toHaveURL(new RegExp(`${ouvert.id}$`, 'u'));
  });

  test('une référence déjà prise renvoie au dossier existant', async ({ page }) => {
    await page.goto('/chues/dossiers/nouveau');
    await page.getByLabel('Rechercher un client').fill(NOM_CLIENT);
    await resultat(page, 'Bineta').click();
    await page.getByLabel('Référence bancaire').fill(REFERENCE);
    await page.getByRole('button', { name: 'Ouvrir le dossier' }).click();

    const alerte = page.getByRole('alert').filter({ hasText: 'existe déjà' });
    await expect(alerte).toContainText(`La référence « ${REFERENCE} » existe déjà.`);
    await alerte.getByRole('link', { name: 'Ouvrir ce dossier' }).click();
    await expect(page).toHaveURL(new RegExp(`${dossierId}$`, 'u'));

    expect(
      await compter(`SELECT count(*) AS n FROM bank_cases WHERE reference = $1`, [REFERENCE]),
      'le doublon refusé ne doit rien écrire',
    ).toBe(1);
  });

  test('l’encaissement refuse un montant nul puis verrouille le dossier', async ({ page }) => {
    await page.goto(`/chues/dossiers/${dossierId}`);
    await page.getByRole('button', { name: 'Passer à « En traitement banque »' }).click();
    await page.getByRole('button', { name: 'Confirmer', exact: true }).click();
    await expect(page.getByText('Dossier passé à l’étape suivante.')).toBeVisible();

    await page.getByRole('button', { name: 'Déclarer l’encaissement' }).click();
    const boite = page.getByRole('dialog');
    const montant = boite.getByLabel('Montant encaissé');
    const confirmer = boite.getByRole('button', { name: 'Confirmer l’encaissement' });
    await expect(confirmer).toBeDisabled();
    await montant.fill('0');
    await expect(montant).toHaveValue('0');
    await expect(confirmer).toBeDisabled();
    await montant.fill('abc');
    await expect(montant, 'un montant ne garde que ses chiffres').toHaveValue('');
    await expect(confirmer).toBeDisabled();

    await montant.fill('1200000');
    await expect(boite.getByRole('status')).toHaveText(/^1.200.000 FCFA$/u);
    await confirmer.click();
    await expect(page.getByText('Encaissement enregistré.')).toBeVisible();

    const verrou = page.getByText('Étape terminale. Dossier verrouillé.');
    await expect(verrou).toBeVisible();
    for (const geste of ['Rejeter le dossier', 'Déclarer l’encaissement']) {
      await expect(page.getByRole('button', { name: geste })).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: /^Passer à/u })).toHaveCount(0);

    await page.reload();
    await expect(verrou).toBeVisible();
    const histoire = page.getByRole('list').filter({ hasText: 'Ouverture :' });
    await expect(histoire.getByRole('listitem')).toHaveCount(3);

    const encaisse = await dossier(REFERENCE);
    expect(encaisse.code).toBe('ENCAISSE');
    expect(encaisse.amountXof).toBe('1200000');
  });

  test('les vues rapides vivent dans l’URL et survivent au rechargement', async ({ page }) => {
    await page.goto('/chues/dossiers');
    const decompte = page.getByRole('status').filter({ hasText: 'Dossiers affichés' });
    const encaisses = page.getByRole('button', { name: 'Encaissés', exact: true });

    await encaisses.click();
    await expect(page).toHaveURL(/stageType=CASHED/u);
    await expect(page.getByRole('cell', { name: REFERENCE, exact: true })).toBeVisible();
    await expect(decompte).toContainText('1–1 sur 1');

    await page.reload();
    await expect(page).toHaveURL(/stageType=CASHED/u);
    await expect(encaisses).toHaveAttribute('aria-pressed', 'true');
    await expect(decompte).toContainText('1–1 sur 1');

    await page.getByRole('button', { name: 'À traiter', exact: true }).click();
    await expect(page).toHaveURL(/stageId=/u);
    // D'autres parcours ont des dossiers à traiter : le nôtre, encaissé, n'y est pas.
    await expect(page.getByRole('cell', { name: REFERENCE, exact: true })).toHaveCount(0);
  });

  test('la vue d’ensemble chiffre l’encaissement et nomme une période vide', async ({ page }) => {
    await page.goto('/chues/banque');
    for (const indicateur of ['Dossiers', 'Encaissés', 'Taux de rejet', 'Délai moyen']) {
      await expect(page.getByText(indicateur, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText(/^1.200.000 FCFA$/u).first()).toBeVisible();
    // Le tableau des montants désigne la banque par son nom court, pas son nom.
    await expect(page.getByRole('rowheader', { name: new RegExp(cle, 'u') })).toBeVisible();

    await page.getByLabel('Créé à partir du').fill('2031-01-01');
    await expect(page).toHaveURL(/dateFrom=2031-01-01/u);
    await expect(page.getByText('Aucun dossier rejeté sur ces critères.')).toBeVisible();
    await expect(page.getByText('Aucune activité d’agent sur ces critères.')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Aucun dossier sur ces critères.' })).toBeVisible();
    // Un montant nul se lit ; il ne se devine pas dans une case vide.
    await expect(page.getByText('0 FCFA', { exact: true }).first()).toBeVisible();

    // Le panneau sur téléphone est le seul client de la v2. Le rechargement est
    // nécessaire : les graphiques se mesurent au montage, pas au redimensionnement.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await sansDebordementHorizontal(page);
  });

  test('le classeur annonce son périmètre et emporte les critères', async ({ page }) => {
    await page.goto('/chues/dossiers/export');
    await expect(page.getByText('Classeur des dossiers bancaires', { exact: true })).toBeVisible();
    await expect(page.getByText('Aucun filtre : tous les dossiers.')).toBeVisible();
    const lien = page.getByRole('link', { name: 'Télécharger le classeur des dossiers bancaires' });
    await expect(lien).toHaveAttribute('href', /projet=CHUES/u);

    await page.getByRole('button', { name: 'Rejetés', exact: true }).click();
    await expect(page.getByText('1 filtre appliqué.')).toBeVisible();
    // Le classeur part des critères de l'URL, jamais de la page affichée.
    await expect(lien).toHaveAttribute('href', /stageType=REJECTED/u);
  });
});

type Ecran = readonly [route: string, familleApi: string];

const DOSSIERS: Ecran = ['/chues/dossiers', '/api/v1/bank-cases'];
const CLASSEUR: Ecran = ['/chues/dossiers/export', '/api/v1/bank-case-stages'];
const TABLEAU: Ecran = ['/chues/banque', '/api/v1/bank-cases'];
const DEMANDES: Ecran = ['/chues/demandes-clients', '/api/v1/client-requests'];
const ETAPES: Ecran = ['/chues/dossiers/etapes', '/api/v1/bank-case-stages'];
const ETAPE1: Ecran = ['/chues/appels-representants', '/api/v1/representants'];

const FERMES: readonly { role: RoleCompte; libelle: string; ecrans: readonly Ecran[] }[] = [
  {
    role: 'COMMERCIAL',
    libelle: 'Téléconseiller',
    ecrans: [DOSSIERS, CLASSEUR, TABLEAU, DEMANDES],
  },
  { role: 'SUPERVISEUR', libelle: 'Supervision', ecrans: [DOSSIERS, TABLEAU, DEMANDES] },
  { role: 'DIRECTION', libelle: 'Direction', ecrans: [DOSSIERS, DEMANDES] },
  { role: 'BANQUE_FINANCE', libelle: 'Banque & Finance', ecrans: [ETAPES, ETAPE1] },
];

/** Le refus se lit, ET rien du métier n’a été chargé derrière lui. */
async function attendreRefus(page: Page, ecran: Ecran, libelle: string): Promise<void> {
  const [route, familleApi] = ecran;
  const chargees: string[] = [];
  page.on('response', (reponse) => {
    const chemin = new URL(reponse.url()).pathname;
    if (chemin.startsWith(familleApi) && reponse.status() < 400) chargees.push(chemin);
  });
  await page.goto(route);

  const refus = page.getByRole('alert').filter({ hasText: 'Accès refusé' });
  await expect(refus.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
  await expect(refus).toContainText(
    `Cet écran est réservé à un autre rôle. Rôle en cours : ${libelle}.`,
  );
  const retour = refus.getByRole('link', { name: 'Retour à l’accueil' });
  await expect(retour).toHaveAttribute('href', '/espaces');
  expect(chargees, `${route} a chargé des données métier pour ${libelle}`).toEqual([]);
}

for (const ferme of FERMES) {
  test.describe(`parité banque, session ${ferme.libelle}`, () => {
    test.use({ storageState: compteDe(ferme.role).etat });

    test('les écrans fermés à ce rôle refusent sans rien charger', async ({ page }) => {
      for (const ecran of ferme.ecrans) {
        await attendreRefus(page, ecran, ferme.libelle);
      }
    });
  });
}

test.describe('parité banque, les demandes de création de client', () => {
  test.use({ storageState: banquier.etat });
  test.describe.configure({ mode: 'serial' });

  test('le dépôt exige un téléphone, et la banque n’arbitre pas', async ({ page }) => {
    await page.goto('/chues/demandes-clients');
    const suivi = page.getByRole('heading', { name: 'Mes demandes de création', level: 1 });
    const valider = page.getByRole('heading', { name: 'Créations de client à valider', level: 1 });
    await expect(suivi).toBeVisible();
    await expect(valider).toHaveCount(0);

    await page.goto('/chues/dossiers/nouveau');
    await page.getByLabel('Rechercher un client').fill(`Fatou ${NOM_DEMANDE}`);
    await expect(page.getByText('Aucun client ne correspond.')).toBeVisible();
    await page.getByRole('button', { name: 'Demander la création du client' }).click();

    const depot = page.getByRole('dialog');
    const telephone = depot.getByLabel(/^Téléphone/u);
    await expect(depot.getByLabel(/^Prénom/u)).toHaveValue('Fatou');
    await expect(depot.getByLabel(/^Nom/u)).toHaveValue(NOM_DEMANDE);
    await expect(telephone).toHaveValue('');
    await depot.getByRole('combobox', { name: 'Banque demandeuse' }).click();
    await page.getByRole('option', { name: NOM_BANQUE }).click();

    // Le téléphone est le SEUL verrou restant : sans cet aller-retour, un bouton
    // désactivé pour une autre raison ferait passer ce parcours.
    const envoyer = depot.getByRole('button', { name: 'Envoyer la demande' });
    await expect(envoyer).toBeDisabled();
    await telephone.fill(TELEPHONE_DEMANDE);
    await expect(envoyer).toBeEnabled();
    await telephone.fill('');
    await expect(envoyer).toBeDisabled();

    await telephone.fill(TELEPHONE_DEMANDE);
    await envoyer.click();
    const confirme = depot.getByText(`Fatou ${NOM_DEMANDE} est en attente d’approbation.`);
    await expect(confirme).toBeVisible();
    await depot.getByRole('button', { name: 'Fermer' }).first().click();

    await page.goto('/chues/demandes-clients');
    const carte = carteDemande(page);
    await expect(carte).toContainText('En attente d’arbitrage par l’administration.');
    await sansGesteDArbitrage(carte);

    expect(
      await compter(
        `SELECT count(*) AS n FROM client_creation_requests
          WHERE nom = $1 AND status = 'PENDING' AND "requestedById" = $2`,
        [NOM_DEMANDE, banquier.id],
      ),
      'un seul dépôt part, celui qui portait un téléphone',
    ).toBe(1);
  });

  test('le refus du siège revient à la banque avec son motif', async ({ page, browser }) => {
    const siege = await browser.newContext({ storageState: administrateur.etat });
    try {
      const arbitre = await siege.newPage();
      await arbitre.goto('/chues/demandes-clients');
      const titre = { name: 'Créations de client à valider', level: 1 };
      await expect(arbitre.getByRole('heading', titre)).toBeVisible();
      await arbitre.getByLabel('Recherche').fill(NOM_DEMANDE);
      await carteDemande(arbitre).getByRole('button', { name: 'Refuser' }).click();

      const boite = arbitre.getByRole('dialog');
      const confirmer = boite.getByRole('button', { name: 'Refuser', exact: true });
      await expect(confirmer, 'un refus muet renverrait la banque à son impasse').toBeDisabled();
      await boite.getByLabel(/^Motif du refus/u).fill(MOTIF_REFUS);
      await expect(confirmer).toBeEnabled();
      await confirmer.click();
      const avis = arbitre.getByText('Demande refusée. Le motif est remonté à la banque.');
      await expect(avis).toBeVisible();
    } finally {
      await siege.close();
    }

    const arbitree = await ligne<{ status: string; rejectionNote: string | null }>(
      `SELECT status, "rejectionNote" FROM client_creation_requests WHERE nom = $1`,
      [NOM_DEMANDE],
    );
    expect(arbitree.status).toBe('REJECTED');
    expect(arbitree.rejectionNote).toBe(MOTIF_REFUS);

    await page.goto('/chues/demandes-clients');
    await page.getByRole('button', { name: 'Refusées', exact: true }).click();
    await expect(page).toHaveURL(/statut=REJECTED/u);
    const carte = carteDemande(page);
    await expect(carte).toContainText(`Refusée : ${MOTIF_REFUS}`);
    await expect(carte).toContainText(`Arbitrée par ${administrateur.nom}`);
    await sansGesteDArbitrage(carte);
  });
});
