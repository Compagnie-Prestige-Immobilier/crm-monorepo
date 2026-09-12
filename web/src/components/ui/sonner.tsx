'use client';

import { useTheme } from 'next-themes';
import type * as React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as 'system' | 'light' | 'dark'}
      className="toaster group"
      position="bottom-right"
      closeButton
      toastOptions={{ closeButtonAriaLabel: 'Fermer' }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--success-bg': 'var(--success-surface)',
          '--success-text': 'var(--success)',
          '--error-bg': 'var(--destructive-surface)',
          '--error-text': 'var(--destructive)',
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
