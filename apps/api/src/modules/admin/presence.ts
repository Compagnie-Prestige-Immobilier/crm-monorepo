/**
 * Présence d'un compte — DÉDUITE, jamais déclarée.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Rien n'enregistre « untel est en ligne ». Il faut donc le déduire, et le
 * déduire honnêtement.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Quatre traces existent déjà dans le schéma, et aucune n'a été ajoutée pour
 * cet écran :
 *
 *  - `User.lastLoginAt` — l'ouverture de session. Suffisant pour « s'est
 *    connecté un jour », inutilisable pour « est là maintenant » : une session
 *    vaut trente jours.
 *  - `RefreshToken` — chaque rotation crée une ligne dans la même famille. Le
 *    panel comme le mobile tournent leur jeton dès que l'accès approche de son
 *    terme (15 min). La date de la DERNIÈRE rotation d'une famille encore
 *    vivante est donc la meilleure approximation disponible de « dernière
 *    requête », sans instrumenter quoi que ce soit.
 *  - `SyncBatch.createdAt` — dernier lot poussé par un appareil mobile.
 *  - Les écritures métier — tentative d'appel, transition de dossier.
 *
 * D'où la fenêtre « connecté » : une rotation ne survient qu'au bout d'un
 * quart d'heure d'usage continu. Un seuil plus court afficherait « inactif »
 * un téléconseiller en pleine session, ce qui est le pire des deux défauts —
 * un superviseur qui voit un agent absent alors qu'il travaille appelle son
 * responsable pour rien.
 *
 * Le seuil est donc la durée de vie du jeton d'accès (15 min) plus une marge :
 * un aller-retour réseau, un rendu, une horloge décalée.
 */

/** Durée de vie du jeton d'accès (`JWT_ACCESS_TTL`) plus 5 min de marge. */
export const PRESENCE_ONLINE_WINDOW_MINUTES = 20;

/** Au-delà, on ne parle plus d'activité récente mais d'un compte au repos. */
export const PRESENCE_RECENT_WINDOW_HOURS = 24;

/**
 * Trois états, et trois seulement.
 *
 * Un quatrième — « peut-être » — serait vrai mais inexploitable : un
 * superviseur agit ou n'agit pas, il n'agit pas « à moitié ».
 */
export type PresenceState = 'ONLINE' | 'RECENT' | 'AWAY';

export interface ActivitySignals {
  /** Le compte est-il ouvert ? Un compte désactivé n'est jamais « connecté ». */
  readonly isActive: boolean;
  /** Une famille de jetons vivante existe : ni révoquée, ni expirée. */
  readonly hasLiveSession: boolean;
  readonly lastLoginAt: Date | null;
  /** Dernière rotation d'un jeton encore valide. Approxime la dernière requête. */
  readonly lastTokenAt: Date | null;
  /** Dernier lot de synchronisation reçu d'un appareil. */
  readonly lastSyncAt: Date | null;
  /** Dernière écriture métier : tentative d'appel, transition de dossier. */
  readonly lastWriteAt: Date | null;
}

/**
 * Date de la trace la plus récente, toutes sources confondues.
 *
 * Le maximum et non la première trouvée : un téléconseiller peut pousser un lot
 * de synchronisation depuis son mobile pendant que sa session web dort, et
 * l'inverse est tout aussi courant.
 */
export function lastSeenAt(signals: ActivitySignals): Date | null {
  const candidates = [
    signals.lastTokenAt,
    signals.lastSyncAt,
    signals.lastWriteAt,
    signals.lastLoginAt,
  ].filter((date): date is Date => date !== null);

  if (candidates.length === 0) return null;
  return candidates.reduce((latest, date) => (date > latest ? date : latest));
}

/**
 * `ONLINE` exige DEUX conditions, pas une.
 *
 * Une trace fraîche sans session vivante décrit un compte qu'on vient de
 * déconnecter ou de désactiver : il ne faut pas l'annoncer connecté. Une
 * session vivante sans trace fraîche décrit un jeton de trente jours dormant
 * dans un onglet fermé : pas davantage.
 */
export function presenceOf(signals: ActivitySignals, now: Date): PresenceState {
  const seen = lastSeenAt(signals);
  if (seen === null) return 'AWAY';

  const elapsedMinutes = (now.getTime() - seen.getTime()) / 60_000;

  if (
    signals.isActive &&
    signals.hasLiveSession &&
    elapsedMinutes >= 0 &&
    elapsedMinutes <= PRESENCE_ONLINE_WINDOW_MINUTES
  ) {
    return 'ONLINE';
  }

  return elapsedMinutes <= PRESENCE_RECENT_WINDOW_HOURS * 60 ? 'RECENT' : 'AWAY';
}

/** Compteurs de tête de l'écran. Un seul parcours, pas trois filtres. */
export function countByPresence(states: readonly PresenceState[]): Record<PresenceState, number> {
  const counts: Record<PresenceState, number> = { ONLINE: 0, RECENT: 0, AWAY: 0 };
  for (const state of states) counts[state] += 1;
  return counts;
}
