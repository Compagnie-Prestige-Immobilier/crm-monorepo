'use client';

import { useBlocker, useCanGoBack } from '@tanstack/react-router';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatChrono, secondesEcoulees } from '@/lib/data/ouvertures';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      aria-hidden="true"
      className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.75rem] font-[600] text-muted-foreground pointer-coarse:hidden"
    >
      {children}
    </kbd>
  );
}

export function copyPhone(phoneE164: string | null): void {
  if (phoneE164 === null || phoneE164 === '') {
    toast.error('Cette fiche n’a pas de numéro.');
    return;
  }
  if (!('clipboard' in navigator)) {
    toast.error('Copie indisponible dans ce navigateur.');
    return;
  }
  navigator.clipboard.writeText(phoneE164).then(
    () => {
      toast.success(`Numéro ${phoneE164} copié.`);
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

/** Quitter par le menu une fiche en cours de saisie se confirme : le brouillon ne garde pas les choix. */
export function useGardeSaisie(enSaisie: boolean): { liberer: () => void; dialogue: ReactNode } {
  const libre = useRef(false);
  const blocage = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      enSaisie && !libre.current && next.pathname !== current.pathname,
    enableBeforeUnload: false,
    withResolver: true,
  });
  return {
    liberer: () => {
      libre.current = true;
    },
    dialogue: (
      <ConfirmDialog
        open={blocage.status === 'blocked'}
        onOpenChange={(ouvert) => {
          if (!ouvert) blocage.reset?.();
        }}
        title="Quitter cette fiche ?"
        description="Les réponses choisies pour cet appel seront perdues."
        confirmLabel="Quitter la fiche"
        onConfirm={() => {
          blocage.proceed?.();
        }}
      />
    ),
  };
}

/** `?fiche=<id>` tant que la fiche est ouverte ; venue d'un lien, elle rend la main à la page d'avant. */
export function useFicheDansLUrl(): { marquer: (id: string) => void; quitter: () => void } {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const peutRevenir = useCanGoBack();
  const [venueParLien] = useState(() => searchParams.get('fiche') !== null);
  const lienRendu = useRef(false);
  return {
    marquer: (id) => {
      if (searchParams.get('fiche') === id) return;
      router.replace(`${pathname}?fiche=${encodeURIComponent(id)}`);
    },
    quitter: () => {
      if (searchParams.get('fiche') === null) return;
      const revenir = venueParLien && peutRevenir && !lienRendu.current;
      lienRendu.current = true;
      if (revenir) router.back();
      else router.replace(pathname);
    },
  };
}
