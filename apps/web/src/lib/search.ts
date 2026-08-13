/**
 * Rapprochement de texte tolérant, pour toutes les listes cherchables du panel.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * « Thies » doit trouver « Thiès ».
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les référentiels sénégalais sont pleins d'accents — Thiès, Kédougou, Sédhiou,
 * Ndoffane Sérère — et personne ne les tape depuis un clavier de bureau à
 * disposition américaine. Une comparaison brute renvoie « Aucun résultat » sur
 * une valeur qui existe pourtant, et l'utilisateur en conclut que le
 * département n'est pas dans la liste.
 *
 * Le repli des diacritiques est fait à la LECTURE, jamais à l'écriture : la
 * donnée stockée garde ses accents, seule la comparaison les ignore. C'est le
 * même choix que côté mobile, où le défaut avait été corrigé en premier.
 */

/**
 * Ligatures que la décomposition Unicode ne défait pas.
 *
 * `NFD` sépare « é » en « e » + accent, mais laisse « œ » entier : la
 * normalisation Unicode considère la ligature comme une lettre à part, pas
 * comme un accent. « Coeur » ne trouverait donc pas « Cœur ».
 */
const LIGATURES: readonly (readonly [RegExp, string])[] = [
  [/œ/gu, 'oe'],
  [/æ/gu, 'ae'],
];

/**
 * Texte ramené à sa forme comparable : sans accent, sans ligature, en
 * minuscules, apostrophes unifiées.
 *
 * L'apostrophe compte : les libellés du panel emploient l'apostrophe courbe
 * (« Campagne d’appels ») alors qu'un clavier produit l'apostrophe droite.
 * Sans unification, chercher « d'appels » ne trouve rien.
 */
export function foldForSearch(value: string): string {
  let folded = value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  for (const [pattern, replacement] of LIGATURES) {
    folded = folded.replace(pattern, replacement);
  }
  return folded.replace(/[’‘‛`´]/gu, "'").toLocaleLowerCase('fr');
}

/**
 * `true` si CHAQUE mot de la recherche se retrouve dans le texte.
 *
 * Tous les mots, dans n'importe quel ordre : « diop awa » trouve « Awa Diop ».
 * Une simple sous-chaîne obligerait à taper le nom dans l'ordre exact du
 * référentiel, ce que personne ne connaît de mémoire pour soixante-douze
 * représentants.
 *
 * Une recherche vide rapproche tout : la liste ouverte doit montrer la valeur
 * courante ET ses voisines, pas un écran vide.
 */
export function matchesSearch(haystack: string, needle: string): boolean {
  const terms = foldForSearch(needle)
    .split(/\s+/u)
    .filter((term) => term !== '');
  if (terms.length === 0) return true;
  const target = foldForSearch(haystack);
  return terms.every((term) => target.includes(term));
}
