import type { TransformFnParams } from 'class-transformer';

/**
 * Coercition d'un booléen reçu en PARAMÈTRE DE REQUÊTE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI PAS `@Type(() => Boolean)`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dans une query string, tout arrive en texte. `Type(() => Boolean)` applique
 * le constructeur `Boolean`, et **toute chaîne non vide est vraie** :
 * `Boolean('false') === true`. Le paramètre le plus explicite qui soit,
 * `?dryRun=false`, produit alors exactement l'inverse de ce qu'il demande, et
 * `@IsBoolean()` ne peut rien signaler puisqu'il reçoit un booléen parfaitement
 * valide. Le défaut est donc SILENCIEUX, et il l'est du côté destructeur : un
 * import qui n'écrit jamais, une suppression qui cascade sans le dire, un
 * filtre qui rend l'ensemble complémentaire.
 *
 * Le vocabulaire admis est FERMÉ, `true` et `1` seulement. Tout le reste, y
 * compris `false`, `0` et la chaîne vide, vaut faux. Un vocabulaire ouvert
 * (« oui », « on », « yes ») donnerait au client l'illusion que le serveur
 * comprend ce qu'il écrit, alors qu'une seule faute de frappe suffit à
 * retourner le sens.
 *
 * Le paramètre ABSENT n'est pas transformé : class-transformer n'applique la
 * conversion que sur les clés présentes. `undefined` reste donc `undefined`,
 * ce qui laisse au service le soin de choisir son défaut, souvent différent
 * de faux (`dryRun` vaut vrai par défaut).
 */
export const queryBoolean = (params: TransformFnParams): boolean =>
  params.value === true || params.value === 'true' || params.value === '1';
