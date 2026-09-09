import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { dureeAffichee } from '@/components/supervision/colonnes';
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
import {
  fetchComptageOuvertures,
  fetchOuverturesOuvertes,
  libererOuverture,
  secondesEcoulees,
  type OuvertureFiche,
  type Periode,
} from '@/lib/data/supervision';
import { formatDateTime, formatNumber, formatShortDate } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';

const OUVERTES = ['ouvertures', 'ouvertes'] as const;

/**
 * Section à part, et non une colonne du tableau d'activité : une ouverture ne
 * suit pas la famille d'appel, et son compte se lit par jour, pas par période.
 */
export function FichesOuvertes({ periode }: { periode: Periode }) {
  const comptage = useQuery({
    queryKey: ['ouvertures', 'comptage', periode.from, periode.to],
    queryFn: () => fetchComptageOuvertures(periode),
  });

  if (comptage.isPending) return <Skeleton className="h-40 w-full" />;
  if (comptage.isError) return null;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <caption className="px-3 py-3 text-left font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
            Fiches ouvertes, par téléconseiller et par jour
          </caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Téléconseiller</TableHead>
              <TableHead>Jour</TableHead>
              <TableHead className="text-right">Fiches ouvertes</TableHead>
              <TableHead className="text-right">Traitement moyen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comptage.data.map((ligne) => (
              <TableRow key={`${ligne.openedById}-${ligne.jour}`}>
                <TableCell className="font-[600]">{ligne.openedByName}</TableCell>
                <TableCell>{formatShortDate(ligne.jour)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(ligne.ouvertures)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {dureeAffichee(ligne.dureeMoyenneSecondes)}
                </TableCell>
              </TableRow>
            ))}
            {comptage.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center">
                  Aucune fiche ouverte sur la période. Élargissez les dates.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Les fiches qu'un téléconseiller tient encore. Rien ne les libère tout seul :
 * une fiche qu'une machine rend est une fiche que tout le monde croit traitée.
 */
export function FichesRestees() {
  const queryClient = useQueryClient();
  const [aLiberer, setALiberer] = useState<OuvertureFiche | null>(null);
  const [tracee, setTracee] = useState<OuvertureFiche | null>(null);
  const [maintenant] = useState(() => Date.now());

  const ouvertes = useQuery({ queryKey: OUVERTES, queryFn: fetchOuverturesOuvertes });

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
                  {dureeAffichee(secondesEcoulees(ouverture.openedAt, maintenant))}
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
        onOpenChange={(suivant) => {
          if (!suivant) setALiberer(null);
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
