import { randomUUID } from 'node:crypto';

import { expect, type Locator, type Page } from '@playwright/test';
import type { Client } from 'pg';

import { avecBase } from './comptes';

/** Suffixe unique : deux executions ne se disputent jamais un nom ni un numero. */
export const marque = (): string => randomUUID().slice(0, 8);

/** Mobile senegalais valide : `normaliserTelephone` refuse tout autre prefixe. */
export function numeroUnique(): string {
  const chiffres = String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0');
  return `+22177${chiffres}`;
}

/** Ce que la saisie tape dans le champ, l'indicatif etant choisi a part. */
export const nationalDe = (e164: string): string => e164.slice(4);

export interface FicheSemee {
  readonly id: string;
  readonly nom: string;
  readonly phoneE164: string;
}

export async function semerRepresentant(
  client: Client,
  nom: string,
  createdById: string,
): Promise<FicheSemee> {
  const id = randomUUID();
  const phoneE164 = numeroUnique();
  await client.query(
    `INSERT INTO representants
       (id, "fullName", "phoneE164", "departementId", "createdById", "clientCreatedAt", "updatedAt")
     VALUES ($1, $2, $3, (SELECT id FROM departements ORDER BY code LIMIT 1), $4, now(), now())`,
    [id, nom, phoneE164, createdById],
  );
  return { id, nom, phoneE164 };
}

/**
 * Le parcours CHUES du prospect part avec lui : sans ligne dans
 * `prospect_journeys`, ni la console ni les rappels ne le voient.
 */
export async function semerProspect(
  client: Client,
  nom: string,
  prenom: string,
  createdById: string,
): Promise<FicheSemee> {
  const id = randomUUID();
  const phoneE164 = numeroUnique();
  await client.query(
    `INSERT INTO prospects (id, nom, prenom, "phoneE164", "createdById", "clientCreatedAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, now(), now())`,
    [id, nom, prenom, phoneE164, createdById],
  );
  await client.query(
    `INSERT INTO prospect_journeys (id, "prospectId", projet, "updatedAt")
     VALUES ($1, $2, 'CHUES', now())`,
    [randomUUID(), id],
  );
  return { id, nom: `${nom} ${prenom}`, phoneE164 };
}

export async function semerProspectGrandPublicImporte(
  client: Client,
  nom: string,
  prenom: string,
  autreCreatedById: string,
): Promise<FicheSemee> {
  const id = randomUUID();
  const phoneE164 = numeroUnique();
  await client.query(
    `INSERT INTO prospects (id, nom, prenom, "phoneE164", "createdById", "projet", "clientCreatedAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'GRAND_PUBLIC', now(), now())`,
    [id, nom, prenom, phoneE164, autreCreatedById],
  );
  await client.query(
    `INSERT INTO prospect_journeys (id, "prospectId", projet, "updatedAt")
     VALUES ($1, $2, 'GRAND_PUBLIC', now())`,
    [randomUUID(), id],
  );
  return { id, nom: `${nom} ${prenom}`, phoneE164 };
}

const REPRESENTANTS = 'SELECT id FROM representants WHERE "phoneE164" = ANY($1)';
const PROSPECTS = `SELECT id FROM prospects
  WHERE "phoneE164" = ANY($1) OR "representantId" IN (${REPRESENTANTS})`;

/**
 * Le numero suffit a designer une fiche des deux tables. L'ordre suit les cles
 * etrangeres : les suggestions avant les tentatives qui les portent, les
 * ouvertures avant les fiches qu'elles verrouillent.
 */
const EFFACEMENTS: readonly string[] = [
  `DELETE FROM representant_suggestions
     WHERE "sourceRepresentantId" IN (${REPRESENTANTS}) OR "resolvedRepresentantId" IN (${REPRESENTANTS})`,
  `DELETE FROM rep_call_attempts WHERE "representantId" IN (${REPRESENTANTS})`,
  `DELETE FROM representant_relation_changes WHERE "representantId" IN (${REPRESENTANTS})`,
  `DELETE FROM representant_comments WHERE "representantId" IN (${REPRESENTANTS})`,
  `DELETE FROM scheduled_callbacks WHERE "prospectId" IN (${PROSPECTS})`,
  `DELETE FROM call_attempts WHERE "prospectId" IN (${PROSPECTS})`,
  `DELETE FROM prospect_conversions
     WHERE "journeyId" IN (SELECT id FROM prospect_journeys WHERE "prospectId" IN (${PROSPECTS}))`,
  `DELETE FROM prospect_journeys WHERE "prospectId" IN (${PROSPECTS})`,
  `DELETE FROM segment_changes WHERE "prospectId" IN (${PROSPECTS})`,
  `DELETE FROM ouvertures_fiche
     WHERE "representantId" IN (${REPRESENTANTS}) OR "prospectId" IN (${PROSPECTS})`,
  `DELETE FROM prospects WHERE id IN (${PROSPECTS})`,
  `DELETE FROM representants WHERE id IN (${REPRESENTANTS})`,
];

export async function effacerFiches(telephones: readonly string[]): Promise<void> {
  if (telephones.length === 0) return;
  await avecBase(async (client) => {
    for (const requete of EFFACEMENTS) {
      await client.query(requete, [telephones]);
    }
  });
}

/** Ce que les tentatives d'un prospect ont ecrit, colonne par colonne. */
export async function tentativesDuProspect(
  client: Client,
  prospectId: string,
): Promise<Record<string, unknown>[]> {
  const lignes = await client.query<Record<string, unknown>>(
    `SELECT * FROM call_attempts WHERE "prospectId" = $1 ORDER BY "createdAt"`,
    [prospectId],
  );
  return lignes.rows;
}

/** Une reponse du script de qualification, designee par la question posee. */
/** Le bouton commence par la reponse : l'aide sous le libelle ne compte pas. */
export async function repondre(page: Page, question: string, reponse: string): Promise<void> {
  const debut = new RegExp(`^${reponse.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(\\s|$)`, 'u');
  await page.getByRole('group', { name: question }).getByRole('button', { name: debut }).click();
}

/** Le bandeau que l'annuaire pose apres une qualification enregistree. */
export function appelEnregistre(page: Page, nom: string) {
  return page.getByRole('status').filter({ hasText: `Appel enregistré pour ${nom}.` });
}

/** Une liste deroulante Base UI : le declencheur s'ouvre, l'option se choisit. */
export async function choisirDansListe(declencheur: Locator, option: string): Promise<void> {
  await declencheur.click();
  await declencheur.page().getByRole('option', { name: option, exact: true }).click();
}

/** La liste posee sous une question du script, que seule sa legende nomme. */
export const listeDeLaQuestion = (page: Page, question: string): Locator =>
  page.getByRole('group', { name: question }).getByRole('combobox');

/** Depuis « Qualifier un representant » : chercher la fiche, l'ouvrir, la tenir. */
export async function ouvrirFicheDepuisAnnuaire(page: Page, fiche: FicheSemee): Promise<void> {
  await page.getByLabel('Qui avez-vous appelé ?').fill(fiche.nom);
  await page.getByRole('button', { name: fiche.nom }).click();
  await expect(page.getByRole('heading', { name: fiche.nom, level: 2 })).toBeVisible();
}

export async function sansDebordementHorizontal(page: Page): Promise<void> {
  const mesure = await page.evaluate(() => {
    const racine = document.documentElement;
    return { largeur: racine.scrollWidth, ecran: racine.clientWidth };
  });
  expect(
    mesure.largeur,
    `l'ecran deborde de ${String(mesure.largeur - mesure.ecran)} px`,
  ).toBeLessThanOrEqual(mesure.ecran + 1);
}
