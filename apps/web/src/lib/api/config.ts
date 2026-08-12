/**
 * Constantes partagées par les trois environnements d'exécution du panel :
 * le rendu serveur (React Server Components), les Route Handlers et le
 * navigateur. Aucun `next/headers` ici — ce module est atteint depuis le
 * graphe client, où un import de `next/headers` ferait échouer le build.
 */

/** Noms des cookies de session. `httpOnly` : jamais lisibles en JavaScript. */
export const ACCESS_COOKIE = 'cpi_at';
export const REFRESH_COOKIE = 'cpi_rt';

/**
 * Préfixe de version de l'API. Les chemins du client généré le portent déjà
 * (`/api/v1/prospects`), donc la base d'URL s'arrête à l'origine.
 */
export const API_PREFIX = '/api/v1';

/** Durée de vie du cookie de rafraîchissement : 30 jours (`JWT_REFRESH_TTL_DAYS`). */
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Marge avant expiration à partir de laquelle on rafraîchit sans attendre le
 * 401. 60 s couvre la dérive d'horloge entre Next et l'API, plus le temps
 * d'un rendu serveur un peu long.
 */
export const REFRESH_SKEW_SECONDS = 60;

/**
 * Origine du backend NestJS, côté serveur uniquement.
 *
 * Lève plutôt que de retomber sur une valeur par défaut : une URL implicite
 * pointant vers `localhost` en production produirait des écrans vides et des
 * exports corrompus sans qu'aucun message ne le signale.
 */
export function serverApiOrigin(): string {
  const url = process.env.API_URL ?? process.env.API_INTERNAL_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'API_URL est absent de l’environnement. Le panel ne peut joindre aucun backend.',
    );
  }
  return url.replace(/\/+$/, '');
}

/**
 * Base d'URL utilisée DANS LE NAVIGATEUR : l'origine courante.
 *
 * Le navigateur n'appelle jamais NestJS directement — le jeton vit dans un
 * cookie `httpOnly`, donc hors de portée de `fetch` côté client. Les requêtes
 * partent vers `/api/v1/…` de Next, relayées par
 * `src/app/api/v1/[...path]/route.ts`, qui rattache l'en-tête `Authorization`
 * côté serveur et gère la rotation du jeton de rafraîchissement.
 */
export function browserApiOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}
