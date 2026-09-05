export const LIVE_INTERVAL_MS = 10_000;

/** Pour un état qui change quelques fois par jour, pas au rythme des saisies. */
export const LIVE_SLOW_INTERVAL_MS = 60_000;

export const LIVE_ERROR_INTERVAL_MS = 60_000;

export interface LiveState {
  readonly hidden: boolean;
  readonly failing: boolean;
  readonly paused: boolean;
  /** Le serveur pousse les changements de ce sujet : le sondage n'est plus qu'un filet. */
  readonly streamed?: boolean;
}

/** `false` et non `0`: TanStack Query traite `0` comme « aussi vite que possible ». */
export function liveInterval(state: LiveState, nominalMs = LIVE_INTERVAL_MS): number | false {
  if (state.paused) return false;
  if (state.hidden) return false;
  const base = state.streamed ? Math.max(nominalMs, LIVE_SLOW_INTERVAL_MS) : nominalMs;
  return state.failing ? Math.max(base, LIVE_ERROR_INTERVAL_MS) : base;
}

export function shouldShowSkeleton(input: { isPending: boolean; hasData: boolean }): boolean {
  return input.isPending && !input.hasData;
}

export function shouldShowError(input: { isError: boolean; hasData: boolean }): boolean {
  return input.isError && !input.hasData;
}

export function liveLabel(state: LiveState): string {
  if (state.paused) return 'En pause';
  if (state.hidden) return 'En pause';
  if (state.failing) return 'Interrompu';
  return 'En direct';
}
