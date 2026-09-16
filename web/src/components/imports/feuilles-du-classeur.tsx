'use client';

import { CalendarRangeIcon } from 'lucide-react';

import type { ImportJob, ImportJobReport } from '@/lib/data/imports';
import { formatNumber } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Feuille = NonNullable<ImportJobReport['feuilles']>[number];

const COLONNES: { cle: keyof Omit<Feuille, 'feuille'>; titre: string }[] = [
  { cle: 'lignes', titre: 'Lignes livrées' },
  { cle: 'inedits', titre: 'Numéros inédits' },
  { cle: 'reLivres', titre: 'Re-livrés' },
  { cle: 'doublons', titre: 'En double' },
  { cle: 'inexploitables', titre: 'Inexploitables' },
];

function total(feuilles: Feuille[], cle: keyof Omit<Feuille, 'feuille'>): number {
  return feuilles.reduce((somme, feuille) => somme + feuille[cle], 0);
}

/**
 * Le classeur des leads porte un onglet par jour et le relevé le relit en
 * entier : le compte global ne dit pas quel jour a livré quoi.
 */
export function FeuillesDuClasseur({ job }: { job: ImportJob }) {
  const feuilles = job.report?.feuilles ?? [];
  if (feuilles.length < 2) return null;
  const lignes = total(feuilles, 'lignes');
  const inedits = total(feuilles, 'inedits');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[1.0625rem]">
          <CalendarRangeIcon className="size-4 shrink-0" aria-hidden="true" />
          Ce que chaque onglet a livré
        </CardTitle>
        <CardDescription>
          {formatNumber(lignes)} lignes livrées, {formatNumber(inedits)} numéros inédits. Un numéro
          re-livré a déjà été donné un jour précédent : il ne fait pas une fiche de plus.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Onglet</TableHead>
                {COLONNES.map((colonne) => (
                  <TableHead key={colonne.cle} className="text-right">
                    {colonne.titre}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {feuilles.map((feuille) => (
                <TableRow key={feuille.feuille}>
                  <TableCell className="font-[600]">{feuille.feuille}</TableCell>
                  {COLONNES.map((colonne) => (
                    <TableCell key={colonne.cle} className="text-right tabular-nums">
                      {formatNumber(feuille[colonne.cle])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className="font-[600]">Total</TableCell>
                {COLONNES.map((colonne) => (
                  <TableCell key={colonne.cle} className="text-right font-[600] tabular-nums">
                    {formatNumber(total(feuilles, colonne.cle))}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
