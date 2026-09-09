import path from 'node:path';

import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import {
  compter,
  contenuFeuille,
  dossierParReference,
  creerBanque,
  creerProspectEnrole,
  creerRepresentant,
  creerSyndicat,
  DOSSIER_FIXTURES,
  ecrire,
  effacerBanque,
  effacerRepresentants,
  feuillesDuClasseur,
  ligne,
  lire,
  marque,
  numero,
  premierDepartement,
  transitionsDuDossier,
} from './donnees-admin';

const banquier = compteDe('BANQUE_FINANCE');
const administrateur = compteDe('ADMIN');

const cle = marque();
const NOM_BANQUE = `Banque E2E ${cle}`;
const NOM_CLIENT = `Ndiaye${cle}`;
const NOM_DEMANDE = `Inconnu${cle}`;
const NOM_REPRESENTANT = `Repr E2E ${cle}`;
const NOM_SYNDICAT = `Syndicat E2E ${cle}`;
const REFERENCE = `DOS-${cle}`;
const REFERENCE_REJET = `REJ-${cle}`;

let banqueId = '';
let prospectId = '';
let prospectRejetId = '';

test.beforeAll(async () => {
  banqueId = await creerBanque(NOM_BANQUE);
  const departement = await premierDepartement();
  await creerRepresentant({
    nom: NOM_REPRESENTANT,
    telephone: numero(),
    departementId: departement.id,
    proprietaireId: administrateur.id,
  });
  await creerSyndicat(NOM_SYNDICAT);
  prospectId = await creerProspectEnrole({
    nom: NOM_CLIENT,
    prenom: 'Aminata',
    telephone: numero(),
    banqueId,
    proprietaireId: banquier.id,
  });
  prospectRejetId = await creerProspectEnrole({
    nom: NOM_CLIENT,
    prenom: 'Ousmane',
    telephone: numero(),
    banqueId,
    proprietaireId: banquier.id,
  });
});

test.afterAll(async () => {
  await ecrire(`DELETE FROM notifications WHERE body LIKE $1`, [`%${NOM_DEMANDE}%`]);
  await effacerBanque(banqueId);
  await effacerRepresentants(`${NOM_REPRESENTANT}%`);
  await ecrire(`DELETE FROM syndicats WHERE name = $1`, [NOM_SYNDICAT]);
});

// Chaque test reprend le dossier ouvert par le precedent : une execution
// partielle vaudrait mieux etre sautee qu'executee sur des donnees absentes.
test.describe.configure({ mode: 'serial' });

test.describe('parcours 10, dossiers bancaires', () => {
  test.use({ storageState: banquier.etat });

  test('ouverture, conflit de revision et encaissement', async ({ page, browser }) => {
    await page.goto('/chues/banque');
    await expect(page.getByRole('heading', { name: 'Vue d’ensemble', level: 1 })).toBeVisible();

    await page.goto('/chues/dossiers/nouveau');
    await page.getByLabel('Rechercher un client').fill(NOM_CLIENT);
    await page.getByRole('button', { name: `Aminata ${NOM_CLIENT}` }).click();
    await page.getByLabel('Référence bancaire').fill(REFERENCE);
    await page.getByRole('button', { name: 'Ouvrir le dossier' }).click();
    await expect(page.getByText(`Dossier ${REFERENCE} ouvert.`)).toBeVisible();

    const ouvert = await dossierParReference(REFERENCE);
    expect(ouvert.code).toBe('A_TRAITER');
    expect(ouvert.rev).toBe(1);
    expect(
      await compter(`SELECT count(*) AS n FROM bank_cases WHERE "prospectId" = $1`, [prospectId]),
    ).toBe(1);
    await expect(page).toHaveURL(new RegExp(`${ouvert.id}$`, 'u'));

    // Deux agents lisent la revision 1. Pendant que le premier avance, le
    // second rejette : sa revision est perimee et son rejet doit etre refuse
    // sans effacer l'avancement.
    const contexteRival = await browser.newContext({ storageState: banquier.etat });
    const rival = await contexteRival.newPage();
    await rival.goto(`/chues/dossiers/${ouvert.id}`);
    await expect(rival.getByRole('button', { name: 'Rejeter le dossier' })).toBeVisible();

    await page.getByRole('button', { name: 'Passer à « En traitement banque »' }).click();
    await page.getByRole('button', { name: 'Confirmer', exact: true }).click();
    await expect(page.getByText('Dossier passé à l’étape suivante.')).toBeVisible();

    await rival.getByRole('button', { name: 'Rejeter le dossier' }).click();
    await rival.getByRole('combobox', { name: 'Motif de rejet' }).click();
    await rival.getByRole('option', { name: 'Document manquant' }).click();
    await rival.getByRole('button', { name: 'Rejeter définitivement' }).click();
    await expect(
      rival.getByText('Le dossier a été modifié entre-temps par un autre utilisateur.'),
    ).toBeVisible();
    await contexteRival.close();

    const avance = await dossierParReference(REFERENCE);
    expect(avance.code).toBe('EN_TRAITEMENT_BANQUE');
    expect(avance.rev).toBe(2);
    expect(avance.rejectionReasonId, 'le rejet refusé ne doit rien écrire').toBeNull();
    expect(await transitionsDuDossier(avance.id)).toBe(2);

    await page.getByRole('button', { name: 'Déclarer l’encaissement' }).click();
    await page.getByLabel('Montant encaissé').fill('1200000');
    await page.getByRole('button', { name: 'Confirmer l’encaissement' }).click();
    await expect(page.getByText('Encaissement enregistré.')).toBeVisible();

    const encaisse = await dossierParReference(REFERENCE);
    expect(encaisse.code).toBe('ENCAISSE');
    expect(encaisse.amountXof).toBe('1200000');
    expect(encaisse.rev).toBe(3);
    expect(await transitionsDuDossier(encaisse.id)).toBe(3);
  });

  test('rejet motive, montant remis a zero', async ({ page }) => {
    await page.goto('/chues/dossiers/nouveau');
    await page.getByLabel('Rechercher un client').fill(NOM_CLIENT);
    await page.getByRole('button', { name: `Ousmane ${NOM_CLIENT}` }).click();
    await page.getByLabel('Référence bancaire').fill(REFERENCE_REJET);
    await page.getByRole('button', { name: 'Ouvrir le dossier' }).click();
    await expect(page.getByText(`Dossier ${REFERENCE_REJET} ouvert.`)).toBeVisible();

    await page.getByRole('button', { name: 'Rejeter le dossier' }).click();
    await page.getByRole('combobox', { name: 'Motif de rejet' }).click();
    await page.getByRole('option', { name: 'Document manquant' }).click();
    await page.getByRole('button', { name: 'Rejeter définitivement' }).click();
    await expect(page.getByText('Dossier rejeté. Montant : 0 FCFA.')).toBeVisible();

    const rejete = await dossierParReference(REFERENCE_REJET);
    expect(rejete.code).toBe('REJETE');
    expect(rejete.amountXof).toBe('0');
    const motif = await ligne<{ label: string }>(
      `SELECT label FROM bank_rejection_reasons WHERE id = $1`,
      [rejete.rejectionReasonId],
    );
    expect(motif.label).toBe('Document manquant');
    expect(
      await compter(`SELECT count(*) AS n FROM bank_cases WHERE "prospectId" = $1`, [
        prospectRejetId,
      ]),
    ).toBe(1);
  });

  test('la liste et le classeur portent les deux dossiers', async ({ page }) => {
    await page.goto('/chues/dossiers');
    await expect(page.getByRole('heading', { name: 'Dossiers bancaires', level: 1 })).toBeVisible();
    await expect(page.getByRole('cell', { name: REFERENCE, exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: REFERENCE_REJET, exact: true })).toBeVisible();

    await page.goto('/chues/dossiers/export');
    const attente = page.waitForEvent('download');
    await page
      .getByRole('link', { name: 'Télécharger le classeur des dossiers bancaires' })
      .click();
    const chemin = path.join(DOSSIER_FIXTURES, `dossiers-${cle}.xlsx`);
    await (await attente).saveAs(chemin);

    expect(await feuillesDuClasseur(chemin)).toEqual(['Dossiers', 'Historique', 'Synthèse']);
    const lignes = await contenuFeuille(chemin, 'Dossiers');
    const encaisse = lignes.find((valeurs) => valeurs.includes(REFERENCE));
    const rejete = lignes.find((valeurs) => valeurs.includes(REFERENCE_REJET));
    expect(encaisse, `${REFERENCE} absent de la feuille Dossiers`).toBeDefined();
    expect(encaisse?.join(' ')).toContain(`Aminata ${NOM_CLIENT}`);
    expect(encaisse?.join(' ')).toContain('1200000');
    expect(rejete?.join(' ')).toContain('Document manquant');

    const historique = await contenuFeuille(chemin, 'Historique');
    expect(historique.filter((valeurs) => valeurs.includes(REFERENCE))).toHaveLength(3);
  });

  test('une demande de creation part vers le siege', async ({ page }) => {
    for (const prenom of ['Fatou', 'Moussa']) {
      await page.goto('/chues/dossiers/nouveau');
      await page.getByLabel('Rechercher un client').fill(`${prenom} ${NOM_DEMANDE}`);
      await page.getByRole('button', { name: 'Demander la création du client' }).click();
      const boite = page.getByRole('dialog');
      await expect(boite.getByLabel(/^Prénom/u)).toHaveValue(prenom);
      await expect(boite.getByLabel(/^Nom/u)).toHaveValue(NOM_DEMANDE);
      await boite.getByLabel(/^Téléphone/u).fill(numero());
      await boite.getByRole('combobox', { name: 'Banque demandeuse' }).click();
      await page.getByRole('option', { name: NOM_BANQUE }).click();
      await boite.getByRole('button', { name: 'Envoyer la demande' }).click();
      await expect(
        boite.getByText(`${prenom} ${NOM_DEMANDE} est en attente d’approbation.`),
      ).toBeVisible();
      // Le pied du dialogue et sa croix portent le meme libelle.
      await boite.getByRole('button', { name: 'Fermer' }).first().click();
    }

    expect(
      await compter(
        `SELECT count(*) AS n FROM client_creation_requests
         WHERE nom = $1 AND status = 'PENDING' AND "requestedById" = $2`,
        [NOM_DEMANDE, banquier.id],
      ),
    ).toBe(2);
  });
});

test.describe('parcours 10, arbitrage des creations de client', () => {
  test.use({ storageState: administrateur.etat });

  test('approbation et refus laissent leur trace et leur avis', async ({ page }) => {
    await page.goto('/chues/demandes-clients');
    await expect(
      page.getByRole('heading', { name: 'Créations de client à valider', level: 1 }),
    ).toBeVisible();
    await page.getByLabel('Recherche').fill(NOM_DEMANDE);

    const acceptee = page.getByRole('listitem').filter({ hasText: `Fatou ${NOM_DEMANDE}` });
    await acceptee.getByRole('button', { name: 'Approuver et créer le prospect' }).click();
    const approbation = page.getByRole('dialog');
    await approbation.getByLabel('Chercher le représentant de rattachement').fill(NOM_REPRESENTANT);
    await approbation.getByRole('button', { name: /Représentant de rattachement/u }).click();
    await page.getByRole('option', { name: NOM_REPRESENTANT }).click();
    await approbation.getByRole('combobox', { name: 'Syndicat' }).click();
    await page.getByRole('option', { name: NOM_SYNDICAT }).click();
    await approbation.getByRole('button', { name: 'Approuver et créer le prospect' }).click();
    await expect(page.getByText(`Prospect créé pour Fatou ${NOM_DEMANDE}.`)).toBeVisible();

    const cree = await ligne<{ origin: string; originLabel: string; phase2Status: string }>(
      `SELECT p.origin, p."originLabel", p."phase2Status" FROM prospects p
       JOIN client_creation_requests d ON d."createdProspectId" = p.id
       WHERE d.nom = $1 AND d.prenom = 'Fatou'`,
      [NOM_DEMANDE],
    );
    expect(cree.origin).toBe('BANQUE');
    expect(cree.originLabel).toBe(NOM_BANQUE);

    const refusee = page.getByRole('listitem').filter({ hasText: `Moussa ${NOM_DEMANDE}` });
    await refusee.getByRole('button', { name: 'Refuser' }).click();
    const refus = page.getByRole('dialog');
    await refus.getByLabel(/^Motif du refus/u).fill('Numéro déjà rattaché à un autre client.');
    await refus.getByRole('button', { name: 'Refuser' }).click();
    await expect(
      page.getByText('Demande refusée. Le motif est remonté à la banque.'),
    ).toBeVisible();

    const arbitrees = await lire<{ prenom: string; status: string; rejectionNote: string | null }>(
      `SELECT prenom, status, "rejectionNote" FROM client_creation_requests
       WHERE nom = $1 ORDER BY prenom ASC`,
      [NOM_DEMANDE],
    );
    expect(arbitrees.map((row) => `${row.prenom}:${row.status}`)).toEqual([
      'Fatou:APPROVED',
      'Moussa:REJECTED',
    ]);
    expect(arbitrees[1]?.rejectionNote).toBe('Numéro déjà rattaché à un autre client.');

    const avis = await lire<{ title: string; audienceUserIds: string[] | null }>(
      `SELECT title, "audienceUserIds" FROM notifications WHERE body LIKE $1 ORDER BY "createdAt" ASC`,
      [`%${NOM_DEMANDE}%`],
    );
    expect(avis.map((row) => row.title)).toEqual([
      'Demande de création de client',
      'Demande de création de client',
      'Client créé',
      'Demande de création refusée',
    ]);
    // Les deux avis d'arbitrage repartent nominativement vers l'agent bancaire.
    for (const arbitrage of avis.slice(2)) {
      expect(arbitrage.audienceUserIds).toContain(banquier.id);
    }
  });
});
