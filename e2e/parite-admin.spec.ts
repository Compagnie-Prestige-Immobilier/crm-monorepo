import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';

import { compteDe } from './comptes';
import {
  compter,
  DOSSIER_FIXTURES,
  ecrire,
  feuillesDuClasseur,
  ligne,
  marque,
} from './donnees-admin';

const cle = marque();
const PREFIXE = `E2E admin ${cle}`;
const CODE_MOTIF = `E2EADM_${cle.toUpperCase()}`;
const LIBELLE_MOTIF = `Issue parite ${cle}`;
const NOM_BANQUE = `Banque parité ${cle}`;
const COURT_BANQUE = `PAR${cle.slice(0, 5).toUpperCase()}`;
const TITRE_ENVOI = `${PREFIXE} envoi`;
const TITRE_PROGRAMME = `${PREFIXE} programme`;
const CHAMP_CONVERSION = `Question ${cle}`;
const SYSTEME = 'Injoignable';
const REGLAGES = ['enrolement.CHUES', 'conversion.champs.CHUES'];

const fiche = (suffixe: string, role: string, actif = true) => ({
  id: `e2e-adm-${cle}-${suffixe}`,
  nom: `${PREFIXE} ${suffixe}`,
  email: `e2e.adm.${cle}.${suffixe}@cpi.sn`,
  role,
  actif,
});

const AGENT = fiche('agent', 'COMMERCIAL');
const BANQUIER = fiche('banque', 'BANQUE_FINANCE');
const RETIRE = fiche('retire', 'COMMERCIAL', false);
const TEMOIN = fiche('temoin', 'DIRECTION');
const FICHES = [AGENT, BANQUIER, RETIRE, TEMOIN];

test.use({ storageState: compteDe('ADMIN').etat });

test.beforeAll(async () => {
  // Condensat inutilisable : aucun de ces comptes ne se connecte, ils sont lus.
  await ecrire(
    `INSERT INTO users (id, email, username, "passwordHash", "fullName", role, "isActive", "updatedAt")
     SELECT f->>'id', f->>'email', split_part(f->>'email', '@', 1), 'sans-connexion', f->>'nom',
            (f->>'role')::"Role", (f->>'actif')::bool, now()
     FROM jsonb_array_elements($1::jsonb) AS f`,
    [JSON.stringify(FICHES)],
  );
  // Identifiants au format UUID : les routes d'écriture des référentiels valident
  // la forme du segment, et un `banque-<clé>` répondrait 422 au premier PATCH.
  await ecrire(
    `INSERT INTO banques (id, name, "shortName", "updatedAt") VALUES ($1, $2, $3, now())`,
    [randomUUID(), NOM_BANQUE, COURT_BANQUE],
  );
  await ecrire(
    `INSERT INTO call_outcome_reasons (id, code, label, effect, "updatedAt")
     VALUES ($1, $2, $3, 'KEEP_OPEN', now())`,
    [randomUUID(), CODE_MOTIF, LIBELLE_MOTIF],
  );
});

test.afterAll(async () => {
  const ids = FICHES.map((f) => f.id);
  await ecrire(
    `DELETE FROM notification_deliveries WHERE "notificationId" IN
       (SELECT id FROM notifications WHERE title LIKE $1)`,
    [`${PREFIXE}%`],
  );
  await ecrire(`DELETE FROM notifications WHERE title LIKE $1`, [`${PREFIXE}%`]);
  await ecrire(`DELETE FROM notification_templates WHERE name LIKE $1`, [`${PREFIXE}%`]);
  await ecrire(`DELETE FROM import_jobs WHERE "fileName" LIKE 'parite-admin-%'`);
  await ecrire(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
  await ecrire(`DELETE FROM banques WHERE name LIKE $1`, [`%${cle}%`]);
  await ecrire(`DELETE FROM call_outcome_reasons WHERE code LIKE $1`, [
    `E2EADM%${cle.toUpperCase()}%`,
  ]);
  await ecrire(`DELETE FROM app_setting_changes WHERE key = ANY($1)`, [REGLAGES]);
  await ecrire(`DELETE FROM app_settings WHERE key = ANY($1)`, [REGLAGES]);
});

async function choisir(page: Page, combo: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name: combo }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

function rangee(page: Page, texte: string) {
  return page.getByRole('table').getByRole('row').filter({ hasText: texte });
}

/**
 * Onglet dont le nom porte « prospect », en-tête en ligne 1, ligne 2 réservée à
 * l'exemple du modèle : le serveur ne lit les données qu'à partir de la ligne 3.
 */
async function classeurGrandPublic(nomFichier: string, lignes: string[][]): Promise<string> {
  mkdirSync(DOSSIER_FIXTURES, { recursive: true });
  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet('Prospects');
  feuille.addRow(['Prénom', 'Nom', 'Téléphone']);
  feuille.addRow(['Aminata', 'Ndiaye', '+221 77 123 45 67']);
  for (const valeurs of lignes) feuille.addRow(valeurs);
  const chemin = path.join(DOSSIER_FIXTURES, nomFichier);
  await classeur.xlsx.writeFile(chemin);
  return chemin;
}

async function viserTemoin(page: Page, titre: string, message: string): Promise<void> {
  const boite = page.getByRole('dialog');
  await boite.getByLabel('Titre').fill(titre);
  await boite.getByLabel('Message').fill(message);
  await choisir(page, 'Public', 'Comptes choisis');
  await boite.getByRole('combobox').last().fill(TEMOIN.nom);
  await page.getByRole('option', { name: new RegExp(TEMOIN.nom, 'u') }).click();
}

test('comptes : la liste se filtre, et un compte refusé ne s’écrit pas', async ({ page }) => {
  await page.goto('/admin/commerciaux');
  await expect(page.getByRole('heading', { name: 'Utilisateurs', level: 1 })).toBeVisible();
  // La v1 ouvrait la liste FILTRÉE sur les téléconseillers : un compte Banque &
  // Finance disparaissait au moment même où le toast annonçait sa création.
  await page.getByLabel('Recherche').fill(PREFIXE);
  await page.waitForURL((url) => url.search.includes('recherche=E2E+admin'));
  await expect(rangee(page, PREFIXE)).toHaveCount(4);
  await choisir(page, 'Rôle', 'Banque & Finance');
  await expect(page).toHaveURL(/role=BANQUE_FINANCE/u);
  await expect(rangee(page, PREFIXE)).toHaveCount(1);
  await expect(rangee(page, BANQUIER.nom)).toContainText(BANQUIER.email);
  await choisir(page, 'Rôle', 'Tous les rôles');
  await choisir(page, 'État du compte', 'Désactivés');
  await expect(page).toHaveURL(/etat=desactives/u);
  await expect(rangee(page, RETIRE.nom)).toContainText('Désactivé');
  await page.reload();
  await expect(page.getByLabel('Recherche')).toHaveValue(PREFIXE);
  await expect(rangee(page, RETIRE.nom)).toHaveCount(1);

  const refuse = `${PREFIXE} refuse`;
  await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
  const boite = page.getByRole('dialog');
  await boite.getByLabel(/^Nom complet/u).fill(refuse);
  await boite.getByLabel(/^Adresse e-mail/u).fill(AGENT.email);
  await boite.getByLabel(/^Identifiant/u).fill(`e2e.adm.${cle}.refuse`);
  await boite.getByLabel(/^Mot de passe/u).fill(`Parite-${cle}`);
  await boite.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(page.getByText('Cette adresse e-mail est déjà utilisée.').first()).toBeVisible();
  await boite.getByLabel(/^Adresse e-mail/u).fill(`e2e.adm.${cle}.refuse@cpi.sn`);
  await boite.getByLabel(/^Mot de passe/u).fill('court');
  await boite.getByRole('button', { name: 'Créer le compte' }).click();
  const bornes = 'Le mot de passe doit faire entre 8 et 24 caractères.';
  await expect(boite.getByText(bornes)).toBeVisible();
  const parNom = `SELECT count(*) AS n FROM users WHERE "fullName" = $1`;
  expect(await compter(parNom, [refuse]), 'un refus ne laisse rien en base').toBe(0);
});

test('listes de référence : recherche sans accent, retrait, remise, doublon refusé', async ({
  page,
}) => {
  await page.goto('/admin/referentiels');
  await expect(page.getByRole('heading', { name: 'Listes de référence', level: 1 })).toBeVisible();
  await page.getByLabel('Recherche').fill(`parite ${cle}`);
  await expect(rangee(page, NOM_BANQUE)).toHaveCount(1);
  await choisir(page, 'Liste', 'Syndicats');
  await expect(page).toHaveURL(/onglet=syndicats/u);
  await expect(page).not.toHaveURL(/recherche=/u);
  await expect(page.getByLabel('Recherche')).toHaveValue('');
  await choisir(page, 'Liste', 'Banques');
  await page.getByLabel('Recherche').fill(COURT_BANQUE);
  const banque = rangee(page, NOM_BANQUE);
  await banque.getByRole('button', { name: 'Retirer du service' }).click();
  await expect(page.getByText('Entrée retirée.')).toBeVisible();
  await expect(banque).toContainText('Retirée');
  const retiree = `SELECT count(*) AS n FROM banques WHERE name = $1 AND NOT "isActive"`;
  expect(await compter(retiree, [NOM_BANQUE])).toBe(1);
  await banque.getByRole('button', { name: 'Remettre en service' }).click();
  await expect(page.getByText('Entrée remise en service.')).toBeVisible();
  await expect(banque).toContainText('En service');
  await page.getByRole('button', { name: 'Nouvelle banque' }).click();
  const boite = page.getByRole('dialog');
  // Le libellé colle sa mention d'obligation : « Nom » seul ne désigne rien.
  await boite.getByLabel(/^NomObligatoire$/u).fill(`${NOM_BANQUE} bis`);
  await boite.getByLabel(/^Nom court/u).fill(COURT_BANQUE);
  await boite.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Cette valeur existe déjà dans cette liste.')).toBeVisible();
  await expect(boite).toBeVisible();
  const parCourt = `SELECT count(*) AS n FROM banques WHERE "shortName" = $1`;
  expect(await compter(parCourt, [COURT_BANQUE])).toBe(1);
});

test('issues d’appel : motif système verrouillé, code et libellé repris refusés', async ({
  page,
}) => {
  await page.goto('/admin/referentiels/issues-appel');
  await expect(rangee(page, 'UNREACHABLE')).toContainText('Système');
  await expect(page.getByRole('button', { name: `Retirer ${SYSTEME}` })).toBeDisabled();
  await page.getByRole('button', { name: 'Nouveau motif' }).click();
  const boite = page.getByRole('dialog');
  await boite.getByLabel(/^Code/u).fill(CODE_MOTIF);
  await boite.getByLabel(/^Libellé/u).fill(`${LIBELLE_MOTIF} bis`);
  await boite.getByRole('button', { name: 'Enregistrer' }).click();
  const codePris = `Le code « ${CODE_MOTIF} » est déjà utilisé par le motif « ${LIBELLE_MOTIF} ».`;
  await expect(page.getByText(codePris)).toBeVisible();
  await boite.getByLabel(/^Code/u).fill(`${CODE_MOTIF}_BIS`);
  await boite.getByLabel(/^Libellé/u).fill(LIBELLE_MOTIF);
  await boite.getByRole('button', { name: 'Enregistrer' }).click();
  const libellePris = `Le libellé « ${LIBELLE_MOTIF} » est déjà porté par le motif « ${CODE_MOTIF} ».`;
  await expect(page.getByText(libellePris)).toBeVisible();
  const motifs = `SELECT count(*) AS n FROM call_outcome_reasons WHERE code LIKE $1`;
  expect(await compter(motifs, [`E2EADM%${cle.toUpperCase()}%`])).toBe(1);
});

test('issues d’appel : le libellé d’un motif système se corrige', async ({ page }) => {
  await page.goto('/admin/referentiels/issues-appel');
  await page.getByRole('button', { name: `Modifier ${SYSTEME}` }).click();
  const boite = page.getByRole('dialog');
  await boite.getByLabel(/^Libellé/u).fill(`${SYSTEME} au téléphone`);
  await boite.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Motif enregistré.')).toBeVisible();
});

test('imports : quatre entités, un modèle réel, un fichier refusé, une simulation reprise', async ({
  page,
}) => {
  const depots: string[] = [];
  page.on('request', (requete) => {
    if (requete.method() === 'POST' && requete.url().includes('/api/v1/imports')) {
      depots.push(requete.url());
    }
  });
  await page.goto('/admin/imports');
  await page.getByRole('combobox', { name: 'Entité à importer' }).click();
  const entites = ['Prospects CHUES', 'Prospects Grand Public', 'Représentants', 'Visites'];
  for (const entite of entites) {
    await expect(page.getByRole('option', { name: entite, exact: true })).toBeVisible();
  }
  await page.getByRole('option', { name: 'Visites', exact: true }).click();
  const consigne = 'Seuls les onglets « BDD VISITES » sont lus, avec l’en-tête en ligne 3.';
  await expect(page.getByText(consigne)).toBeVisible();
  await choisir(page, 'Entité à importer', 'Prospects Grand Public');
  const exiges = 'Seuls le nom et le téléphone sont exigés.';
  await expect(page.getByText(exiges, { exact: false })).toBeVisible();
  const telechargement = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Télécharger le modèle' }).click();
  const modele = await feuillesDuClasseur(await (await telechargement).path());
  expect(modele).toContain('Prospects Grand Public');
  const depot = page.getByLabel(/Glissez le classeur ici/u);
  await depot.setInputFiles({
    name: 'parite-admin-mauvais.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Nom;Téléphone\n'),
  });
  await expect(page.getByText('Seul un classeur Excel (.xlsx) est accepté.')).toBeVisible();
  expect(depots, 'un fichier refusé ne part pas vers le serveur').toEqual([]);
  const nomFichier = `parite-admin-gp-${cle}.xlsx`;
  await depot.setInputFiles(
    await classeurGrandPublic(nomFichier, [
      ['Awa', `Diallo${cle}`, '+221781130010'],
      ['Moussa', `Sow${cle}`, ''],
    ]),
  );
  await expect(page.getByText('Simulation terminée')).toBeVisible({ timeout: 30_000 });
  const refus = 'Le téléphone est obligatoire : c’est lui qui repère les doublons.';
  await expect(page.getByRole('cell', { name: refus })).toBeVisible();
  const semees = `SELECT count(*) AS n FROM prospects WHERE nom LIKE $1`;
  expect(await compter(semees, [`%${cle}`]), 'une simulation n’écrit rien').toBe(0);
  const travail = await ligne<{ mode: string; errorRows: number; createdRows: number }>(
    `SELECT mode::text, "errorRows", "createdRows" FROM import_jobs WHERE "fileName" = $1`,
    [nomFichier],
  );
  expect([travail.mode, travail.errorRows, travail.createdRows]).toEqual(['DRY_RUN', 1, 1]);
  await page.getByRole('button', { name: 'Déposer un autre fichier' }).click();
  await page.getByText('Imports précédents').click();
  await rangee(page, nomFichier).getByRole('button', { name: 'Ouvrir' }).click();
  await expect(page.getByRole('button', { name: 'Créer 1 lignes' })).toBeVisible();
});

test('notifications : envoi confirmé, compte rendu, programmation refusée puis annulée', async ({
  page,
}) => {
  const envois: string[] = [];
  page.on('request', (requete) => {
    const { pathname } = new URL(requete.url());
    if (requete.method() === 'POST' && pathname === '/api/v1/notifications') envois.push(pathname);
  });
  await page.goto('/admin/notifications');
  await page.getByRole('button', { name: 'Nouvelle notification' }).click();
  const boite = page.getByRole('dialog');
  const continuer = boite.getByRole('button', { name: 'Continuer' });
  await expect(continuer).toBeDisabled();
  await expect(continuer).toHaveAttribute('title', 'Le titre est obligatoire.');
  await boite.getByLabel('Titre').fill(TITRE_ENVOI);
  await expect(continuer).toHaveAttribute('title', 'Le message est obligatoire.');
  await viserTemoin(page, TITRE_ENVOI, 'Vérification automatique, aucune action attendue.');
  await expect(boite.getByText('1 compte choisi.')).toBeVisible();
  await continuer.click();
  await expect(boite.getByText('Cet envoi s’adresse à 1 personne.')).toBeVisible();
  expect(envois, 'aucun envoi ne part du premier temps').toEqual([]);

  await boite.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Notification envoyée.')).toBeVisible();
  const envoi = await ligne<{ audience: string; ids: string[]; livrees: string | null }>(
    `SELECT n.audience::text, n."audienceUserIds" AS ids,
       (SELECT string_agg(d."userId", ',') FROM notification_deliveries d
          WHERE d."notificationId" = n.id) AS livrees
     FROM notifications n WHERE n.title = $1`,
    [TITRE_ENVOI],
  );
  expect([envoi.audience, envoi.ids, envoi.livrees]).toEqual(['USERS', [TEMOIN.id], TEMOIN.id]);
  const envoye = rangee(page, TITRE_ENVOI);
  await expect(envoye).toContainText('1 compte choisi');
  await envoye.getByRole('button', { name: new RegExp(TITRE_ENVOI, 'u') }).click();
  const detail = page.getByRole('dialog');
  await expect(detail.getByRole('heading', { name: TITRE_ENVOI })).toBeVisible();
  await expect(detail.getByRole('row').filter({ hasText: TEMOIN.nom })).toHaveCount(1);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Nouvelle notification' }).click();
  await viserTemoin(page, TITRE_PROGRAMME, 'Programmation de vérification.');
  await boite.getByRole('checkbox', { name: 'Programmer l’envoi' }).check();
  // Le champ de date n'a aucun nom accessible : son type est le seul repère.
  const quand = boite.locator('input[type="datetime-local"]');
  await quand.fill('2020-01-01T09:00');
  await expect(boite.getByText('Choisissez une date et une heure à venir.')).toBeVisible();
  await expect(continuer).toBeDisabled();
  await quand.fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 16));
  await continuer.click();
  await boite.getByRole('button', { name: 'Programmer' }).click();
  await expect(page.getByText('Notification programmée.')).toBeVisible();
  const programme = rangee(page, TITRE_PROGRAMME);
  await expect(programme).toContainText('Programmée');
  await programme.getByRole('button', { name: 'Annuler' }).click();
  const confirmation = page.getByRole('dialog');
  await expect(confirmation.getByRole('heading')).toContainText(TITRE_PROGRAMME);
  await confirmation.getByRole('button', { name: 'Annuler l’envoi' }).click();
  await expect(page.getByText('Envoi annulé.')).toBeVisible();
  await expect(programme).toContainText('Annulée');
  const annule = await ligne<{ status: string; cancelledAt: Date | null }>(
    `SELECT status::text, "cancelledAt" FROM notifications WHERE title = $1`,
    [TITRE_PROGRAMME],
  );
  expect(annule.status).toBe('CANCELLED');
  expect(annule.cancelledAt).not.toBeNull();
});

test('notifications : un gabarit se crée, pré-remplit le composeur, l’onglet vit dans l’URL', async ({
  page,
}) => {
  const NOM_GABARIT = `${PREFIXE} gabarit`;
  await page.goto('/admin/notifications');
  await page.getByRole('tab', { name: 'Gabarits' }).click();
  await expect(page).toHaveURL(/onglet=gabarits/u);
  await page.getByRole('button', { name: 'Nouveau gabarit' }).click();
  const boite = page.getByRole('dialog', { name: 'Nouveau gabarit' });
  await boite.getByLabel(/^Nom/u).fill(NOM_GABARIT);
  await boite.getByLabel(/^Titre/u).fill(`${PREFIXE} titre {prenom}`);
  await boite.getByLabel(/^Message/u).fill(`${PREFIXE} corps`);
  await boite.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Gabarit enregistré.')).toBeVisible();
  await expect(page.getByText(NOM_GABARIT)).toBeVisible();
  const gabarit = await ligne<{ title: string; category: string }>(
    'SELECT "titleTemplate" AS title, category::text FROM notification_templates WHERE name = $1',
    [NOM_GABARIT],
  );
  expect(gabarit.title).toBe(`${PREFIXE} titre {prenom}`);
  expect(gabarit.category).toBe('ANNONCE');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Gabarits' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Nouvelle notification' }).click();
  const composeur = page.getByRole('dialog', { name: 'Nouvelle notification' });
  await composeur.getByLabel('Partir d’un gabarit').click();
  await page.getByRole('option', { name: NOM_GABARIT }).click();
  await expect(composeur.getByLabel(/^Titre/u)).toHaveValue(`${PREFIXE} titre {prenom}`);
  await page.keyboard.press('Escape');

  await page.getByRole('tab', { name: 'Boîte de réception' }).click();
  await expect(page).toHaveURL(/onglet=reception/u);
  await page.getByRole('tab', { name: 'Envois' }).click();
  await expect(page).not.toHaveURL(/onglet=/u);
});

test('paramètres et enrôlement : la racine mène aux comptes, la fréquence se relit', async ({
  page,
}) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/commerciaux$/u);

  // La purge n'est jamais déclenchée ici : seul son avertissement est lu.
  await page.goto('/admin/parametres');
  await expect(page.getByText('Irréversible', { exact: true })).toBeVisible();

  await page.goto('/admin/enrolement');
  await expect(page.getByRole('tab', { name: 'Grand Public' })).toBeVisible();
  const sansJeton = 'ne sont pas renseignés dans l’environnement du serveur';
  await expect(page.getByRole('alert').filter({ hasText: sansJeton })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tirer maintenant' })).toBeDisabled();
  // Le réglage est global et survit aux exécutions : viser une valeur différente de l'actuelle.
  const frequence = page.getByLabel('Tirer toutes les');
  await expect(frequence).toHaveValue(/^\d+$/u);
  const voulue = (await frequence.inputValue()) === '30' ? 20 : 30;
  await frequence.fill(String(voulue));
  await frequence.blur();
  await expect(page.getByText('Réglages enregistrés.')).toBeVisible();
  const reglage = await ligne<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'enrolement.CHUES'`,
  );
  expect((JSON.parse(reglage.value) as { frequenceMinutes: number }).frequenceMinutes).toBe(voulue);
});

test('conversion : un champ ajouté se relit en base, puis se retire', async ({ page }) => {
  const libres = async (): Promise<string[]> => {
    const reglage = await ligne<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'conversion.champs.CHUES'`,
    );
    const stocke = JSON.parse(reglage.value) as { libres?: { libelle: string }[] };
    return (stocke.libres ?? []).map((champ) => champ.libelle);
  };
  const enregistrer = async (): Promise<void> => {
    const reponse = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && r.url().includes('/api/v1/champs-conversion/'),
    );
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    expect((await reponse).ok()).toBe(true);
    await expect(page.getByText('Formulaire enregistré.').first()).toBeVisible();
  };
  await page.goto('/admin/champs-conversion');
  await page.getByRole('button', { name: 'Ajouter un champ' }).click();
  await page.getByLabel('Libellé').fill(CHAMP_CONVERSION);
  await enregistrer();
  expect(await libres()).toContain(CHAMP_CONVERSION);
  await page.getByRole('button', { name: `Retirer ${CHAMP_CONVERSION}` }).click();
  await enregistrer();
  expect(await libres()).not.toContain(CHAMP_CONVERSION);
});
