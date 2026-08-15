'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { StatInfo } from '@/components/stats/stat-info';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EMPTY_FILTERS } from '@/lib/filters';
import { fetchBankAging, formatDelayDays } from '@/lib/data/advanced-stats';
import { formatNumber, formatRateOrNone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

/**
 * Vieillissement du portefeuille bancaire.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * L'entonnoir donne un VOLUME. Celui-ci donne une DURÉE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Savoir que quarante dossiers stationnent à « Vérification » ne dit pas s'ils
 * y sont depuis deux jours ou depuis deux mois. C'est pourtant la seule
 * question qui désigne l'étape qui bloque, et la seule qui justifie de relancer
 * quelqu'un.
 *
 * La population observée est explicitement celle des dossiers NON TERMINÉS : un
 * dossier encaissé ou rejeté est sorti du portefeuille, et son ancienneté ne se
 * pilote plus. La carte le dit, sinon l'écart avec le total des dossiers du
 * volet se lirait comme une erreur de calcul.
 *
 * Le filtre est celui des PROSPECTS (`EMPTY_FILTERS`) et non celui des
 * dossiers : la route partage le `ProspectFilterDto` commun, et le volet
 * bancaire porte son propre objet de filtre, incompatible. Plutôt que de
 * traduire l'un dans l'autre (ce qui donnerait deux populations différentes
 * sous le même écran), la carte s'annonce comme une vue non filtrée.
 */
export function BankAgingCard() {
  const { data, isPending } = useQuery({
    queryKey: queryKeys.statsVieillissement(EMPTY_FILTERS),
    queryFn: () => fetchBankAging(EMPTY_FILTERS),
    placeholderData: keepPreviousData,
  });

  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[1.0625rem]">
          Ancienneté des dossiers en cours
          <StatInfo stat="bankAging" label="Ancienneté des dossiers en cours" />
        </CardTitle>
        <CardDescription>
          {isPending || data === undefined
            ? 'Calcul en cours…'
            : `${formatNumber(data.total)} dossier${data.total > 1 ? 's' : ''} encore ouvert${data.total > 1 ? 's' : ''}. Les dossiers encaissés ou rejetés sont sortis du portefeuille.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data === undefined ? (
          <Skeleton className="h-40 w-full" aria-hidden="true" />
        ) : data.total === 0 ? (
          <p className="text-[0.875rem] text-muted-foreground">
            Aucun dossier en cours : rien ne vieillit.
          </p>
        ) : (
          <>
            <ul className="grid gap-2 sm:grid-cols-5">
              {data.buckets.map((bucket) => (
                <li key={bucket.bucket} className="rounded-md border border-border p-3">
                  <p className="text-[0.75rem] text-muted-foreground">{bucket.label}</p>
                  <p className="mt-0.5 text-[1.125rem] font-[700] tabular-nums">
                    {formatNumber(bucket.dossiers)}
                  </p>
                  <p className="text-[0.75rem] text-muted-foreground tabular-nums">
                    {formatRateOrNone(bucket.share)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Étape</TableHead>
                    <TableHead className="text-right">Dossiers</TableHead>
                    <TableHead className="text-right">Part</TableHead>
                    <TableHead className="text-right">Stationnement médian</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stages.map((stage) => (
                    <TableRow key={stage.stageId}>
                      <TableCell className="font-[600]">{stage.label}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(stage.dossiers)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRateOrNone(stage.share)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDelayDays(stage.medianStationDays)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
