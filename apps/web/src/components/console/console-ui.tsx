'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { formatChrono, secondesEcoulees } from '@/lib/data/ouvertures';

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

/**
 * Le temps de traitement : de la première saisie au statut, la lecture de la
 * fiche exclue. Rien saisi, rien à montrer : l'appelant ne le monte pas.
 */
export function Chrono({ firstInputAt }: { firstInputAt: string }) {
  const [secondes, setSecondes] = useState(() => secondesEcoulees(firstInputAt, Date.now()));

  useEffect(() => {
    const battement = setInterval(() => {
      setSecondes(secondesEcoulees(firstInputAt, Date.now()));
    }, 1000);
    return () => {
      clearInterval(battement);
    };
  }, [firstInputAt]);

  return (
    <p className="text-[0.8125rem] text-muted-foreground">
      En saisie depuis{' '}
      <span className="font-[600] tabular-nums text-foreground">{formatChrono(secondes)}</span>
    </p>
  );
}
