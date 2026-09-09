import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { compteDe } from './comptes';
import {
  classeurExcel,
  compter,
  contenuFeuille,
  creerBanque,
  DOSSIER_FIXTURES,
  ecrire,
  effacerBanque,
  feuillesDuClasseur,
  ligne,
  lire,
  marque,
  numero,
  premierDepartement,
} from './donnees-admin';

const administrateur = compteDe('ADMIN');
const teleconseiller = compteDe('COMMERCIAL');
const banquier = compteDe('BANQUE_FINANCE');
const superviseur = compteDe('SUPERVISEUR');

const cle = marque();
const NOM_REPRESENTANT = `Cycle Rep ${cle}`;
const NOM_PROSPECT = `Cycle${cle}`;
const PRENOM_PROSPECT = 'Khady';
const NOM_BANQUE = `Banque cycle ${cle}`;
const REFERENCE = `CYC-${cle}`;
const TELEPHONE_REPRESENTANT = numero();

let banqueId = '';

test.afterAll(async () => {
  await ecrire(
    `DELETE FROM bank_case_transitions WHERE "caseId" IN (SELECT id FROM bank_cases WHERE reference = $1)`,
    [REFERENCE],
  );
  await effacerBanque(banqueId);
  await ecrire(`DELETE FROM import_jobs WHERE "requestedById" = $1`, [administrateur.id]);
  await ecrire(
    `DELETE FROM prospect_journeys WHERE "prospectId" IN (SELECT id FROM prospects WHERE nom = $1)`,
    [NOM_PROSPECT],
  );
  await ecrire(`DELETE FROM prospects WHERE nom = $1`, [NOM_PROSPECT]);
  await ecrire(
    `DELETE FROM rep_call_attempts WHERE "representantId" IN
       (SELECT id FROM representants WHERE "fullName" = $1)`,
    [NOM_REPRESENTANT],
  );
  await ecrire(`DELETE FROM representants WHERE "fullName" = $1`, [NOM_REPRESENTANT]);
});

test.describe('parcours 15, du representant importe a l encaissement', () => {
  test.describe.configure({ mode: 'serial' });

  test('l administrateur importe le representant et l attribue au teleconseiller', async ({
    browser,
  }) => {
    banqueId = await creerBanque(NOM_BANQUE);
    const departement = await premierDepartement();
    const classeur = await classeurExcel(
      `cycle-representants-${cle}.xlsx`,
      [
        'Nom complet',
        'Téléphone',
        'Département',
        'IEF',
        'Notes',
        'Établissement',
        'Statut relation',
        'WhatsApp',
        'Chargé de compte',
      ],
      [
        [
          NOM_REPRESENTANT,
          TELEPHONE_REPRESENTANT,
          departement.name,
          '',
          '',
          'Lycée du cycle',
          '',
          '',
          teleconseiller.identifiant,
        ],
      ],
    );

    const contexte = await browser.newContext({ storageState: administrateur.etat });
    const page = await contexte.newPage();
    await page.goto('/admin/imports');
    await page.getByRole('combobox', { name: 'Entité à importer' }).click();
    await page.getByRole('option', { name: 'Représentants', exact: true }).click();
    await page.getByLabel(/Glissez le classeur ici/u).setInputFiles(classeur);
    await expect(page.getByText('Simulation terminée')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Créer 1 lignes' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Créer 1 lignes' }).click();
    await expect(page.getByText('1 lignes écrites.')).toBeVisible({ timeout: 30_000 });
    await contexte.close();

    const importe = await ligne<{ createdById: string; phoneE164: string; etablissement: string }>(
      `SELECT "createdById", "phoneE164", etablissement FROM representants WHERE "fullName" = $1`,
      [NOM_REPRESENTANT],
    );
    expect(importe.createdById).toBe(teleconseiller.id);
    expect(importe.phoneE164).toBe(TELEPHONE_REPRESENTANT);
    expect(importe.etablissement).toBe('Lycée du cycle');
  });

  test('le teleconseiller qualifie le representant', async ({ browser }) => {
    const contexte = await browser.newContext({ storageState: teleconseiller.etat });
    const page = await contexte.newPage();
    await page.goto('/chues/appels-representants');
    await page.getByLabel('Qui avez-vous appelé ?').fill(NOM_REPRESENTANT);
    await page.getByRole('button', { name: new RegExp(NOM_REPRESENTANT, 'u') }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Ouvrir' }).click();

    await repondre(page, 'Comment s’est passé l’appel ?', 'Joignable');
    await repondre(page, 'L’établissement de la fiche est-il confirmé ?', 'Oui');
    await repondre(page, 'A-t-il déjà été contacté ?', 'Oui');
    await repondre(page, 'Connaît-il l’UES ?', 'Oui');
    await repondre(page, 'Souhaite-t-il être représentant CHUES ?', 'Non');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: `Appel enregistré pour ${NOM_REPRESENTANT}.` }),
    ).toBeVisible();
    await contexte.close();

    const qualifie = await ligne<{
      lastCallOutcome: string | null;
      connaitUES: boolean | null;
      statutQualificationId: string | null;
    }>(
      `SELECT "lastCallOutcome", "connaitUES", "statutQualificationId"
       FROM representants WHERE "fullName" = $1`,
      [NOM_REPRESENTANT],
    );
    expect(qualifie.lastCallOutcome).not.toBeNull();
    expect(qualifie.connaitUES).toBe(true);
    expect(qualifie.statutQualificationId).not.toBeNull();
    expect(
      await compter(
        `SELECT count(*) AS n FROM rep_call_attempts a
         JOIN representants r ON r.id = a."representantId" WHERE r."fullName" = $1`,
        [NOM_REPRESENTANT],
      ),
      "l'appel doit laisser une tentative",
    ).toBe(1);
  });

  test('le teleconseiller ajoute puis convertit le prospect', async ({ browser }) => {
    const representant = await ligne<{ id: string }>(
      `SELECT id FROM representants WHERE "fullName" = $1`,
      [NOM_REPRESENTANT],
    );
    const contexte = await browser.newContext({ storageState: teleconseiller.etat });
    const page = await contexte.newPage();

    await page.goto(`/chues/prospects/nouveau?rep=${representant.id}`);
    await page.getByLabel(/^Prénom/u).fill(PRENOM_PROSPECT);
    await page.getByLabel(/^Nom\s*Obligatoire$/u).fill(NOM_PROSPECT);
    await page.getByLabel(/^Téléphone\s*Obligatoire/u).fill(numero().slice(4));
    await page.getByRole('button', { name: /^Banque/u }).click();
    await page.getByRole('option', { name: NOM_BANQUE }).click();
    await page.getByRole('button', { name: 'Enregistrer ce prospect' }).click();
    await expect(page.getByText(`${PRENOM_PROSPECT} ${NOM_PROSPECT} enregistré.`)).toBeVisible();

    const ajoute = await ligne<{ id: string; representantId: string; phase2Status: string }>(
      `SELECT id, "representantId", "phase2Status" FROM prospects WHERE nom = $1`,
      [NOM_PROSPECT],
    );
    expect(ajoute.representantId).toBe(representant.id);
    expect(ajoute.phase2Status).toBe('PENDING');

    await page.goto('/chues/console');
    await page.getByLabel('Quel prospect avez-vous appelé ?').fill(NOM_PROSPECT);
    await page.getByRole('button', { name: new RegExp(NOM_PROSPECT, 'u') }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Ouvrir' }).click();
    // Le raccourci clavier fait partie du libellé accessible de l'issue.
    await page.getByRole('button', { name: '1 Joignable', exact: true }).click();

    await page.getByLabel(/^Profession/u).fill('Enseignante');
    await page.getByLabel(/^Durée dans la fonction/u).fill('48');
    await cocher(page, 'Fonctionnaire', 'Oui');
    const listes = await ligne<{ syndicat: string; tranche: string }>(
      `SELECT (SELECT sigle FROM syndicats WHERE "isActive" ORDER BY name LIMIT 1) AS syndicat,
              (SELECT label FROM income_bands WHERE "isActive" ORDER BY position LIMIT 1) AS tranche`,
    );
    await choisir(page, /^Syndicat/u, listes.syndicat);
    await cocher(page, 'Engagement en cours à la banque', 'Non');
    await choisir(page, /^Revenu mensuel/u, listes.tranche);
    await page.getByRole('radio', { name: 'Plateforme en ligne' }).check();

    await page.getByRole('button', { name: 'Enregistrer l’adhésion' }).click();
    await expect(page.getByRole('button', { name: 'Enregistrer l’adhésion' })).toHaveCount(0);
    await contexte.close();

    const converti = await ligne<{
      phase2Status: string;
      enrollmentMethod: string | null;
      incomeBandId: string | null;
    }>(`SELECT "phase2Status", "enrollmentMethod", "incomeBandId" FROM prospects WHERE nom = $1`, [
      NOM_PROSPECT,
    ]);
    expect(converti.phase2Status).toBe('METHOD_OBTAINED');
    expect(converti.enrollmentMethod).toBe('PLATFORM');
    expect(converti.incomeBandId).not.toBeNull();
  });

  test('l agent bancaire ouvre le dossier et l encaisse', async ({ browser }) => {
    const contexte = await browser.newContext({ storageState: banquier.etat });
    const page = await contexte.newPage();

    await page.goto('/chues/dossiers/nouveau');
    await page.getByLabel('Rechercher un client').fill(NOM_PROSPECT);
    await page.getByRole('button', { name: `${PRENOM_PROSPECT} ${NOM_PROSPECT}` }).click();
    await page.getByLabel('Référence bancaire').fill(REFERENCE);
    await page.getByRole('button', { name: 'Ouvrir le dossier' }).click();
    await expect(page.getByText(`Dossier ${REFERENCE} ouvert.`)).toBeVisible();

    await page.getByRole('button', { name: 'Passer à « En traitement banque »' }).click();
    await page.getByRole('button', { name: 'Confirmer', exact: true }).click();
    await expect(page.getByText('Dossier passé à l’étape suivante.')).toBeVisible();

    await page.getByRole('button', { name: 'Déclarer l’encaissement' }).click();
    await page.getByLabel('Montant encaissé').fill('750000');
    await page.getByRole('button', { name: 'Confirmer l’encaissement' }).click();
    await expect(page.getByText('Encaissement enregistré.')).toBeVisible();
    await contexte.close();

    const dossier = await ligne<{ amountXof: string; code: string; prospectNom: string }>(
      `SELECT c."amountXof", s.code, p.nom AS "prospectNom"
       FROM bank_cases c
       JOIN bank_case_stages s ON s.id = c."currentStageId"
       JOIN prospects p ON p.id = c."prospectId"
       WHERE c.reference = $1`,
      [REFERENCE],
    );
    expect(dossier.code).toBe('ENCAISSE');
    expect(dossier.amountXof).toBe('750000');
    expect(dossier.prospectNom).toBe(NOM_PROSPECT);
  });

  test('la chaine se relit dans les chiffres et dans le classeur global', async ({ browser }) => {
    const vueSuperviseur = await browser.newContext({ storageState: superviseur.etat });
    const page = await vueSuperviseur.newPage();
    await page.goto('/chues/supervision');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(teleconseiller.nom).first()).toBeVisible();
    await vueSuperviseur.close();

    const contexte = await browser.newContext({ storageState: administrateur.etat });
    const admin = await contexte.newPage();
    await admin.goto('/admin/commerciaux');
    const attente = admin.waitForEvent('download');
    await admin.getByRole('link', { name: 'Export Excel global' }).click();
    const chemin = path.join(DOSSIER_FIXTURES, `cycle-global-${cle}.xlsx`);
    await (await attente).saveAs(chemin);
    await contexte.close();

    const feuilles = await feuillesDuClasseur(chemin);
    const feuilleProspects = feuilles.find((nom) => nom.includes('Prospects'));
    expect(feuilleProspects, `feuilles disponibles : ${feuilles.join(', ')}`).toBeDefined();
    const lignes = await contenuFeuille(chemin, feuilleProspects ?? '');
    const trace = lignes.filter((valeurs) => valeurs.join(' ').includes(NOM_PROSPECT));
    expect(trace, 'le prospect converti doit figurer dans le classeur global').not.toHaveLength(0);

    const journal = await lire<{ projet: string; phase2Status: string }>(
      `SELECT j.projet, j."phase2Status" FROM prospect_journeys j
       JOIN prospects p ON p.id = j."prospectId" WHERE p.nom = $1`,
      [NOM_PROSPECT],
    );
    expect(journal.map((row) => row.projet)).toContain('CHUES');
  });
});

async function repondre(page: Page, question: string, reponse: string): Promise<void> {
  await page
    .getByRole('group', { name: question })
    .getByRole('button', { name: reponse, exact: true })
    .click();
}

async function cocher(page: Page, groupe: string, reponse: string): Promise<void> {
  await page.getByRole('group', { name: groupe }).getByRole('radio', { name: reponse }).check();
}

async function choisir(page: Page, champ: RegExp, option: string): Promise<void> {
  await page.getByRole('combobox', { name: champ }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
