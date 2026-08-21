'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConicalIcon, LoaderIcon, RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';

import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchDemoStatus, resetDemoWorkspace } from '@/lib/data/demo';
import { formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';

const LABELS = {
  users: 'comptes',
  representants: 'représentants',
  prospects: 'prospects',
  campaigns: 'campagnes',
  bankCases: 'dossiers bancaires',
} as const;

export function DemoModeCard() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: queryKeys.demoStatus, queryFn: () => fetchDemoStatus() });
  const reset = useMutation({
    mutationFn: () => resetDemoWorkspace(),
    onSuccess: (next) => {
      queryClient.setQueryData(queryKeys.demoStatus, next);
      toast.success('Espace démo réinitialisé.');
    },
    onError: (error) => {
      toastApiError(error, 'Réinitialisation impossible. Réessayez.');
    },
  });

  if (status.isPending) return null;
  if (status.isError) {
    return (
      <QueryErrorState
        error={status.error}
        onRetry={() => void status.refetch()}
        fallback="État de l’espace démo non chargé."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConicalIcon className="size-4" aria-hidden="true" />
          Espace démo
        </CardTitle>
        <CardDescription>
          Le jeu est reconstruit par la factory à partir des référentiels et comptes actuels.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(status.data.counts).map(([key, value]) => (
            <div key={key} className="flex justify-between rounded-md border px-3 py-2">
              <dt className="text-muted-foreground">{LABELS[key as keyof typeof LABELS]}</dt>
              <dd className="font-[600] tabular-nums">{formatNumber(value)}</dd>
            </div>
          ))}
        </dl>
        <Button
          type="button"
          className="self-start"
          disabled={reset.isPending}
          onClick={() => {
            reset.mutate();
          }}
        >
          {reset.isPending ? (
            <LoaderIcon className="animate-spin" aria-hidden="true" />
          ) : (
            <RotateCcwIcon aria-hidden="true" />
          )}
          Réinitialiser l’espace démo
        </Button>
      </CardContent>
    </Card>
  );
}
