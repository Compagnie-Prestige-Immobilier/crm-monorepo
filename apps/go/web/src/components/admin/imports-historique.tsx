import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { QueryErrorInline } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchTravauxImport, LIBELLES_GENRE, type TravailImport } from '@/lib/data/imports';
import { formatDateTime, formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

export function ImportsHistorique({ onOuvrir }: { onOuvrir: (travail: TravailImport) => void }) {
  const [page, setPage] = useState(1);
  const travaux = useQuery({
    queryKey: queryKeys.importJobs(page),
    queryFn: () => fetchTravauxImport(page),
    placeholderData: (precedent) => precedent,
  });

  if (travaux.isPending) return <Skeleton className="h-40 w-full" />;
  if (travaux.isError) {
    return (
      <QueryErrorInline
        error={travaux.error}
        onRetry={() => {
          void travaux.refetch();
        }}
        fallback="L’historique n’a pas pu être lu."
      />
    );
  }

  const meta = travaux.data.meta;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Fichier</TableHead>
              <TableHead>Entité</TableHead>
              <TableHead>Déposé le</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Ouvrir</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {travaux.data.items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Aucun import déposé jusqu’ici.
                </TableCell>
              </TableRow>
            ) : (
              travaux.data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-64 truncate">{item.fileName}</TableCell>
                  <TableCell>{LIBELLES_GENRE[item.kind]}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(item.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.mode === 'APPLY' ? 'secondary' : 'outline'}>
                      {item.mode === 'APPLY' ? 'Appliqué' : 'Simulation'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onOuvrir(item);
                      }}
                    >
                      Ouvrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {meta.pageCount <= 1 ? null : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.8125rem] tabular-nums text-muted-foreground">
            {formatNumber(meta.total)} imports · page {formatNumber(meta.page)} sur{' '}
            {formatNumber(meta.pageCount)}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => {
                setPage(page - 1);
              }}
            >
              Précédent
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={page >= meta.pageCount}
              onClick={() => {
                setPage(page + 1);
              }}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
