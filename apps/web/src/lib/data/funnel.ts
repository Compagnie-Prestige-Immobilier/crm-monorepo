import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { toFilterQuery } from '@/lib/api/query-params';
import type { ProspectFilters } from '@/lib/types';

/**
 * `GET /analytics/funnel` : l'entonnoir complet et les montants encaissés.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi le montant est une CHAÎNE, de bout en bout.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * XOF est stocké en `Decimal(18,0)`. `Number.MAX_SAFE_INTEGER` s'arrête à
 * quinze chiffres et demi : au-delà, `Number(montant)` perd des unités sans
 * lever la moindre erreur, et le total affiché diverge de celui du classeur
 * Excel sans que rien ne le signale. Le contrat déclare donc ces champs en
 * `string`, et `lib/money.ts` ne fait que du texte : découpage en tranches de
 * trois chiffres, jamais d'arithmétique flottante.
 *
 * Les types viennent du client engendré. Ils étaient auparavant redéclarés ici,
 * accompagnés d'un validateur écrit à la main, sur la promesse que la route
 * était « absente du client engendré » : elle ne l'est plus. Une déclaration
 * parallèle d'un contrat déjà typé ne protège de rien : elle DIVERGE, et le
 * jour où elle diverge c'est l'écran qui a tort, en silence.
 */
type Schemas = components['schemas'];

/** Une marche de la chaîne, du prospect saisi au dossier encaissé. */
export type FunnelStage = Schemas['FunnelStageDto'];
/** Les montants. Chaque champ monétaire est une CHAÎNE, jamais un nombre. */
export type FunnelFinance = Schemas['AnalyticsFinanceDto'];
export type Funnel = Schemas['AnalyticsFunnelDto'];

/**
 * L'entonnoir prend EXACTEMENT le même filtre que le reste du tableau de bord :
 * les montants décrivent la population des chiffres affichés au-dessus.
 */
export async function fetchFunnel(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<Funnel> {
  return unwrap(
    await client.GET('/api/v1/analytics/funnel', { params: { query: toFilterQuery(filters) } }),
  );
}

/**
 * Indice de la marche où la chaîne se casse, ou `null`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * On désigne le MINIMUM observé, on n'applique aucun seuil.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Décréter qu'un passage sous 20 % est « mauvais » serait inventer une norme
 * métier que personne n'a fixée, et la peindre en rouge sur un écran de
 * direction lui donnerait force de vérité. Le minimum, lui, est un fait : sur
 * l'exemple 100 / 43,2 / 6,3 / 100, c'est l'ouverture de dossier qui casse,
 * quelle que soit l'opinion qu'on a de 6,3 %.
 *
 * La première marche est exclue : elle vaut toujours 100 % par construction.
 * Un minimum à 100 n'est pas une rupture, et une ÉGALITÉ ne désigne aucune
 * marche en particulier : dans les deux cas on ne montre rien plutôt que de
 * pointer arbitrairement.
 *
 * Un taux `null` est IGNORÉ, et ce n'est pas un détail : l'API le rend quand
 * l'étape précédente est vide, et le replier sur `0` désignerait comme rupture
 * une marche où il ne s'est simplement rien passé. C'est exactement l'inverse
 * de ce que l'écran doit montrer.
 */
export function breakingStageIndex(stages: readonly FunnelStage[]): number | null {
  if (stages.length < 2) return null;
  if ((stages[0]?.count ?? 0) === 0) return null;

  let index = -1;
  let lowest = Number.POSITIVE_INFINITY;
  let tied = false;

  for (let i = 1; i < stages.length; i += 1) {
    const rate = stages[i]?.tauxEtapePrecedente;
    if (rate === null || rate === undefined) continue;
    if (rate < lowest) {
      lowest = rate;
      index = i;
      tied = false;
    } else if (rate === lowest) {
      tied = true;
    }
  }

  if (index === -1 || tied || lowest >= 100) return null;
  return index;
}
