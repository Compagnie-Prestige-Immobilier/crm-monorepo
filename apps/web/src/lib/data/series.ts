import type { NamedCount } from '@/lib/types';

/**
 * Regroupement de la queue d'une distribution, UNE seule fois pour tout le
 * panel.
 *
 * La fonction vivait en double, à l'identique, dans `lib/data/stats.ts`
 * (tableau de bord) et `lib/data/statistics.ts` (écran Statistiques). Deux
 * copies d'une règle de rendu finissent toujours par diverger d'une unité : le
 * jour où l'une passe à six séries, deux écrans affichent la même donnée
 * autrement, et c'est l'écart que le lecteur remarque avant le chiffre.
 *
 * La règle elle-même vient de `docs/design.md` §2.6 et du rendu, pas de
 * l'esthétique : au-delà de cinq teintes, l'œil ne rattache plus une part à sa
 * légende. Une catégorie « Autres » se lit, douze couleurs proches non.
 */

/** Au-delà de 5 séries on regroupe : docs/design.md §2.6. On n'allonge pas la palette. */
export const MAX_CHART_SERIES = 5;

/** Réduit une distribution à `limit` tranches plus « Autres ». */
export function groupTail(items: NamedCount[], limit = MAX_CHART_SERIES): NamedCount[] {
  if (items.length <= limit) return items;
  const head = items.slice(0, limit - 1);
  const rest = items.slice(limit - 1).reduce((sum, item) => sum + item.value, 0);
  return [...head, { id: '__autres__', label: 'Autres', value: rest }];
}
