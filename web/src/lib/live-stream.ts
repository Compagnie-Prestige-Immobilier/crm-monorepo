import { useSyncExternalStore } from 'react';

import { queryKeys } from '@/lib/query-keys';

export const LIVE_STREAM_PATH = '/api/v1/live';

/** Sujets du flux serveur et les requêtes qu'ils invalident. Miroir de `LIVE_TOPICS` côté Go. */
export const LIVE_TOPIC_KEYS = {
  notifications: [queryKeys.inboxRoot],
  imports: [queryKeys.importsRoot, ['visites', 'import']],
  'db-dump': [queryKeys.databaseDump],
  referentiels: [queryKeys.referentielsRoot, queryKeys.reference],
} as const satisfies Record<string, readonly (readonly string[])[]>;

export type LiveTopic = keyof typeof LIVE_TOPIC_KEYS;

let connected = false;
const listeners = new Set<() => void>();

export function setLiveStreamConnected(value: boolean): void {
  if (connected === value) return;
  connected = value;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useLiveStreamConnected(): boolean {
  return useSyncExternalStore(subscribe, () => connected);
}
