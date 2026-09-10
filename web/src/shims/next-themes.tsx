import type { ReactNode } from 'react';

import { useTheme as useThemeLocal, type Theme } from '@/lib/theme';

export function ThemeProvider({ children }: { children: ReactNode; [cle: string]: unknown }) {
  return <>{children}</>;
}

export function useTheme(): {
  theme?: Theme;
  setTheme: (valeur: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  systemTheme: 'light' | 'dark';
} {
  const { theme, setTheme } = useThemeLocal();
  const systemTheme = globalThis.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
  return { theme, setTheme, resolvedTheme: theme === 'system' ? systemTheme : theme, systemTheme };
}
