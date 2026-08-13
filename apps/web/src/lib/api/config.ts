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
 * Code porté par la réponse d'un Route Handler quand la CONFIGURATION du panel
 * est incomplète.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi une panne de configuration ne doit pas se lire comme une panne
 * réseau.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `API_URL` absent et backend éteint produisent le même symptôme — aucune
 * donnée — mais pas la même réparation. Le panel affichait « Serveur
 * injoignable. Vérifiez la connexion, puis réessayez. » dans les deux cas :
 * l'utilisateur a cherché une panne de réseau pendant qu'une variable
 * d'environnement manquait. Le message qui accuse la mauvaise cause coûte plus
 * cher que l'absence de message, parce qu'il oriente activement la recherche
 * dans la mauvaise direction.
 *
 * Le code voyage dans le corps JSON parce que la cause naît côté serveur alors
 * que le message se lit côté navigateur : c'est le seul lien entre les deux.
 */
export const CONFIG_ERROR_CODE = 'CONFIGURATION_MANQUANTE';

/**
 * Une variable d'environnement obligatoire manque. Elle est NOMMÉE : « une
 * erreur de configuration » n'apprend rien à qui doit la corriger.
 */
export class ApiConfigurationError extends Error {
  readonly variable: string;

  constructor(variable: string) {
    super(
      `Configuration incomplète : ${variable} est absent de l’environnement du panel. ` +
        'Renseignez cette variable, puis redémarrez le service.',
    );
    this.name = 'ApiConfigurationError';
    this.variable = variable;
  }
}

/**
 * Message de configuration porté par un corps d'erreur, ou `null`.
 *
 * L'appelant reçoit un `unknown` : la réponse peut être le corps d'un proxy,
 * une page HTML ou rien du tout. On ne fait donc confiance à aucune forme.
 */
export function configErrorMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const { code, error } = body as { code?: unknown; error?: unknown };
  if (code !== CONFIG_ERROR_CODE) return null;
  return typeof error === 'string' && error !== '' ? error : null;
}

/** `true` si la cause est une configuration incomplète, des deux côtés du réseau. */
export function isConfigurationError(error: unknown): boolean {
  if (error instanceof ApiConfigurationError) return true;
  if (typeof error !== 'object' || error === null) return false;
  // `ApiError` de `@crm/api-client` porte le corps parsé sur `.body`. On le lit
  // structurellement pour ne pas importer le paquet ici : ce module est atteint
  // depuis le graphe client comme depuis les Route Handlers.
  return configErrorMessage((error as { body?: unknown }).body) !== null;
}

/**
 * Origine du backend NestJS, côté serveur uniquement.
 *
 * Lève plutôt que de retomber sur une valeur par défaut : une URL implicite
 * pointant vers `localhost` en production produirait des écrans vides et des
 * exports corrompus sans qu'aucun message ne le signale.
 */
export function serverApiOrigin(): string {
  const url = process.env.API_URL ?? process.env.API_INTERNAL_URL;
  if (url === undefined || url === '') throw new ApiConfigurationError('API_URL');
  return url.replace(/\/+$/, '');
}

/**
 * Réponse JSON d'un Route Handler pour une configuration incomplète.
 *
 * 500 et non 502 : rien n'est en panne en amont, c'est CE service qui est mal
 * déployé. Le champ `error` est celui que lisent `apiErrorMessage` et le
 * formulaire de connexion ; `code` est ce qui permet aux écrans de ne pas
 * confondre la cause avec une coupure réseau.
 */
export function configErrorBody(error: ApiConfigurationError): {
  error: string;
  code: string;
  variable: string;
} {
  return { error: error.message, code: CONFIG_ERROR_CODE, variable: error.variable };
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
