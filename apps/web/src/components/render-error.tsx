'use client';

import { AlertTriangleIcon, RotateCwIcon } from 'lucide-react';
import Link from 'next/link';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface RouteError extends Error {
  /** Identifiant que Next met dans le journal serveur ; le seul repère utile au support. */
  digest?: string;
}

/**
 * Frontière d'erreur de rendu, en français.
 *
 * Sans elle, la moindre exception d'un composant client remplaçait TOUT l'écran
 * — coque et navigation comprises — par la page d'erreur générique de Next, en
 * anglais et sans issue.
 */
export function RenderError({
  error,
  reset,
  retour,
  retourLabel = 'Revenir aux espaces',
}: {
  error: RouteError;
  reset: () => void;
  retour: string;
  retourLabel?: string | undefined;
}) {
  return (
    <Card
      role="alert"
      aria-live="assertive"
      className="animate-rise mx-auto max-w-lg items-center gap-3 border-destructive/30 px-6 py-16 text-center"
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-destructive-surface text-destructive"
      >
        <AlertTriangleIcon className="size-6" />
      </span>
      <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
        Cet écran n’a pas pu s’afficher
      </h2>
      <p className="max-w-md text-[0.9375rem] text-muted-foreground">
        Rien n’a été perdu et le reste du panneau fonctionne. Réessayez&nbsp;; si l’écran revient,
        prévenez l’administrateur.
      </p>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={reset}>
          <RotateCwIcon className="size-4" aria-hidden="true" />
          Réessayer
        </Button>
        {/* Un LIEN habillé en bouton : la primitive `Button` de Base UI poserait
            `role="button"` sur le `<a>` et lui retirerait sa sémantique de lien. */}
        <Link href={retour} className={cn(buttonVariants({ variant: 'outline' }))}>
          {retourLabel}
        </Link>
      </div>

      {error.digest === undefined ? null : (
        <p className="text-[0.75rem] text-muted-foreground">
          Code à communiquer&nbsp;: <span className="font-mono">{error.digest}</span>
        </p>
      )}
    </Card>
  );
}
