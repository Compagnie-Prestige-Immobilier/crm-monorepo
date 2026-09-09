import { randomUUID } from 'node:crypto';

import { request, type APIRequestContext, type Page } from '@playwright/test';

import { avecBase, BASE_URL, compteDe, type RoleCompte } from './comptes';

/** Un suffixe court par parcours : deux exécutions ne se marchent pas dessus. */
export function suffixe(): string {
  return randomUUID().slice(0, 8);
}

/**
 * Les fixtures passent par l'API du produit, jamais par des `INSERT` montés à
 * la main : une fiche écrite en SQL n'aurait ni parcours (`prospect_journeys`)
 * ni valeurs par défaut, et les listes la laisseraient invisible.
 */
export async function apiDe(role: RoleCompte, adresse: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: BASE_URL,
    storageState: compteDe(role).etat,
    // Sans `Origin`, la garde CSRF refuse toute écriture avant la route.
    extraHTTPHeaders: { Origin: BASE_URL, 'X-Forwarded-For': adresse },
  });
}

async function poster<T>(api: APIRequestContext, chemin: string, corps: unknown): Promise<T> {
  const reponse = await api.post(chemin, { data: corps });
  if (!reponse.ok()) {
    throw new Error(`${chemin} a répondu ${String(reponse.status())} : ${await reponse.text()}`);
  }
  return (await reponse.json()) as T;
}

export interface CompteCree {
  id: string;
  email: string;
  identifiant: string;
  nom: string;
  motDePasse: string;
}

/**
 * Un compte à soi : changer le mot de passe d'un compte partagé révoquerait
 * les sessions des autres parcours.
 */
export async function creerCompte(
  api: APIRequestContext,
  role: RoleCompte,
  motDePasse: string,
): Promise<CompteCree> {
  const cle = suffixe();
  const corps = {
    email: `e2e.jetable.${cle}@cpi.sn`,
    username: `e2e.jetable.${cle}`,
    fullName: `Jetable ${cle}`,
    password: motDePasse,
    role,
  };
  const compte = await poster<{ id: string }>(api, '/api/v1/users', corps);
  return {
    id: compte.id,
    email: corps.email,
    identifiant: corps.username,
    nom: corps.fullName,
    motDePasse,
  };
}

/** La session d'un compte créé pour le parcours, hors des états partagés. */
export async function sessionApi(
  identifiant: string,
  motDePasse: string,
  adresse: string,
): Promise<APIRequestContext> {
  const api = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Origin: BASE_URL, 'X-Forwarded-For': adresse },
  });
  await poster(api, '/api/v1/auth/login', { identifier: identifiant, password: motDePasse });
  return api;
}

export async function departementQuelconque(): Promise<{ id: string; name: string }> {
  let trouve: { id: string; name: string } | null = null;
  await avecBase(async (client) => {
    const { rows } = await client.query<{ id: string; name: string }>(
      'SELECT id, name FROM departements WHERE "isActive" ORDER BY name LIMIT 1',
    );
    trouve = rows[0] ?? null;
  });
  if (trouve === null) throw new Error('aucun département : le référentiel n’est pas semé');
  return trouve;
}

export async function creerRepresentant(
  api: APIRequestContext,
  champs: { fullName: string; phone: string; departementId: string; etablissement?: string },
): Promise<string> {
  const { id } = await poster<{ id: string }>(api, '/api/v1/representants', champs);
  return id;
}

export interface ProspectSouhaite {
  nom: string;
  prenom: string;
  phone: string;
  projet: 'CHUES' | 'GRAND_PUBLIC';
  representantId?: string;
}

export async function creerProspect(
  api: APIRequestContext,
  champs: ProspectSouhaite,
): Promise<string> {
  const { id } = await poster<{ id: string }>(api, '/api/v1/prospects', champs);
  return id;
}

export interface Traces {
  prospects?: readonly string[];
  representants?: readonly string[];
  visites?: readonly string[];
  comptes?: readonly string[];
}

/**
 * Ordre topologique : les fiches d'abord, les comptes ensuite, sinon la clé
 * `createdById` retient le compte et la purge échoue à moitié.
 */
export async function purger(traces: Traces): Promise<void> {
  await avecBase(async (client) => {
    await client.query('DELETE FROM visites WHERE id = ANY($1)', [traces.visites ?? []]);
    await client.query('DELETE FROM prospects WHERE id = ANY($1)', [traces.prospects ?? []]);
    await client.query('DELETE FROM representants WHERE id = ANY($1)', [
      traces.representants ?? [],
    ]);
    const comptes = traces.comptes ?? [];
    await client.query('DELETE FROM visites WHERE "createdById" = ANY($1)', [comptes]);
    await client.query('DELETE FROM prospects WHERE "createdById" = ANY($1)', [comptes]);
    await client.query('DELETE FROM representants WHERE "createdById" = ANY($1)', [comptes]);
    await client.query('DELETE FROM agent_heartbeats WHERE "userId" = ANY($1)', [comptes]);
    await client.query('DELETE FROM notification_deliveries WHERE "userId" = ANY($1)', [comptes]);
    await client.query('DELETE FROM audit_logs WHERE "userId" = ANY($1)', [comptes]);
    await client.query('DELETE FROM refresh_tokens WHERE "userId" = ANY($1)', [comptes]);
    await client.query('DELETE FROM users WHERE id = ANY($1)', [comptes]);
  });
}

export async function compter(requete: string, valeurs: readonly unknown[]): Promise<number> {
  let total = 0;
  await avecBase(async (client) => {
    const { rows } = await client.query<{ n: string }>(requete, [...valeurs]);
    total = Number(rows[0]?.n ?? '0');
  });
  return total;
}

export async function ligne<L extends Record<string, unknown>>(
  requete: string,
  valeurs: readonly unknown[],
): Promise<L | null> {
  let trouvee: L | null = null;
  await avecBase(async (client) => {
    const { rows } = await client.query<L>(requete, [...valeurs]);
    trouvee = rows[0] ?? null;
  });
  return trouvee;
}

export interface MesureLargeur {
  largeur: number;
  ecran: number;
  coupables: string[];
}

/** Ce qui dépasse la largeur de l'écran, avec les éléments fautifs nommés. */
export async function mesurerDebordement(page: Page): Promise<MesureLargeur> {
  return page.evaluate(() => {
    const racine = document.documentElement;
    const coupables = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => element.getBoundingClientRect().right > racine.clientWidth + 1)
      .slice(0, 5)
      .map(
        (element) =>
          `${element.tagName.toLowerCase()}.${element.className.toString().slice(0, 80)}`,
      );
    return { largeur: racine.scrollWidth, ecran: racine.clientWidth, coupables };
  });
}
