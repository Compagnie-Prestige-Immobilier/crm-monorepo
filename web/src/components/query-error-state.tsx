'use client';

import {
  AlertTriangleIcon,
  LockIcon,
  RotateCwIcon,
  ServerCogIcon,
  WifiOffIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { isConfigurationError } from '@/lib/api/config';
import { apiErrorText } from '@/lib/mutation-feedback';
import { ApiError } from '@crm/api-client/query';

function presentation(error: unknown): { icon: LucideIcon; title: string; retryable: boolean } {
  if (isConfigurationError(error)) {
    return { icon: ServerCogIcon, title: 'Configuration incomplète', retryable: false };
  }

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
    if (error.status === 400 || error.status === 422) {
      return { icon: AlertTriangleIcon, title: 'Requête refusée', retryable: false };
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
