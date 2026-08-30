'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

import { ExactAmountsProvider } from '@/components/money/exact-amounts';
import { AndroidReleaseUploadToast } from '@/components/settings/android-release-upload-toast';
import { Toaster } from '@/components/ui/sonner';
import { getQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        {/* La préférence « chiffres exacts » vaut pour l'application entière :
            un directeur qui l'active sur le tableau de bord la retrouve sur les
            dossiers bancaires. Deux interrupteurs pour le même réglage se
            désynchroniseraient dès la première navigation. */}
        <ExactAmountsProvider>{children}</ExactAmountsProvider>
        <Toaster />
        {/* Hors de l'arbre des écrans : l'envoi d'un APK garde sa barre et sa
            fenêtre de confirmation quand l'administrateur quitte Paramètres. */}
        <AndroidReleaseUploadToast />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
