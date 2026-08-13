'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

import { ExactAmountsProvider } from '@/components/money/exact-amounts';
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
        // Clair par défaut, et non « system » : le panel est un outil de
        // bureau lu à la journée, sur des tableaux et des chiffres. Le sombre
        // reste accessible d'un clic pour qui le préfère.
        defaultTheme="light"
        enableSystem
        // Sans cela, next-themes anime la bascule et l'écran entier flashe.
        disableTransitionOnChange
      >
        {/* La préférence « chiffres exacts » vaut pour l'application entière :
            un directeur qui l'active sur le tableau de bord la retrouve sur les
            dossiers bancaires. Deux interrupteurs pour le même réglage se
            désynchroniseraient dès la première navigation. */}
        <ExactAmountsProvider>{children}</ExactAmountsProvider>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
