import { ApiError } from '@crm/api-client/query';

import { API_PREFIX } from '@/lib/api/config';
import { redirectToLogin } from '@/lib/api/session-expiry';

/**
 * Appel d'API pour les endpoints ABSENTS du client engendré.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi ce module existe, et quand il doit disparaître.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les écrans du panel passent par `@crm/api-client`, typé depuis
 * `apps/api/openapi.json`. Ce document n'est régénéré que par `pnpm codegen`.
 * Tant qu'il ne l'a pas été, les routes ajoutées à l'API n'existent pas pour le
 * client engendré : `client.GET('/api/v1/admin/purge')` ne compile pas.
 *
 * Deux issues, et une seule est acceptable :
 *
 *  - élargir à la main les types engendrés : ils seraient écrasés à la
 *    prochaine génération, et l'écart entre le contrat réel et le contrat
 *    déclaré passerait inaperçu ;
 *  - passer par `fetch`, en déclarant EXPLICITEMENT la forme attendue et en la
 *    validant à l'entrée. C'est ce que fait ce module.
 *
 * TODO(codegen) : après `pnpm codegen`, ces appels redeviennent
 * `client.GET(...)` et ce fichier disparaît. Les fonctions de `lib/data/admin.ts`
 * gardent alors la même signature, donc aucun écran ne bouge.
 *
 * Le chemin passe par le relais `/api/v1/*` de Next, comme tout le reste : le
 * jeton vit dans un cookie `httpOnly` que le JavaScript de la page ne voit pas.
 */

/** Méthodes relayées par `src/app/api/v1/[...path]/route.ts`. */
type Method = 'GET' | 'POST';

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Une passerelle en panne renvoie du HTML avec un statut 502 : on garde le
    // texte brut, qui vaut mieux qu'une exception de parsage sans rapport.
    return { message: text };
  }
}

/**
 * `parse` est OBLIGATOIRE, et c'est le point du module.
 *
 * Un `as T` sec ferait entrer dans l'écran une valeur dont personne n'a vérifié
 * la forme : le jour où l'API renomme un champ, le tableau afficherait des
 * cases vides sans qu'aucune erreur ne soit levée. Le validateur transforme
 * cette dérive silencieuse en échec net, que `QueryErrorState` sait rendre.
 */
export async function apiFetch<T>(
  path: string,
  parse: (value: unknown) => T,
  init: { method?: Method; body?: unknown } = {},
): Promise<T> {
  const method = init.method ?? 'GET';

  const response = await fetch(`${API_PREFIX}${path}`, {
    method,
    headers: init.body === undefined ? {} : { 'content-type': 'application/json' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    cache: 'no-store',
  });

  const body = await parseBody(response);

  if (!response.ok) {
    // Un 401 arrivé jusqu'ici est terminal : le relais a déjà tenté la rotation
    // côté serveur et effacé les cookies. Réessayer rejouerait l'échec.
    if (response.status === 401) redirectToLogin();
    throw new ApiError(body, response);
  }

  try {
    return parse(body);
  } catch (error) {
    throw new Error(
      `Réponse inattendue de ${path} : ${error instanceof Error ? error.message : 'forme invalide'}`,
    );
  }
}

/** Multipart relay for the few admin actions that carry binary files. */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  parse: (value: unknown) => T,
): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    method: 'POST',
    body: form,
    cache: 'no-store',
  });
  const body = await parseBody(response);
  if (!response.ok) {
    if (response.status === 401) redirectToLogin();
    throw new ApiError(body, response);
  }
  try {
    return parse(body);
  } catch (error) {
    throw new Error(
      `Réponse inattendue de ${path} : ${error instanceof Error ? error.message : 'forme invalide'}`,
    );
  }
}

// ─── Petits validateurs ──────────────────────────────────────────────────────
//
// Volontairement écrits à la main plutôt qu'avec un schéma : ils tiennent en
// quelques lignes, ils ne servent qu'ici, et ils disparaîtront avec ce fichier.

export function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${where} n’est pas un objet`);
  }
  return value as Record<string, unknown>;
}

export function asArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${where} n’est pas un tableau`);
  return value;
}

export function asString(value: unknown, where: string): string {
  if (typeof value !== 'string') throw new Error(`${where} n’est pas une chaîne`);
  return value;
}

export function asNumber(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${where} n’est pas un nombre`);
  }
  return value;
}

export function asBoolean(value: unknown, where: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${where} n’est pas un booléen`);
  return value;
}

/** `null` accepté et conservé : l'absence de date est une information. */
export function asNullableString(value: unknown, where: string): string | null {
  if (value === null || value === undefined) return null;
  return asString(value, where);
}
