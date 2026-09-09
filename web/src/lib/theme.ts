import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const CLE = 'cpi_theme';
const listeners = new Set<() => void>();

function lire(): Theme {
  const brut = localStorage.getItem(CLE);
  return brut === 'light' || brut === 'dark' ? brut : 'system';
}

let theme: Theme = lire();

function sombre(valeur: Theme): boolean {
  if (valeur !== 'system') return valeur === 'dark';
  return globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
}

function appliquer(): void {
  document.documentElement.classList.toggle('dark', sombre(theme));
}

function setTheme(valeur: Theme): void {
  theme = valeur;
  if (valeur === 'system') localStorage.removeItem(CLE);
  else localStorage.setItem(CLE, valeur);
  appliquer();
  for (const listener of listeners) listener();
}

export function initTheme(): void {
  appliquer();
  globalThis.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', appliquer);
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useTheme(): { theme: Theme; setTheme: (valeur: Theme) => void } {
  return { theme: useSyncExternalStore(subscribe, () => theme), setTheme };
}
