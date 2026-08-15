/**
 * Lecture d'une chaîne de requête : UNE implémentation, pour les sept écrans.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi ce module existe.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ces quatre lecteurs étaient recopiés à l'identique dans `lib/filters.ts`,
 * `bank-filters.ts`, `campaign-filters.ts`, `client-request-filters.ts`,
 * `rep-campaign-filters.ts`, `representant-filters.ts` et `user-filters.ts`.
 * Sept copies d'une même règle, et elles avaient DÉJÀ divergé : l'une nommait
 * `readNullableString` ce que les six autres appelaient `readString`, et l'une
 * avait perdu le drapeau `u` de l'expression rationnelle de date.
 *
 * Ce n'est pas une question de lignes économisées. Ces fonctions décident de ce
 * qui part vers l'API : une valeur mal filtrée ici produit un 400 sur un écran
 * que l'utilisateur n'a fait qu'ouvrir depuis un lien. Une règle qui gouverne
 * sept écrans doit s'écrire, se lire et se corriger à UN seul endroit.
 *
 * Analyse TOLÉRANTE, partout : une valeur inconnue est écartée, jamais
 * propagée. Une URL bricolée à la main ne doit rien casser.
 */

/** Ce que Next passe à une page serveur, et ce que `URLSearchParams` sait lire. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Première valeur d'une clé, quelle que soit la forme du porteur.
 *
 * Next donne `string[]` dès qu'un paramètre est répété (`?statut=A&statut=B`).
 * Aucun filtre du panel n'est multivalué : on retient la première et on ignore
 * le reste, plutôt que de sérialiser un tableau vers une API qui n'en attend
 * pas.
 */
export function readOne(params: RawSearchParams | URLSearchParams, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key);
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

/** Chaîne non vide, espaces retirés. `null` pour tout le reste. */
export function readString(params: RawSearchParams | URLSearchParams, key: string): string | null {
  const value = readOne(params, key);
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Entier strictement positif, ou le repli. `page=0` et `page=abc` valent le repli. */
export function readPositiveInt(
  params: RawSearchParams | URLSearchParams,
  key: string,
  fallback: number,
): number {
  const value = readString(params, key);
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** `YYYY-MM-DD` uniquement : toute autre forme est ignorée plutôt que devinée. */
export function readIsoDate(params: RawSearchParams | URLSearchParams, key: string): string | null {
  const value = readString(params, key);
  if (value === null) return null;
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : null;
}

/**
 * Lecteur d'énumération générique.
 *
 * Écrit une fois plutôt que recopié : chaque copie serait une occasion
 * d'oublier la validation, et une valeur inconnue collée dans l'URL partirait
 * telle quelle vers l'API.
 */
export function readEnum<T extends string>(
  params: RawSearchParams | URLSearchParams,
  key: string,
  allowed: readonly T[],
): T | null {
  const value = readString(params, key);
  if (value === null) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * Booléen écrit EN FRANÇAIS dans l'URL (`oui` / `non`).
 *
 * C'est le vocabulaire visible du panel, et une URL se lit par-dessus l'épaule
 * de celui qui l'a envoyée. Attention : ces valeurs ne partent JAMAIS telles
 * quelles vers l'API, qui attend `true` / `false` ; la traduction se fait dans
 * le constructeur de requête de chaque écran.
 */
export function readFrenchBoolean(
  params: RawSearchParams | URLSearchParams,
  key: string,
): boolean | null {
  const value = readString(params, key);
  if (value === 'oui') return true;
  if (value === 'non') return false;
  return null;
}
