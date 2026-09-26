import { randomInt, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import type { QueryResultRow } from 'pg';

import { avecBase, BASE_URL } from './comptes';

export const DOSSIER_FIXTURES = path.join(__dirname, 'fixtures');

/**
 * `browser.newContext` hérite du `storageState` posé par `test.use` : sans cet
 * état vide, un compte fraîchement créé agirait sous la session déjà ouverte.
 */
export function contexteAnonyme(browser: Browser, adresse: string): Promise<BrowserContext> {
  return browser.newContext({
    baseURL: BASE_URL,
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { 'X-Forwarded-For': adresse },
  });
}

export async function connexion(
  page: Page,
  identifiant: string,
  motDePasse: string,
): Promise<void> {
  await page.goto('/connexion');
  await page.getByLabel('E-mail ou identifiant').fill(identifiant);
  await page.getByLabel('Mot de passe', { exact: true }).fill(motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

export interface FicheCompte {
  nom: string;
  identifiant: string;
  motDePasse: string;
  role?: string;
}

/** Session propre d'un compte créé par le parcours, ouverte par le formulaire. */
export async function sessionDe(
  browser: Browser,
  adresse: string,
  compte: FicheCompte,
): Promise<{ contexte: BrowserContext; vue: Page }> {
  const contexte = await contexteAnonyme(browser, adresse);
  const vue = await contexte.newPage();
  await connexion(vue, compte.identifiant, compte.motDePasse);
  await expect(vue.getByRole('button', { name: `Compte de ${compte.nom}` })).toBeVisible();
  return { contexte, vue };
}

export async function doterPortefeuille(
  marqueCourse: string,
  proprietaireId: string,
): Promise<{ banqueId: string; representant: string }> {
  const banqueId = await creerBanque(`Banque liste ${marqueCourse}`);
  const representant = `Portefeuille ${marqueCourse}`;
  await creerProspectEnrole({
    nom: `Portefeuille${marqueCourse}`,
    prenom: 'Aissatou',
    telephone: numero(),
    banqueId,
    proprietaireId,
  });
  await creerRepresentant({
    nom: representant,
    telephone: numero(),
    departementId: (await premierDepartement()).id,
    proprietaireId,
  });
  return { banqueId, representant };
}

/** Dépôt d'un classeur sur `/admin/imports`, en simulation d'abord. */
export async function deposerClasseur(page: Page, entite: string, chemin: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Classeur à importer' }).click();
  await page.getByRole('option', { name: entite, exact: true }).click();
  await page.getByLabel(/Glissez le classeur ici/u).setInputFiles(chemin);
}

export async function creerCompteParEcran(page: Page, fiche: FicheCompte): Promise<void> {
  await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
  const boite = page.getByRole('dialog');
  await boite.getByLabel(/^Nom complet/u).fill(fiche.nom);
  await boite.getByLabel(/^Adresse e-mail/u).fill(`${fiche.identifiant}@cpi.sn`);
  await boite.getByLabel(/^Identifiant/u).fill(fiche.identifiant);
  await boite.getByLabel(/^Mot de passe/u).fill(fiche.motDePasse);
  if (fiche.role !== undefined) {
    await boite.getByRole('combobox', { name: /^Rôle/u }).click();
    await page.getByRole('option', { name: fiche.role }).click();
  }
  await boite.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(page.getByText(`Compte de ${fiche.nom} créé.`)).toBeVisible();
}

export async function ouvrirMenuCompte(page: Page, nom: string, action: string): Promise<void> {
  await page.getByRole('button', { name: `Actions pour ${nom}` }).click();
  await page.getByRole('menuitem', { name: action }).click();
}

export async function poserRole(page: Page, nom: string, role: string): Promise<void> {
  await ouvrirMenuCompte(page, nom, 'Modifier');
  const boite = page.getByRole('dialog');
  await boite.getByRole('combobox', { name: /^Rôle/u }).click();
  await page.getByRole('option', { name: role }).click();
  await boite.getByRole('button', { name: 'Enregistrer' }).click();
}

export async function creerStatutQualification(
  page: Page,
  libelle: string,
  reessai: string,
): Promise<void> {
  await page.getByRole('button', { name: 'Nouveau statut' }).click();
  const statut = page.getByRole('dialog');
  await statut.getByLabel(/^Libellé/u).fill(libelle);
  await statut.getByRole('combobox', { name: /^Réessai proposé/u }).click();
  await page.getByRole('option', { name: reessai, exact: true }).click();
  await statut.getByRole('button', { name: 'Enregistrer' }).click();
}

/**
 * La simulation d'abord, puis l'écriture : le bouton porte le nombre de lignes.
 * L'historique replié porte les mêmes états : seul le premier est le travail en cours.
 */
export async function appliquerImport(page: Page, bouton: string, ecrites: string): Promise<void> {
  await expect(page.getByText('Simulation terminée').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: bouton }).click();
  await page.getByRole('dialog').getByRole('button', { name: bouton }).click();
  await expect(page.getByText(ecrites).first()).toBeVisible({ timeout: 30_000 });
}

export interface DossierLu {
  id: string;
  rev: number;
  amountXof: string | null;
  code: string;
  rejectionReasonId: string | null;
}

export async function dossierParReference(reference: string): Promise<DossierLu> {
  return ligne<DossierLu>(
    `SELECT c.id, c.rev, c."amountXof", s.code, c."rejectionReasonId"
     FROM bank_cases c JOIN bank_case_stages s ON s.id = c."currentStageId"
     WHERE c.reference = $1`,
    [reference],
  );
}

export function transitionsDuDossier(dossierId: string): Promise<number> {
  return compter(`SELECT count(*) AS n FROM bank_case_transitions WHERE "caseId" = $1`, [
    dossierId,
  ]);
}

export interface CompteLu {
  id: string;
  role: string;
  isActive: boolean;
  deletedAt: string | null;
}

export async function compteParIdentifiant(identifiant: string): Promise<CompteLu> {
  return ligne<CompteLu>(
    `SELECT id, role, "isActive", "deletedAt" FROM users WHERE username = $1`,
    [identifiant],
  );
}

/** Suffixe court accolé à chaque nom créé : deux exécutions ne se croisent pas. */
export function marque(): string {
  return randomUUID().slice(0, 8);
}

export async function lire<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  let lignes: T[] = [];
  await avecBase(async (client) => {
    const resultat = await client.query<T>(sql, params);
    lignes = resultat.rows;
  });
  return lignes;
}

export async function ligne<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  const lignes = await lire<T>(sql, params);
  if (lignes[0] === undefined) throw new Error(`aucune ligne : ${sql}`);
  return lignes[0];
}

export async function ecrire(sql: string, params: unknown[] = []): Promise<void> {
  await avecBase(async (client) => {
    await client.query(sql, params);
  });
}

export async function compter(sql: string, params: unknown[] = []): Promise<number> {
  const { n } = await ligne<{ n: string }>(sql, params);
  return Number(n);
}

/** Un identifiant du même format que ceux du serveur, lisible dans un dump. */
function identifiant(): string {
  return randomUUID();
}

/**
 * Numéro sénégalais valide et libre : le serveur normalise et refuse tout ce
 * qui n'est pas neuf chiffres, ce qu'un suffixe hexadécimal ne donne pas.
 */
export function numero(): string {
  return `+22177${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
}

export async function creerBanque(nom: string): Promise<string> {
  const id = identifiant();
  await ecrire(
    `INSERT INTO banques (id, name, "shortName", "updatedAt") VALUES ($1, $2, $3, now())`,
    [id, nom, nom.slice(0, 16)],
  );
  return id;
}

export async function creerSyndicat(nom: string): Promise<string> {
  const id = identifiant();
  await ecrire(`INSERT INTO syndicats (id, name, sigle, "updatedAt") VALUES ($1, $2, $3, now())`, [
    id,
    nom,
    nom.slice(0, 12),
  ]);
  return id;
}

export async function premierDepartement(): Promise<{ id: string; name: string }> {
  return ligne<{ id: string; name: string }>(
    `SELECT id, name FROM departements ORDER BY name ASC LIMIT 1`,
  );
}

export async function creerRepresentant(entree: {
  nom: string;
  telephone: string;
  departementId: string;
  proprietaireId: string;
}): Promise<string> {
  const id = identifiant();
  await ecrire(
    `INSERT INTO representants (id, "fullName", "phoneE164", "departementId", "createdById",
       "clientCreatedAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, now(), now())`,
    [id, entree.nom, entree.telephone, entree.departementId, entree.proprietaireId],
  );
  return id;
}

/**
 * Prospect enrôlé sur CHUES : la recherche de client des dossiers bancaires
 * exige `phase2Status = METHOD_OBTAINED` et un parcours sur le projet.
 */
export async function creerProspectEnrole(entree: {
  nom: string;
  prenom: string;
  telephone: string;
  banqueId: string;
  proprietaireId: string;
  representantId?: string;
}): Promise<string> {
  const id = identifiant();
  await ecrire(
    `INSERT INTO prospects (id, nom, prenom, "phoneE164", "banqueId", "representantId",
       "createdById", "clientCreatedAt", "updatedAt", "phase2Status", "enrollmentMethod", projet)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now(), 'METHOD_OBTAINED', 'PLATFORM', 'CHUES')`,
    [
      id,
      entree.nom,
      entree.prenom,
      entree.telephone,
      entree.banqueId,
      entree.representantId ?? null,
      entree.proprietaireId,
    ],
  );
  await ecrire(
    `INSERT INTO prospect_journeys (id, "prospectId", projet, statut, consent, "phase2Status",
       "enrollmentMethod", "createdAt", "updatedAt")
     VALUES ($1, $2, 'CHUES', 'NOUVEAU', 'NON_DEMANDE', 'METHOD_OBTAINED', 'PLATFORM', now(), now())`,
    [identifiant(), id],
  );
  return id;
}

/** Ordre topologique : ce qui référence part avant ce qui est référencé. */
/** Une inscription validée sur la plateforme (décision datée), rapprochée ou non d'un prospect. */
export async function creerInscriptionValidee(entree: {
  nom: string;
  prenom: string;
  telephone: string;
  prospectId: string | null;
}): Promise<string> {
  const id = identifiant();
  await ecrire(
    `INSERT INTO inscriptions_plateforme
       (id, projet, "identifiantDistant", nom, prenom, "phoneE164", "statutDistant", "decideeLe",
        "prospectId", "chargeUtile", "dernierTirageAt", "updatedAt")
     VALUES ($1, 'CHUES', $2, $3, $4, $5, 'validated', now(), $6, '{}', now(), now())`,
    [id, `e2e-${id}`, entree.nom, entree.prenom, entree.telephone, entree.prospectId],
  );
  return id;
}

export async function effacerBanque(banqueId: string): Promise<void> {
  await ecrire(
    `DELETE FROM courriels WHERE "objetId" IN (SELECT id FROM bank_cases WHERE "processingBankId" = $1)
       OR "objetId" IN (SELECT i.id FROM inscriptions_plateforme i
            JOIN prospects p ON p.id = i."prospectId" WHERE p."banqueId" = $1)`,
    [banqueId],
  );
  await ecrire(
    `DELETE FROM inscriptions_plateforme WHERE "prospectId" IN
       (SELECT id FROM prospects WHERE "banqueId" = $1)
       OR "phoneE164" IN (SELECT "phoneE164" FROM prospects WHERE "banqueId" = $1)`,
    [banqueId],
  );
  await ecrire(
    `DELETE FROM bank_case_transitions WHERE "caseId" IN
       (SELECT id FROM bank_cases WHERE "processingBankId" = $1)`,
    [banqueId],
  );
  await ecrire(`DELETE FROM bank_cases WHERE "processingBankId" = $1`, [banqueId]);
  await ecrire(`DELETE FROM client_creation_requests WHERE "banqueId" = $1`, [banqueId]);
  await ecrire(
    `DELETE FROM prospect_journeys WHERE "prospectId" IN
       (SELECT id FROM prospects WHERE "banqueId" = $1)`,
    [banqueId],
  );
  await ecrire(`DELETE FROM prospects WHERE "banqueId" = $1`, [banqueId]);
  await ecrire(`DELETE FROM banques WHERE id = $1`, [banqueId]);
}

export async function effacerRepresentants(motif: string): Promise<void> {
  await ecrire(
    `DELETE FROM prospect_journeys WHERE "prospectId" IN
       (SELECT id FROM prospects WHERE "representantId" IN
          (SELECT id FROM representants WHERE "fullName" LIKE $1))`,
    [motif],
  );
  await ecrire(
    `DELETE FROM prospects WHERE "representantId" IN
       (SELECT id FROM representants WHERE "fullName" LIKE $1)`,
    [motif],
  );
  await ecrire(`DELETE FROM representants WHERE "fullName" LIKE $1`, [motif]);
}

/**
 * Tout ce qu'un parcours d'administration a semé, dans l'ordre des clés
 * étrangères. `marque` sert de filtre : rien de semé par le seed n'y répond.
 */
export async function effacerTraces(marqueCourse: string, acteurId: string): Promise<void> {
  const comptes = await lire<{ id: string }>(`SELECT id FROM users WHERE username LIKE $1`, [
    `%${marqueCourse}`,
  ]);
  const identifiants = comptes.map((row) => row.id);
  await effacerRepresentants(`%${marqueCourse}%`);
  await ecrire(`DELETE FROM prospects WHERE "createdById" = ANY($1)`, [identifiants]);
  await ecrire(`DELETE FROM import_jobs WHERE "requestedById" = $1`, [acteurId]);
  await ecrire(`DELETE FROM audit_logs WHERE "userId" = ANY($1)`, [identifiants]);
  await ecrire(`DELETE FROM refresh_tokens WHERE "userId" = ANY($1)`, [identifiants]);
  await ecrire(`DELETE FROM users WHERE id = ANY($1)`, [identifiants]);
  await ecrire(`DELETE FROM call_outcome_reasons WHERE label LIKE $1`, [`%${marqueCourse}%`]);
  await ecrire(`DELETE FROM statuts_qualification WHERE label LIKE $1`, [`%${marqueCourse}%`]);
  await ecrire(`DELETE FROM banques WHERE name LIKE $1`, [`%${marqueCourse}%`]);
  await ecrire(`DELETE FROM syndicats WHERE name LIKE $1`, [`%${marqueCourse}%`]);
}

/**
 * Classeur au gabarit des modèles servis par `/api/v1/export/*-modele.xlsx` :
 * en-têtes en ligne 1, ligne d'exemple en ligne 2, données à partir de la
 * ligne 3. Le serveur saute les deux premières lignes quel que soit leur
 * contenu, sans le signaler.
 */
export async function classeurExcel(
  nomFichier: string,
  entetes: readonly string[],
  lignes: readonly (readonly string[])[],
  avecExemple = true,
  nomFeuille = 'Feuille1',
): Promise<string> {
  mkdirSync(DOSSIER_FIXTURES, { recursive: true });
  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet(nomFeuille);
  feuille.addRow([...entetes]);
  if (avecExemple) feuille.addRow(entetes.map(() => 'exemple ignoré'));
  for (const valeurs of lignes) feuille.addRow([...valeurs]);
  const chemin = path.join(DOSSIER_FIXTURES, nomFichier);
  await classeur.xlsx.writeFile(chemin);
  return chemin;
}

export async function feuillesDuClasseur(chemin: string): Promise<string[]> {
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.readFile(chemin);
  return classeur.worksheets.map((feuille) => feuille.name);
}

export async function contenuFeuille(chemin: string, nom: string): Promise<string[][]> {
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.readFile(chemin);
  const feuille = classeur.getWorksheet(nom);
  if (feuille === undefined) throw new Error(`feuille absente : ${nom}`);
  const lignes: string[][] = [];
  feuille.eachRow((row) => {
    const valeurs: string[] = [];
    row.eachCell({ includeEmpty: true }, (cellule) => valeurs.push(cellule.text));
    lignes.push(valeurs);
  });
  return lignes;
}
