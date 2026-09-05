'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDuration } from '@/lib/data/admin';
import {
  fetchOuverturesOuvertes,
  libererOuverture,
  secondesEcoulees,
  type OuvertureFiche,
} from '@/lib/data/ouvertures';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

const OUVERTES = ['ouvertures', 'ouvertes'] as const;

/**
 * Les fiches qu'un téléconseiller tient encore. Rien ne les libère tout seul :
 * une fiche qu'une machine rend est une fiche que tout le monde croit traitée.
 */
export function FichesRestees() {
  const queryClient = useQueryClient();
  const [aLiberer, setALiberer] = useState<OuvertureFiche | null>(null);
  const [tracee, setTracee] = useState<OuvertureFiche | null>(null);
  const [now] = useState(() => Date.now());

  const ouvertes = useQuery({ queryKey: OUVERTES, queryFn: () => fetchOuverturesOuvertes() });

  const liberer = useMutation({
    mutationFn: (ouverture: OuvertureFiche) => libererOuverture(ouverture.id),
    onSuccess: (liberee) => {
      setALiberer(null);
      setTracee(liberee);
      void queryClient.invalidateQueries({ queryKey: OUVERTES });
    },
    onError: (error) => {
      toastApiError(error, 'La fiche n’a pas pu être libérée.');
    },
  });

  if (ouvertes.isPending) return <Skeleton className="h-40 w-full" />;

  if (ouvertes.isError) {
    return (
      <QueryErrorState
        error={ouvertes.error}
        fallback="Les fiches restées ouvertes n’ont pas pu être lues."
        onRetry={() => {
          void ouvertes.refetch();
        }}
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {tracee === null ? null : (
          <p role="status" className="px-3 pt-3 text-[0.875rem]">
            {tracee.ficheNom} libérée par {tracee.releasedByName ?? 'vous'} le{' '}
            {tracee.releasedAt === null ? 'à l’instant' : formatDateTime(tracee.releasedAt)}. Elle
            repasse en « À rappeler ».
          </p>
        )}

        <Table>
          <caption className="px-3 py-3 text-left font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
            Fiches restées ouvertes
          </caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Fiche</TableHead>
              <TableHead>Téléconseiller</TableHead>
              <TableHead>Ouverte depuis</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ouvertes.data.map((ouverture) => (
              <TableRow key={ouverture.id}>
                <TableCell className="font-[600]">{ouverture.ficheNom}</TableCell>
                <TableCell>{ouverture.openedByName}</TableCell>
                <TableCell className="tabular-nums">
                  {formatDuration(secondesEcoulees(ouverture.openedAt, now))}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setALiberer(ouverture);
                    }}
                  >
                    Libérer
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {ouvertes.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center">
                  Aucune fiche n’est restée ouverte. Rien à libérer.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>

      <ConfirmDialog
        open={aLiberer !== null}
        onOpenChange={(next) => {
          if (!next) setALiberer(null);
        }}
        title={`Libérer la fiche de ${aLiberer?.ficheNom ?? ''} ?`}
        description="Elle repasse en « À rappeler » et la libération est tracée à votre nom."
        confirmLabel="Libérer"
        pending={liberer.isPending}
        onConfirm={() => {
          if (aLiberer !== null) liberer.mutate(aLiberer);
        }}
      />
    </Card>
  );
}
