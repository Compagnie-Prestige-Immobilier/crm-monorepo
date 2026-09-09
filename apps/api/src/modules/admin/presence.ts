// Durée de vie du jeton d'accès (`JWT_ACCESS_TTL`, 15 min) plus 5 min de marge :
// une rotation de jeton ne survient qu'au bout d'un quart d'heure d'usage.
export const PRESENCE_ONLINE_WINDOW_MINUTES = 20;

const PRESENCE_RECENT_WINDOW_HOURS = 24;

export type PresenceState = 'ONLINE' | 'RECENT' | 'AWAY';

export interface ActivitySignals {
  readonly isActive: boolean;
  readonly hasLiveSession: boolean;
  readonly lastLoginAt: Date | null;
  readonly lastTokenAt: Date | null;
  readonly lastPresenceAt: Date | null;
  readonly lastSyncAt: Date | null;
  readonly lastWriteAt: Date | null;
}

export function lastSeenAt(signals: ActivitySignals): Date | null {
  const candidates = [
    signals.lastTokenAt,
    signals.lastPresenceAt,
    signals.lastSyncAt,
    signals.lastWriteAt,
    signals.lastLoginAt,
  ].filter((date): date is Date => date !== null);

  if (candidates.length === 0) return null;
  return candidates.reduce((latest, date) => (date > latest ? date : latest));
}

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

export function countByPresence(states: readonly PresenceState[]): Record<PresenceState, number> {
  const counts: Record<PresenceState, number> = { ONLINE: 0, RECENT: 0, AWAY: 0 };
  for (const state of states) counts[state] += 1;
  return counts;
}
