'use client';

import { AlertTriangleIcon, LockIcon, RotateCwIcon, WifiOffIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiErrorText } from '@/lib/mutation-feedback';
import { ApiError } from '@crm/api-client/query';

/**
 * État d'ERREUR d'une requête. Il manquait à TOUS les écrans du panel.
 *
 * Le défaut corrigé ici : aucune vue ne lisait `isError`. Comme
 * `unwrap()` fait bien rejeter la requête, `data` restait `undefined` et le
 * rendu tombait sur l'état VIDE. Un 500 du serveur s'affichait donc en
 * « Aucun prospect ne correspond à ces filtres. Élargissez la période ou
 * retirez un critère. » — un message qui accuse l'utilisateur d'avoir mal
 * filtré alors que le serveur est en panne, et qui l'envoie tripoter ses
 * critères pendant que la vraie cause reste invisible.
 *
 * Deux exigences de docs/design.md sont tenues ici :
 *  - jamais un « Erreur » nu : `apiErrorText` traduit le statut en une phrase
 *    qui dit quoi faire ensuite ;
 *  - un 403 n'est pas une panne mais un refus de permission, et il se présente
 *    autrement — proposer « Réessayer » sur un refus de droits ferait recliquer
 *    dans le vide.
 */

function presentation(error: unknown): { icon: LucideIcon; title: string; retryable: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return {
        icon: LockIcon,
        title: 'Accès refusé',
        retryable: false,
      };
    }
    if (error.status === 404) {
      return { icon: AlertTriangleIcon, title: 'Introuvable', retryable: false };
    }
    if (error.status >= 500) {
      return {
        icon: AlertTriangleIcon,
        title: 'Erreur serveur',
        retryable: true,
      };
    }
    return { icon: AlertTriangleIcon, title: 'Chargement impossible', retryable: true };
  }
  // Pas d'`ApiError` : le réseau n'a pas abouti du tout.
  return { icon: WifiOffIcon, title: 'Serveur injoignable', retryable: true };
}

export function QueryErrorState({
  error,
  onRetry,
  fallback = 'Chargement impossible. Réessayez dans un instant.',
  className,
}: {
  error: unknown;
  onRetry?: (() => void) | undefined;
  fallback?: string | undefined;
  className?: string | undefined;
}) {
  const { icon: Icon, title, retryable } = presentation(error);

  return (
    /* `role="alert"` : l'échec survient APRÈS le chargement, donc hors du flux
       de lecture. Sans annonce, un utilisateur de lecteur d'écran attend
       indéfiniment des données qui ne viendront pas. */
    <Card
      role="alert"
      aria-live="assertive"
      className={
        className ?? 'animate-rise items-center gap-3 border-destructive/30 px-6 py-16 text-center'
      }
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-destructive-surface text-destructive"
      >
        <Icon className="size-6" />
      </span>
      <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">{title}</h2>
      <p className="max-w-md text-[0.9375rem] text-muted-foreground">
        {apiErrorText(error, fallback)}
      </p>
      {retryable && onRetry !== undefined ? (
        <Button type="button" variant="outline" onClick={onRetry} className="mt-1">
          <RotateCwIcon className="size-4" aria-hidden="true" />
          Réessayer
        </Button>
      ) : null}
    </Card>
  );
}

/**
 * Variante compacte, pour un bloc qui vit à l'intérieur d'une carte (un
 * graphique du tableau de bord, par exemple) et ne peut pas s'offrir un pavé
 * de seize unités de hauteur.
 */
export function QueryErrorInline({
  error,
  onRetry,
  fallback = 'Chargement impossible.',
}: {
  error: unknown;
  onRetry?: (() => void) | undefined;
  fallback?: string | undefined;
}) {
  const { retryable } = presentation(error);

  return (
    <div
      role="alert"
      className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center"
    >
      <AlertTriangleIcon className="size-5 text-destructive" aria-hidden="true" />
      <p className="text-[0.8125rem] text-muted-foreground">{apiErrorText(error, fallback)}</p>
      {retryable && onRetry !== undefined ? (
        <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
          <RotateCwIcon className="size-3.5" aria-hidden="true" />
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}
