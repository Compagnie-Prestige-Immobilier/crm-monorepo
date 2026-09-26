'use client';

import { unwrap } from '@crm/api-client/query';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useId, useState } from 'react';

import { meQueryOptions } from '@/api/auth';
import { QueryErrorState } from '@/components/query-error-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiClient } from '@/lib/api/browser';
import { formatNumber } from '@/lib/format';
import { peut } from '@/lib/types';

const CLASSEMENT_MAX = 20;

async function fetchClassement(du: string, au: string) {
  const { parrains } = unwrap(
    await getApiClient().GET('/api/v1/parrainage/classement', { params: { query: { du, au } } }),
  );
  return parrains;
}

function Classement({ du, au }: { du: string; au: string }) {
  const classement = useQuery({
    queryKey: ['parrainage', 'classement', du, au],
    queryFn: () => fetchClassement(du, au),
  });
  if (classement.isPending) return <Skeleton className="h-40 w-full" />;
  if (classement.isError) {
    return (
      <QueryErrorState
        error={classement.error}
        fallback="Le classement des parrains n’a pas pu être lu."
        onRetry={() => void classement.refetch()}
      />
    );
  }
  if (classement.data.length === 0) {
    return (
      <p className="text-[0.875rem] text-muted-foreground">
        Aucun numéro recommandé sur cette période. Élargissez la période.
      </p>
    );
  }
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Parrain</TableHead>
            <TableHead className="text-right">Recommandés</TableHead>
            <TableHead className="text-right">Fiches</TableHead>
            <TableHead className="text-right">Convertis</TableHead>
            <TableHead className="text-right">Vendus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {classement.data.map((parrain) => (
            <TableRow key={parrain.id}>
              <TableCell>
                <Link
                  href={`/teleconseil/prospects/${parrain.id}`}
                  className="font-[600] underline-offset-4 hover:underline"
                >
                  {parrain.nom}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(parrain.recommandes)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(parrain.fiches)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(parrain.convertis)}
              </TableCell>
              <TableCell className="text-right font-[600] tabular-nums">
                {formatNumber(parrain.vendus)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {classement.data.length >= CLASSEMENT_MAX ? (
        <p className="mt-2 text-[0.8125rem] text-muted-foreground">
          Les {CLASSEMENT_MAX} premiers parrains de la période.
        </p>
      ) : null}
    </>
  );
}

export function MeilleursParrains() {
  const id = useId();
  const { data: user } = useQuery(meQueryOptions);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [du, setDu] = useState(`${aujourdhui.slice(0, 7)}-01`);
  const [au, setAu] = useState(aujourdhui);
  if (!peut(user, 'prospects.superviser')) return null;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-end justify-between gap-3">
        <CardTitle>Meilleurs parrains</CardTitle>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-du`}>Du</Label>
            <Input
              id={`${id}-du`}
              type="date"
              max={au}
              value={du}
              onChange={(event) => setDu(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-au`}>Au</Label>
            <Input
              id={`${id}-au`}
              type="date"
              min={du}
              value={au}
              onChange={(event) => setAu(event.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {du === '' || au === '' || au < du ? (
          <p role="alert" className="text-[0.875rem] text-destructive">
            Choisissez une période dont le début précède la fin.
          </p>
        ) : (
          <Classement du={du} au={au} />
        )}
      </CardContent>
    </Card>
  );
}
