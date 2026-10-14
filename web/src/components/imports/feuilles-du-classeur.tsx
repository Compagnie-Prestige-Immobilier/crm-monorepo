'use client';

import { Link } from '@tanstack/react-router';
import { CalendarRangeIcon } from 'lucide-react';

import type { ImportJob, ImportJobReport } from '@/lib/data/imports';
import { formatNumber, formatPhone } from '@/lib/format';
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

interface FicheDejaEnBase {
  ligne: number;
  nom: string;
  telephone: string;
  prospectId: string;
  fichier: string;
  onglet: string;
}

export interface Feuille {
  feuille: string;
  lignes: number;
  inedits: number;
  reLivres: number;
  doublons: number;
  dejaEnBase?: number;
  fichesDejaEnBase?: FicheDejaEnBase[];
  inexploitables: number;
}

export type CleFeuille = 'lignes' | 'inedits' | 'reLivres' | 'doublons' | 'inexploitables';

type ImportJobReportAvecFeuilles = ImportJobReport & {
  feuilles?: Feuille[];
};

const COLONNES: { cle: CleFeuille; titre: string }[] = [
  { cle: 'lignes', titre: 'Lignes livrées' },
  { cle: 'inedits', titre: 'Numéros inédits' },
  { cle: 'reLivres', titre: 'Re-livrés' },
  { cle: 'doublons', titre: 'En double' },
  { cle: 'inexploitables', titre: 'Inexploitables' },
];

function origine(fiche: FicheDejaEnBase): string {
  if (!fiche.fichier) return 'Hors classeur (formulaire, saisie, banque…)';
  return fiche.onglet ? `${fiche.fichier} · ${fiche.onglet}` : fiche.fichier;
}

function total(feuilles: Feuille[], cle: CleFeuille): number {
  return feuilles.reduce((somme, feuille) => somme + (feuille[cle] ?? 0), 0);
}

/**
 * Le classeur des leads porte un onglet par jour et le relevé le relit en
 * entier : le compte global ne dit pas quel jour a livré quoi.
 */
export function FeuillesDuClasseur({ job }: { job: ImportJob }) {
  const report = job.report as ImportJobReportAvecFeuilles | null;
  const feuilles = report?.feuilles ?? [];
  if (feuilles.length < 2) return null;
  const lignes = total(feuilles, 'lignes');
  const inedits = total(feuilles, 'inedits');
  const dejaEnBase = feuilles.reduce((somme, feuille) => somme + (feuille.dejaEnBase ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[1.0625rem]">
          <CalendarRangeIcon className="size-4 shrink-0" aria-hidden="true" />
          Ce que chaque onglet a livré
        </CardTitle>
        <CardDescription>
          {formatNumber(lignes)} lignes livrées, {formatNumber(inedits)} numéros inédits. Un numéro
          re-livré a déjà été donné un jour précédent : il ne fait pas une fiche de plus. Un numéro
          déjà en base avant ce classeur compte en double.
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
                      {colonne.cle === 'doublons' && feuille.dejaEnBase ? (
                        <span className="text-muted-foreground block text-xs">
                          dont {formatNumber(feuille.dejaEnBase)} déjà en base
                        </span>
                      ) : null}
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
        {dejaEnBase > 0 ? <DejaEnBase feuilles={feuilles} total={dejaEnBase} /> : null}
      </CardContent>
    </Card>
  );
}

/** Nom par nom, pour répondre au marketing quand ses comptes et les nôtres divergent. */
function DejaEnBase({ feuilles, total }: { feuilles: Feuille[]; total: number }) {
  return (
    <div className="border-t">
      <p className="px-4 pt-4 text-sm font-[600]">
        {formatNumber(total)} {total > 1 ? 'numéros étaient' : 'numéro était'} déjà en base avant ce
        classeur
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Onglet</TableHead>
              <TableHead className="text-right">Ligne</TableHead>
              <TableHead>Fiche</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Arrivée d’abord par</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feuilles.flatMap((feuille) =>
              (feuille.fichesDejaEnBase ?? []).map((fiche) => (
                <TableRow key={`${feuille.feuille}-${fiche.ligne}`}>
                  <TableCell>{feuille.feuille}</TableCell>
                  <TableCell className="text-right tabular-nums">{fiche.ligne}</TableCell>
                  <TableCell>
                    <Link
                      to="/teleconseil/prospects/$id"
                      params={{ id: fiche.prospectId }}
                      className="font-[600] underline underline-offset-4"
                    >
                      {fiche.nom || 'Sans nom'}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatPhone(fiche.telephone)}
                  </TableCell>
                  <TableCell>{origine(fiche)}</TableCell>
                </TableRow>
              )),
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
