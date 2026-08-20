'use client';

import type { ReactNode } from 'react';
import { toast } from 'sonner';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.75rem] font-[600] text-muted-foreground">
      {children}
    </kbd>
  );
}

export function copyPhone(phoneE164: string): void {
  if (!('clipboard' in navigator)) {
    toast.error('Copie indisponible dans ce navigateur.');
    return;
  }
  navigator.clipboard.writeText(phoneE164).then(
    () => {
      toast.success('Numéro copié.');
    },
    () => {
      toast.error('Copie refusée par le navigateur.');
    },
  );
}
