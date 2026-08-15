/**
 * Nom du cookie qui porte l'état de repli de la barre latérale.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Ce module existe pour une raison précise, et le défaut qu'il corrige est
 * silencieux.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La constante vivait d'abord dans `sidebar-shell.tsx`, qui porte `'use
 * client'`. Le layout SERVEUR l'importait pour lire le cookie : et recevait,
 * non pas la chaîne, mais la RÉFÉRENCE CLIENT que Next substitue à tout export
 * d'un module client atteint depuis le graphe serveur. `cookies().get(…)`
 * cherchait donc un cookie dont le nom n'était pas `cpi_sidebar` : la
 * préférence était bien écrite par le navigateur, bien renvoyée à chaque
 * requête, et systématiquement ignorée au rendu. Aucune erreur, aucun
 * avertissement : la barre se rouvrait simplement à chaque chargement.
 *
 * Un module SANS directive appartient aux deux graphes. La constante y est donc
 * une vraie chaîne des deux côtés.
 */
export const SIDEBAR_COOKIE = 'cpi_sidebar';

/** Un an : c'est une préférence d'atelier, pas une session. */
export const SIDEBAR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
