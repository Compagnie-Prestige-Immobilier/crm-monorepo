import { randomInt, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import ExcelJS from 'exceljs';
import type { QueryResultRow } from 'pg';

import { avecBase } from './comptes';

export const DOSSIER_FIXTURES = path.join(__dirname, 'fixtures');

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
export async function effacerBanque(banqueId: string): Promise<void> {
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

/** Première ligne de données lue par le serveur, `premiereLigneImport` compris. */
export const PREMIERE_LIGNE_DONNEES = 3;

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
): Promise<string> {
  mkdirSync(DOSSIER_FIXTURES, { recursive: true });
  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet('Feuille1');
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
    const valeurs = Array.isArray(row.values) ? row.values.slice(1) : [];
    lignes.push(valeurs.map((valeur) => (valeur == null ? '' : String(valeur))));
  });
  return lignes;
}
