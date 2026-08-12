'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { getQueryClient } from '@/lib/query-client';

/**
 * `getQueryClient()` renvoie ici l'instance NAVIGATEUR (singleton de module).
 * Le rendu serveur de ce composant appelle la variante mémorisée par requête —
 * voir `lib/query-client.ts` pour pourquoi la distinction n'est pas cosmétique.
 */
export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        // Sans cela, next-themes anime la bascule et l'écran entier flashe.
        disableTransitionOnChange
      >
        {children}
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
