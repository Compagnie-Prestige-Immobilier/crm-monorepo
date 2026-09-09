import type * as React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

import { useTheme } from '@/lib/theme';

function Toaster(props: ToasterProps) {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
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
