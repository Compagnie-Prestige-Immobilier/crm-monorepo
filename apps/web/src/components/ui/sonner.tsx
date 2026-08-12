'use client';

import { useTheme } from 'next-themes';
import type * as React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * Toaster CPI.
 *
 * Les couleurs sont passées en variables CSS plutôt qu'en classes : Sonner rend
 * ses toasts dans un portail hors de l'arbre, et un toast déclenché depuis un
 * écran sombre doit rester lisible. En pointant sur `--popover` / `--border`,
 * il suit le thème actif sans code de synchronisation.
 */
function Toaster(props: ToasterProps) {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as 'system' | 'light' | 'dark'}
      className="toaster group"
      position="bottom-right"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--success-bg': 'var(--success-surface)',
          '--success-text': 'var(--success)',
          '--error-bg': 'var(--destructive-surface)',
          '--error-text': 'var(--destructive)',
          // Statut « attention » : surface or aplatie + texte or FONCÉ.
          // L'or décoratif #C8921A ne descend jamais dans `--warning-text`.
          '--warning-bg': 'var(--warning-surface)',
          '--warning-text': 'var(--warning)',
          '--border-radius': 'var(--radius-md)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
