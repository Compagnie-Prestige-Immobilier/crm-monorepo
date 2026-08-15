/**
 * Rafraîchissement continu des écrans de pilotage.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi du sondage, et pas SSE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Rien dans la pile ne diffuse d'événements : l'API est un NestJS sur Fastify
 * derrière un relais Next qui recopie les réponses. Ajouter un flux SSE
 * supposerait de tenir une connexion ouverte à travers ce relais, d'y faire
 * survivre la rotation du jeton d'accès et de gérer la reconnexion : pour des
 * agrégats qui changent au rythme des saisies, c'est-à-dire quelques fois par
 * minute. Le sondage sur les endpoints EXISTANTS coûte une requête toutes les
 * dix secondes et ne demande aucune infrastructure nouvelle.
 *
 * Trois précautions le rendent supportable :
 *
 *  1. Il S'ARRÊTE quand l'onglet passe en arrière-plan. Un panel laissé ouvert
 *     toute la nuit consommerait sinon 8 640 requêtes par écran, pour personne.
 *  2. Il RALENTIT après une erreur. L'API limite à 300 requêtes par minute ;
 *     insister au même rythme sur une API en peine transforme un incident en
 *     panne d'authentification (voir `lib/session.ts`).
 *  3. Il ne remplace JAMAIS les données affichées par un squelette. Les
 *     anciennes valeurs restent à l'écran jusqu'à l'arrivée des nouvelles.
 */

/** Rythme nominal. Assez court pour être vivant, assez long pour être discret. */
export const LIVE_INTERVAL_MS = 10_000;

/** Après un échec. Laisse le temps à un incident passager de se résoudre. */
export const LIVE_ERROR_INTERVAL_MS = 60_000;

export interface LiveState {
  /** L'onglet est-il caché ? `document.visibilityState === 'hidden'`. */
  readonly hidden: boolean;
  /** La dernière requête a-t-elle échoué ? */
  readonly failing: boolean;
  /** L'utilisateur a-t-il suspendu le rafraîchissement ? */
  readonly paused: boolean;
}

/**
 * Intervalle à passer à `refetchInterval`, ou `false` pour ne rien planifier.
 *
 * `false` et non `0` : TanStack Query traite `0` comme « aussi vite que
 * possible », ce qui est exactement l'inverse de l'intention.
 */
export function liveInterval(state: LiveState): number | false {
  if (state.paused) return false;
  if (state.hidden) return false;
  return state.failing ? LIVE_ERROR_INTERVAL_MS : LIVE_INTERVAL_MS;
}

/**
 * Faut-il montrer le squelette ?
 *
 * UNIQUEMENT au tout premier chargement. Le remettre à chaque cycle ferait
 * clignoter l'écran toutes les dix secondes : c'est le défaut qui rend un
 * tableau de bord « temps réel » illisible, et il ne se voit qu'en conditions
 * réelles, jamais sur une pile de développement instantanée.
 */
export function shouldShowSkeleton(input: { isPending: boolean; hasData: boolean }): boolean {
  return input.isPending && !input.hasData;
}

/**
 * Faut-il remplacer l'écran par un état d'erreur ?
 *
 * Non tant que des données ont été affichées : un cycle de sondage qui échoue
 * ne doit pas effacer un tableau de bord correct. L'erreur est alors signalée
 * discrètement, à côté de l'horodatage, et les chiffres restent.
 */
export function shouldShowError(input: { isError: boolean; hasData: boolean }): boolean {
  return input.isError && !input.hasData;
}

/** Libellé de l'indicateur. Un état se nomme : il ne décrit pas le réseau. */
export function liveLabel(state: LiveState): string {
  if (state.paused) return 'En pause';
  if (state.hidden) return 'En pause';
  if (state.failing) return 'Interrompu';
  return 'En direct';
}
