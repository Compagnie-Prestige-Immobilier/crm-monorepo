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

/**
 * Rythme LENT, pour un état qui change quelques fois par JOUR.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Une minute, et le chiffre est un arbitrage, pas un défaut.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le bandeau du mode démonstration est le premier usage. Il ne décrit pas un
 * flux de saisies mais un interrupteur qu'un administrateur bascule au plus
 * quelques fois par jour, et dont chaque bascule doit atteindre TOUS les écrans
 * déjà ouverts. Deux bornes encadrent le choix :
 *
 *  - Trop lent, l'avertissement arrive après le geste qu'il devait prévenir.
 *    Une minute est le temps qu'il faut pour ouvrir un formulaire et le remplir ;
 *    au-delà, l'utilisateur perd sa saisie et découvre la cause par le 409, ce
 *    qui est très exactement le défaut corrigé ici.
 *  - Trop rapide, on paie pour rien. Le rythme nominal (dix secondes) coûterait
 *    six requêtes par minute sur CHAQUE écran du panel et pour CHAQUE
 *    utilisateur, alors qu'il n'y a rien à voir 99 % du temps. Le panel est
 *    consulté depuis des connexions facturées au volume : une requête par
 *    minute et par onglet est le plus petit prix qui tienne la promesse.
 *
 * La borne haute est donc dictée par l'usage (une minute de saisie), la borne
 * basse par la facture. Elles se rejoignent à 60 000 ms.
 */
export const LIVE_SLOW_INTERVAL_MS = 60_000;

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
 *
 * `nominalMs` permet à un appelant de sonder plus LENTEMENT que le tableau de
 * bord sans réécrire les trois précautions ci-dessus, qui sont les mêmes pour
 * tout le monde. Le ralentissement après échec ne peut jamais ACCÉLÉRER un
 * sondage déjà lent : c'est un plancher, pas une valeur fixe.
 */
export function liveInterval(state: LiveState, nominalMs = LIVE_INTERVAL_MS): number | false {
  if (state.paused) return false;
  if (state.hidden) return false;
  return state.failing ? Math.max(nominalMs, LIVE_ERROR_INTERVAL_MS) : nominalMs;
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
