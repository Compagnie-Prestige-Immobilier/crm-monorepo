/**
 * Le franc CFA transite en CHAÎNE, du serveur à l'écran, sans jamais devenir
 * un `number`.
 *
 * La colonne est un `Decimal(18,0)` : 18 chiffres, soit jusqu'à
 * 999 999 999 999 999 999 FCFA. `Number.MAX_SAFE_INTEGER` s'arrête à
 * 9 007 199 254 740 991 — quinze chiffres et demi. Un `Number(montant)` sur un
 * portefeuille consolidé perd donc des unités SILENCIEUSEMENT, et le total
 * affiché diverge de celui du classeur Excel sans qu'aucune erreur ne soit
 * levée. Ce module ne fait donc que du texte : découpage en tranches de trois
 * chiffres, jamais d'arithmétique flottante.
 *
 * `Intl.NumberFormat` n'est pas utilisé sur un `number` pour la même raison. Il
 * l'est en revanche sur un `bigint`, qui est exact quelle que soit la taille —
 * mais on garde le chemin manuel comme repli, parce qu'un montant mal formé
 * (chaîne vide, `null`, valeur inattendue) ne doit pas faire tomber une ligne
 * de tableau.
 */

/** Ce que l'API émet : un entier non signé de 18 chiffres au plus, en chaîne. */
const MONEY_PATTERN = /^\d{1,18}$/u;

/** Espace insécable étroit : le séparateur de milliers du français. */
const GROUP_SEPARATOR = ' ';

export const ZERO_XOF = '0';

export function isMoneyString(value: unknown): value is string {
  return typeof value === 'string' && MONEY_PATTERN.test(value);
}

/**
 * `"1200000"` → `"1 200 000"`. Groupement par trois DEPUIS LA DROITE, sur la
 * chaîne, sans conversion numérique.
 */
export function groupDigits(digits: string): string {
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end));
  }
  return groups.join(GROUP_SEPARATOR);
}

/**
 * `"1200000"` → `"1 200 000 FCFA"`.
 *
 * Une valeur nulle ou absente rend `placeholder` : « 0 FCFA » et « pas de
 * montant » ne sont pas la même information — un dossier en cours d'instruction
 * n'a AUCUN montant, il n'a pas un montant nul.
 */
export function formatXof(value: string | null | undefined, placeholder = '–'): string {
  if (value === null || value === undefined || value === '') return placeholder;
  const trimmed = value.trim();
  // Repli : on affiche la valeur brute plutôt que de masquer une donnée que
  // l'API a bien renvoyée mais que ce module ne sait pas lire.
  if (!MONEY_PATTERN.test(trimmed)) return `${trimmed} FCFA`;
  // Les zéros de tête ne sont pas significatifs, mais « 0 » l'est.
  const normalized = trimmed.replace(/^0+(?=\d)/u, '');
  return `${groupDigits(normalized)} FCFA`;
}

/**
 * Aperçu d'une saisie en cours : ce que l'agent tape (« 1 200 000 », « 1.200.000 »,
 * « 1200000 FCFA ») ramené aux seuls chiffres, puis reformaté.
 *
 * Renvoie `null` tant que la saisie ne porte aucun chiffre : l'aperçu reste
 * alors vide au lieu d'annoncer « 0 FCFA » sous un champ vierge, ce qui se
 * lirait comme un montant déjà validé.
 */
export function parseMoneyInput(raw: string): string | null {
  const digits = raw.replace(/\D/gu, '');
  if (digits === '') return null;
  const normalized = digits.replace(/^0+(?=\d)/u, '');
  // 18 chiffres : la borne de la colonne. Au-delà, l'API refuserait en 400 ;
  // mieux vaut le dire côté saisie.
  return normalized.length > 18 ? null : normalized;
}

/** Somme exacte de montants XOF. `bigint`, jamais `number`. */
export function sumXof(values: readonly (string | null | undefined)[]): string {
  let total = 0n;
  for (const value of values) {
    if (isMoneyString(value)) total += BigInt(value);
  }
  return total.toString();
}

/**
 * Montant → nombre, UNIQUEMENT pour un axe de graphique.
 *
 * Chart.js ne trace que des `number` : c'est le seul endroit où la conversion
 * est inévitable. Elle est isolée ici, nommée pour ce qu'elle est, et jamais
 * réutilisée pour un affichage ou un calcul — la valeur écrite à l'écran vient
 * toujours de `formatXof` sur la chaîne d'origine.
 */
export function xofToChartNumber(value: string | null | undefined): number {
  if (!isMoneyString(value)) return 0;
  return Number(value);
}
