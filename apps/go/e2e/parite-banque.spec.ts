import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { compteDe, type RoleCompte } from './comptes';
import {
  compter,
  contenuFeuille,
  creerBanque,
  creerProspectEnrole,
  DOSSIER_FIXTURES,
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

interface Client {
  id: string;
  telephone: string;
  nom: string;
}

let banqueId = '';
let eligible: Client;
let second: Client;
let enAttente: Client;
let dossierId = '';

async function semerClient(prenom: string): Promise<Client> {
  const telephone = numero();
  const id = await creerProspectEnrole({
    nom: NOM_CLIENT,
    prenom,
    telephone,
    banqueId,
    proprietaireId: banquier.id,
  });
  return { id, telephone, nom: `${prenom} ${NOM_CLIENT}` };
}

/** Le résultat de recherche porte aussi le téléphone et la banque : préfixe. */
function resultat(page: Page, client: Client) {
  return page.getByRole('button', { name: new RegExp(`^${client.nom}`, 'u') });
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
  eligible = await semerClient('Awa');
  second = await semerClient('Bineta');
  enAttente = await semerClient('Coumba');
  // La recherche de client des dossiers exige `METHOD_OBTAINED` : cette fiche
  // prouve qu'une autre reste invisible, elle ne se sème pas autrement.
  await ecrire(
    `UPDATE prospects SET "phase2Status" = 'PENDING', "enrollmentMethod" = NULL WHERE id = $1`,
    [enAttente.id],
  );
});

test.afterAll(async () => {
  await ecrire(`DELETE FROM notifications WHERE body LIKE $1`, [`%${NOM_DEMANDE}%`]);
  await effacerBanque(banqueId);
});

test.describe('parité banque, les écrans du dossier bancaire', () => {
  test.use({ storageState: banquier.etat });
  test.describe.configure({ mode: 'serial' });

  test('les deux listes vides ne disent pas la même chose', async ({ page }) => {
    await page.goto('/chues/dossiers');
    await expect(page.getByRole('heading', { name: 'Dossiers bancaires', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aucun dossier bancaire', level: 2 })).toBeVisible();
    await expect(page.getByText('Ouvrez un dossier depuis « Nouveau dossier ».')).toBeVisible();

    await page.getByLabel('Recherche').fill(`ZZZ-${cle}`);
    await expect(page).toHaveURL(new RegExp(`search=ZZZ-${cle}`, 'u'));
    await expect(
      page.getByRole('heading', { name: 'Aucun dossier ne correspond à ces critères', level: 2 }),
    ).toBeVisible();
    await expect(page.getByText('Élargissez la période ou retirez un critère.')).toBeVisible();
  });

  test('seule une fiche en méthode obtenue s’ouvre, et la référence est exigée', async ({
    page,
  }) => {
    await page.goto('/chues/dossiers/nouveau');
    const recherche = page.getByLabel('Rechercher un client');

    await recherche.fill(enAttente.telephone);
    await expect(page.getByText('Aucun client ne correspond.')).toBeVisible();
    await expect(resultat(page, enAttente)).toHaveCount(0);

    await recherche.fill(NOM_CLIENT);
    await expect(resultat(page, eligible)).toBeVisible();
    await recherche.fill(nationalDe(eligible.telephone));
    await resultat(page, eligible).click();
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
    await resultat(page, second).click();
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

    await expect(page.getByText('Étape terminale. Dossier verrouillé.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rejeter le dossier' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Déclarer l’encaissement' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Passer à/u })).toHaveCount(0);

    await page.reload();
    await expect(page.getByText('Étape terminale. Dossier verrouillé.')).toBeVisible();
    await expect(
      page.getByRole('list').filter({ hasText: 'Ouverture :' }).getByRole('listitem'),
    ).toHaveCount(3);

    const encaisse = await dossier(REFERENCE);
    expect(encaisse.code).toBe('ENCAISSE');
    expect(encaisse.amountXof).toBe('1200000');
  });

  test('un identifiant inconnu ne rend pas une page blanche', async ({ page }) => {
    await page.goto('/chues/dossiers/00000000-0000-0000-0000-000000000000');
    await expect(page.getByRole('heading', { name: 'Introuvable', level: 2 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tous les dossiers' })).toBeVisible();
  });

  test('les vues rapides vivent dans l’URL et survivent au rechargement', async ({ page }) => {
    await page.goto('/chues/dossiers');
    const decompte = page.getByRole('status').filter({ hasText: 'Dossiers affichés' });

    await page.getByRole('button', { name: 'Encaissés', exact: true }).click();
    await expect(page).toHaveURL(/stageType=CASHED/u);
    await expect(page.getByRole('cell', { name: REFERENCE, exact: true })).toBeVisible();
    await expect(decompte).toContainText('1–1 sur 1');

    await page.reload();
    await expect(page).toHaveURL(/stageType=CASHED/u);
    await expect(page.getByRole('button', { name: 'Encaissés', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(decompte).toContainText('1–1 sur 1');
    await expect(page.getByRole('button', { name: 'Page précédente' })).toBeDisabled();

    await page.getByRole('button', { name: 'À traiter', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Aucun dossier ne correspond à ces critères', level: 2 }),
    ).toBeVisible();
  });

  test('la vue d’ensemble chiffre l’encaissement, une période sans dossier le dit', async ({
    page,
  }) => {
    await page.goto('/chues/banque');
    await expect(page.getByRole('heading', { name: 'Vue d’ensemble', level: 1 })).toBeVisible();
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
    await expect(
      page.getByText('0 FCFA', { exact: true }).first(),
      'un montant nul se lit, il ne se devine pas dans une case vide',
    ).toBeVisible();
  });

  test('le classeur annonce son périmètre et n’emporte que les dossiers filtrés', async ({
    page,
  }) => {
    await page.goto('/chues/dossiers/export');
    await expect(page.getByText('Classeur des dossiers bancaires', { exact: true })).toBeVisible();
    await expect(page.getByText('Aucun filtre : tous les dossiers.')).toBeVisible();
    for (const feuille of ['Dossiers', 'Historique', 'Synthèse']) {
      await expect(page.getByRole('term').filter({ hasText: `Feuille « ${feuille} »` })).toBeVisible();
    }

    await page.getByRole('button', { name: 'Rejetés', exact: true }).click();
    await expect(page.getByText('1 filtre appliqué.')).toBeVisible();

    const attente = page.waitForEvent('download');
    await page
      .getByRole('link', { name: 'Télécharger le classeur des dossiers bancaires' })
      .click();
    const chemin = path.join(DOSSIER_FIXTURES, `parite-banque-${cle}.xlsx`);
    await (await attente).saveAs(chemin);

    const lignes = await contenuFeuille(chemin, 'Dossiers');
    expect(lignes[0]?.[0]).toBe('Référence');
    expect(
      lignes.slice(1),
      'le classeur doit suivre les critères de l’écran, pas la base entière',
    ).toEqual([]);
  });
});

test.describe('parité banque en 390 px', () => {
  test.use({
    storageState: banquier.etat,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('la vue d’ensemble tient dans l’écran du téléphone', async ({ page }) => {
    await page.goto('/chues/banque');
    await expect(page.getByText('Taux de rejet', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Délai moyen', { exact: true }).first()).toBeVisible();
    await sansDebordementHorizontal(page);
  });
});

test.describe('parité banque, le hub de l’agent bancaire', () => {
  test.use({ storageState: banquier.etat });

  test('« Projet CHUES » mène au tableau de bord bancaire, jamais à un refus', async ({ page }) => {
    await page.goto('/espaces');
    await expect(page.getByRole('link', { name: /^Projet CHUES/u })).toHaveAttribute(
      'href',
      '/chues/banque',
    );

    await page.goto('/chues');
    await expect(page).toHaveURL(/\/chues\/banque$/u);
    await expect(page.getByRole('heading', { name: 'Vue d’ensemble', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Accès refusé', level: 2 })).toHaveCount(0);
  });
});

const DOSSIERS = { route: '/chues/dossiers', api: '/api/v1/bank-cases' };
const EXPORT = { route: '/chues/dossiers/export', api: '/api/v1/bank-case-stages' };
const TABLEAU = { route: '/chues/banque', api: '/api/v1/bank-cases' };
const DEMANDES = { route: '/chues/demandes-clients', api: '/api/v1/client-requests' };

const FERMES: readonly {
  role: RoleCompte;
  libelle: string;
  ecrans: readonly { route: string; api: string }[];
}[] = [
  { role: 'COMMERCIAL', libelle: 'Téléconseiller', ecrans: [DOSSIERS, EXPORT, TABLEAU, DEMANDES] },
  { role: 'SUPERVISEUR', libelle: 'Supervision', ecrans: [DOSSIERS, TABLEAU, DEMANDES] },
  { role: 'DIRECTION', libelle: 'Direction', ecrans: [DOSSIERS, DEMANDES] },
  {
    role: 'BANQUE_FINANCE',
    libelle: 'Banque & Finance',
    ecrans: [
      { route: '/chues/dossiers/etapes', api: '/api/v1/bank-case-stages' },
      { route: '/chues/appels-representants', api: '/api/v1/representants' },
    ],
  },
];

/** Le refus se lit ET rien du métier n’a été chargé derrière lui. */
async function attendreRefus(page: Page, route: string, api: string, libelle: string) {
  const chargees: string[] = [];
  const relever = (reponse: { url: () => string; status: () => number }): void => {
    const chemin = new URL(reponse.url()).pathname;
    if (chemin.startsWith(api) && reponse.status() < 400) chargees.push(chemin);
  };
  page.on('response', relever);
  try {
    await page.goto(route);
    const refus = page.getByRole('alert').filter({ hasText: 'Accès refusé' });
    await expect(refus.getByRole('heading', { name: 'Accès refusé', level: 2 })).toBeVisible();
    await expect(refus).toContainText(
      `Cet écran est réservé à un autre rôle. Rôle en cours : ${libelle}.`,
    );
    await expect(refus.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute(
      'href',
      '/espaces',
    );
    expect(chargees, `${route} a chargé des données métier pour ${libelle}`).toEqual([]);
  } finally {
    page.off('response', relever);
  }
}

for (const ferme of FERMES) {
  test.describe(`parité banque, session ${ferme.libelle}`, () => {
    test.use({ storageState: compteDe(ferme.role).etat });

    test('les écrans fermés à ce rôle refusent sans rien charger', async ({ page }) => {
      for (const ecran of ferme.ecrans) {
        await attendreRefus(page, ecran.route, ecran.api, ferme.libelle);
      }
    });
  });
}

test.describe('parité banque, la demande de création vue de la banque', () => {
  test.use({ storageState: banquier.etat });
  test.describe.configure({ mode: 'serial' });

  test('le dépôt exige un téléphone et la banque n’arbitre pas', async ({ page }) => {
    await page.goto('/chues/demandes-clients');
    await expect(
      page.getByRole('heading', { name: 'Mes demandes de création', level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Créations de client à valider', level: 1 }),
    ).toHaveCount(0);

    await page.goto('/chues/dossiers/nouveau');
    await page.getByLabel('Rechercher un client').fill(`Fatou ${NOM_DEMANDE}`);
    await expect(page.getByText('Aucun client ne correspond.')).toBeVisible();
    await page.getByRole('button', { name: 'Demander la création du client' }).click();

    const depot = page.getByRole('dialog');
    await expect(depot.getByLabel(/^Prénom/u)).toHaveValue('Fatou');
    await expect(depot.getByLabel(/^Nom/u)).toHaveValue(NOM_DEMANDE);
    await expect(depot.getByLabel(/^Téléphone/u)).toHaveValue('');
    await depot.getByRole('combobox', { name: 'Banque demandeuse' }).click();
    await page.getByRole('option', { name: NOM_BANQUE }).click();

    // Le téléphone est le SEUL verrou restant : sans l'aller-retour, un bouton
    // désactivé pour une autre raison ferait passer ce parcours.
    const envoyer = depot.getByRole('button', { name: 'Envoyer la demande' });
    await expect(envoyer).toBeDisabled();
    await depot.getByLabel(/^Téléphone/u).fill(TELEPHONE_DEMANDE);
    await expect(envoyer).toBeEnabled();
    await depot.getByLabel(/^Téléphone/u).fill('');
    await expect(envoyer).toBeDisabled();

    await depot.getByLabel(/^Téléphone/u).fill(TELEPHONE_DEMANDE);
    await envoyer.click();
    await expect(depot.getByText(`Fatou ${NOM_DEMANDE} est en attente d’approbation.`)).toBeVisible();
    await depot.getByRole('button', { name: 'Fermer' }).first().click();

    await page.goto('/chues/demandes-clients');
    const carte = page.getByRole('listitem').filter({ hasText: `Fatou ${NOM_DEMANDE}` });
    await expect(carte).toContainText('En attente d’arbitrage par l’administration.');
    await expect(carte.getByRole('button', { name: 'Approuver et créer le prospect' })).toHaveCount(0);
    await expect(carte.getByRole('button', { name: 'Refuser' })).toHaveCount(0);

    expect(
      await compter(
        `SELECT count(*) AS n FROM client_creation_requests
          WHERE nom = $1 AND status = 'PENDING' AND "requestedById" = $2`,
        [NOM_DEMANDE, banquier.id],
      ),
      'un seul dépôt part, celui qui portait un téléphone',
    ).toBe(1);
  });
});

test.describe('parité banque, l’arbitrage du siège', () => {
  test.use({ storageState: administrateur.etat });
  test.describe.configure({ mode: 'serial' });

  test('un refus muet est impossible', async ({ page }) => {
    await page.goto('/chues/demandes-clients');
    await expect(
      page.getByRole('heading', { name: 'Créations de client à valider', level: 1 }),
    ).toBeVisible();
    await page.getByLabel('Recherche').fill(NOM_DEMANDE);

    const carte = page.getByRole('listitem').filter({ hasText: `Fatou ${NOM_DEMANDE}` });
    await carte.getByRole('button', { name: 'Refuser' }).click();

    const refus = page.getByRole('dialog');
    const confirmer = refus.getByRole('button', { name: 'Refuser', exact: true });
    await expect(confirmer, 'un refus sans motif renverrait la banque à son impasse').toBeDisabled();
    await refus.getByLabel(/^Motif du refus/u).fill(MOTIF_REFUS);
    await expect(confirmer).toBeEnabled();
    await confirmer.click();
    await expect(page.getByText('Demande refusée. Le motif est remonté à la banque.')).toBeVisible();

    const arbitree = await ligne<{ status: string; rejectionNote: string | null }>(
      `SELECT status, "rejectionNote" FROM client_creation_requests WHERE nom = $1`,
      [NOM_DEMANDE],
    );
    expect(arbitree.status).toBe('REJECTED');
    expect(arbitree.rejectionNote).toBe(MOTIF_REFUS);
  });
});

test.describe('parité banque, le refus revient à la banque', () => {
  test.use({ storageState: banquier.etat });

  test('la demande refusée porte son motif et aucun geste d’arbitrage', async ({ page }) => {
    await page.goto('/chues/demandes-clients');
    await page.getByRole('button', { name: 'Refusées', exact: true }).click();
    await expect(page).toHaveURL(/statut=REJECTED/u);

    const carte = page.getByRole('listitem').filter({ hasText: `Fatou ${NOM_DEMANDE}` });
    await expect(carte).toContainText(`Refusée : ${MOTIF_REFUS}`);
    await expect(carte).toContainText(`Arbitrée par ${administrateur.nom}`);
    await expect(carte.getByRole('button', { name: 'Approuver et créer le prospect' })).toHaveCount(0);
    await expect(carte.getByRole('button', { name: 'Refuser' })).toHaveCount(0);
  });
});
